# Architectural Analysis: Milestone 5 Phase 1 (Notification Worker Daemon)

**Author:** Explorer M5 Arch 1  
**Target:** Orchestrator & Worker Implementation Agent (`worker_m5_worker_1`)  
**Date:** 2026-10-27  
**Scope:** Architectural readiness, schema inspection, outbox polling mechanics, retry backoff calculation, channel adapters, and implementation blueprint for `apps/worker`.

---

## 1. Executive Summary

Milestone 5 Phase 1 delivers the background notification worker daemon (`apps/worker`) for RumahKita. This investigation confirms that the underlying database schema (`notification_events`, `notification_preferences`), business trigger mechanisms in `apps/api` (`evaluateStockThresholdTransition`), and shared contracts in `packages/contracts` are fully established and operational.

Key discoveries:
1. **Schema Column Reconciliation:** The database table `notification_events` uses the column name `attempts` (default 0) and `max_attempts` (default 5), rather than `retry_count`. The worker implementation must query and increment `attempts`.
2. **Drizzle ORM Concurrency Support:** Drizzle ORM v0.35.3 natively supports PostgreSQL row-level locks via `.for('update', { skipLocked: true })` inside transactions.
3. **Short Claim Transaction Pattern:** To prevent holding database transaction locks during external network dispatch (email/WhatsApp), the worker must use a two-phase execution: (1) short transaction to claim events via `FOR UPDATE SKIP LOCKED` and mark them `PROCESSING`, followed by (2) independent dispatch with subsequent individual status updates to `SENT` or `FAILED`.
4. **Missing Dependency in Worker:** `apps/worker/package.json` includes `@rumahkita/db` and `postgres`, but lacks `"drizzle-orm": "^0.35.3"` in direct dependencies. Adding `drizzle-orm` ensures query operators (`eq`, `and`, `or`, `lte`, `sql`, `inArray`, `asc`) compile without transitive dependency issues.

---

## 2. apps/worker Existing Environment & Tooling

### 2.1 File Inventory
- `apps/worker/package.json` (`file:///Users/mac/Projects/03-Labs/RumahKita/apps/worker/package.json`):
  ```json
  {
    "name": "@rumahkita/worker",
    "version": "0.0.0",
    "private": true,
    "main": "./dist/index.js",
    "scripts": {
      "build": "tsc",
      "dev": "tsx watch src/index.ts",
      "start": "node dist/index.js",
      "lint": "eslint \"src/**/*.ts\"",
      "typecheck": "tsc --noEmit",
      "clean": "rimraf dist"
    },
    "dependencies": {
      "@rumahkita/contracts": "workspace:*",
      "@rumahkita/db": "workspace:*",
      "dotenv": "^16.4.5",
      "postgres": "^3.4.4"
    },
    "devDependencies": {
      "@rumahkita/eslint-config": "workspace:*",
      "@rumahkita/typescript-config": "workspace:*",
      "@types/node": "^22.7.5",
      "eslint": "^8.57.0",
      "rimraf": "^6.0.1",
      "tsx": "^4.19.1",
      "typescript": "^5.6.2"
    }
  }
  ```
- `apps/worker/tsconfig.json` (`file:///Users/mac/Projects/03-Labs/RumahKita/apps/worker/tsconfig.json`):
  Extends `@rumahkita/typescript-config/base.json`, outputs to `./dist`, inputs `src/**/*`.
- `apps/worker/src/index.ts` (`file:///Users/mac/Projects/03-Labs/RumahKita/apps/worker/src/index.ts`):
  A skeleton `NotificationWorker` with empty `pollOutbox()` stub and basic `setTimeout` loop.

### 2.2 Environment Variables
From `.env.example` (`file:///Users/mac/Projects/03-Labs/RumahKita/.env.example`, lines 42–53):
```env
WORKER_POLL_INTERVAL_MS=5000
WORKER_MAX_CONCURRENCY=5
RESEND_API_KEY=re_dev_stub_key_12345
SMTP_HOST=localhost
SMTP_PORT=1025
WHATSAPP_API_TOKEN=wa_dev_stub_token_12345
WHATSAPP_PHONE_NUMBER_ID=100000000000000
```
Recommended additional configuration:
- `WORKER_BACKOFF_BASE_SEC`: Base exponential backoff delay in seconds (default: 60).
- `WORKER_BATCH_SIZE`: Number of events claimed per poll (default: 5, mapped to `WORKER_MAX_CONCURRENCY`).
- `WORKER_PROCESSING_TIMEOUT_MS`: Lease timeout for claiming stale processing tasks (default: 300000 = 5 minutes).

### 2.3 Required Tooling Adjustments
1. Add `"drizzle-orm": "^0.35.3"` to `apps/worker/package.json` dependencies.
2. Add `"test": "node --test dist/**/*.test.js"` (or `"tsx --test src/**/*.test.ts"`) to `apps/worker/package.json` scripts to allow unit testing of daemon logic.

---

## 3. Database Schema & Drizzle ORM Analysis

### 3.1 `notification_events` Table Definition
Located at `packages/db/src/schema/notification.ts` (lines 58–87) and SQL migration `0000_sad_thaddeus_ross.sql` (lines 222–237):

| Column | Type | Default | Constraints | Description |
|---|---|---|---|---|
| `id` | `uuid` | `gen_random_uuid()` | `PRIMARY KEY` | Unique event ID |
| `household_id` | `uuid` | - | `NOT NULL`, FK -> `households(id)` ON DELETE CASCADE | Household boundary |
| `item_id` | `uuid` | `NULL` | FK -> `items(id)` ON DELETE CASCADE | Target inventory item (optional) |
| `event_type` | `varchar(50)` | - | `NOT NULL` | `'STOCK_LOW'`, `'STOCK_OUT'` |
| `channel` | `notification_channel` | `'EMAIL'` | `NOT NULL` | Enum: `'EMAIL'`, `'WHATSAPP'` |
| `recipient` | `varchar(255)` | - | `NOT NULL` | Destination email or phone number |
| `payload` | `jsonb` | - | `NOT NULL` | Event metadata (`itemId`, `itemName`, `unit`, `currentStock`, `threshold`, `timestamp`) |
| `status` | `notification_status` | `'PENDING'` | `NOT NULL` | Enum: `'PENDING'`, `'PROCESSING'`, `'SENT'`, `'FAILED'`, `'CANCELLED'` |
| `attempts` | `integer` | `0` | `NOT NULL` | Total delivery attempts initiated |
| `max_attempts` | `integer` | `5` | `NOT NULL` | Maximum allowed attempts before permanent failure |
| `last_error` | `text` | `NULL` | - | Stack trace or failure description |
| `next_retry_at` | `timestamptz` | `NULL` | - | Scheduled timestamp for subsequent attempt |
| `sent_at` | `timestamptz` | `NULL` | - | Timestamp when delivery succeeded |
| `created_at` | `timestamptz` | `now()` | `NOT NULL` | Timestamp of event creation |

### 3.2 Existing Indexes
1. `notification_events_outbox_polling_idx` on `(status, next_retry_at, created_at)`: Specifically designed for index-accelerated polling query execution.
2. `notification_events_household_idx` on `(household_id)`.
3. `notification_events_item_id_idx` on `(item_id)`.

### 3.3 Database Client Connection
`packages/db/src/index.ts` exports:
```ts
export function createDatabaseClient(config: DatabaseConfig = {}) {
  const connectionString = config.connectionString || process.env.DATABASE_URL || ...;
  const queryClient = postgres(connectionString, { max: config.maxConnections || 10 });
  const db = drizzle(queryClient, { schema });
  return { db, queryClient };
}
```
In `apps/worker`, `createDatabaseClient({ maxConnections: 5 })` will provide both `db` (Drizzle instance) and `queryClient` (`postgres.Sql` instance for connection shutdown via `queryClient.end()`).

---

## 4. Outbox Polling Pattern (`FOR UPDATE SKIP LOCKED`)

### 4.1 Safe Polling Transaction Pattern
In PostgreSQL, `FOR UPDATE SKIP LOCKED` guarantees:
- A worker row-locks only the rows it selects.
- Concurrent workers querying at the same instant skip those locked rows and pick the subsequent available rows.
- No thread or worker blocks or deadlocks.

To avoid holding database locks during external network I/O, the polling cycle is structured as:

```
[Daemon Loop Tick]
       │
       ▼
[Begin Short DB Transaction]
       │
       ├─► SELECT id, ... FROM notification_events
       │   WHERE (status = 'PENDING')
       │      OR (status = 'FAILED' AND attempts < max_attempts AND (next_retry_at IS NULL OR next_retry_at <= NOW()))
       │      OR (status = 'PROCESSING' AND next_retry_at <= NOW()) -- Reclaim crashed workers
       │   ORDER BY created_at ASC
       │   LIMIT :batchSize
       │   FOR UPDATE SKIP LOCKED
       │
       ├─► UPDATE notification_events
       │   SET status = 'PROCESSING',
       │       attempts = attempts + 1,
       │       next_retry_at = NOW() + INTERVAL '5 minutes' -- Safety lease timeout
       │   WHERE id IN (:selectedIds)
       │
       ▼
[Commit DB Transaction] (Locks released; rows now in 'PROCESSING')
       │
       ▼
[Process Batch Concurrently via Channel Adapters (Outside DB Transaction)]
       │
       ├─► On Success:
       │     UPDATE notification_events
       │     SET status = 'SENT', sent_at = NOW(), last_error = NULL, next_retry_at = NULL
       │     WHERE id = :id
       │
       └─► On Failure:
             Compute next_retry_at via Exponential Backoff
             UPDATE notification_events
             SET status = 'FAILED', last_error = :errorMessage, next_retry_at = :computedNextRetry
             WHERE id = :id
```

### 4.2 Drizzle ORM Polling Query Specification
```ts
import { eq, or, and, sql, lte, isNull, asc, inArray } from 'drizzle-orm';
import { schema } from '@rumahkita/db';

async function claimBatch(db: DbClient, batchSize: number) {
  return await db.transaction(async (tx) => {
    const now = new Date();

    const candidateEvents = await tx
      .select()
      .from(schema.notificationEvents)
      .where(
        or(
          eq(schema.notificationEvents.status, 'PENDING'),
          and(
            eq(schema.notificationEvents.status, 'FAILED'),
            sql`${schema.notificationEvents.attempts} < ${schema.notificationEvents.maxAttempts}`,
            or(
              isNull(schema.notificationEvents.nextRetryAt),
              lte(schema.notificationEvents.nextRetryAt, now)
            )
          ),
          and(
            eq(schema.notificationEvents.status, 'PROCESSING'),
            sql`${schema.notificationEvents.attempts} < ${schema.notificationEvents.maxAttempts}`,
            lte(schema.notificationEvents.nextRetryAt, now)
          )
        )
      )
      .orderBy(asc(schema.notificationEvents.createdAt))
      .limit(batchSize)
      .for('update', { skipLocked: true });

    if (candidateEvents.length === 0) {
      return [];
    }

    const ids = candidateEvents.map((e) => e.id);
    const leaseExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 min safety lease

    await tx
      .update(schema.notificationEvents)
      .set({
        status: 'PROCESSING',
        attempts: sql`${schema.notificationEvents.attempts} + 1`,
        nextRetryAt: leaseExpiry,
      })
      .where(inArray(schema.notificationEvents.id, ids));

    return candidateEvents;
  });
}
```

---

## 5. Retry Strategy & Exponential Backoff Calculation

### 5.1 Backoff Formula
Per requirement: `next_retry_at = now() + (2 ^ retry_count) * 60s`, with a maximum of 5 attempts.

Since `attempts` is incremented during claim:
- Initial attempt: `attempts = 1`. If fails, first retry delay is calculated with exponent 0 or 1.
- Standard convention matching formula `(2 ^ retry_count) * base_sec`:
  - Failed Attempt 1 (Retry 0): $2^0 \times 60\text{s} = 60\text{s}$ (1 minute)
  - Failed Attempt 2 (Retry 1): $2^1 \times 60\text{s} = 120\text{s}$ (2 minutes)
  - Failed Attempt 3 (Retry 2): $2^2 \times 60\text{s} = 240\text{s}$ (4 minutes)
  - Failed Attempt 4 (Retry 3): $2^3 \times 60\text{s} = 480\text{s}$ (8 minutes)
  - Failed Attempt 5 (Retry 4): $2^4 \times 60\text{s} = 960\text{s}$ (16 minutes)
  - After 5 attempts ($attempts \ge maxAttempts$): Permanently exhausted. `next_retry_at = null`, `status = 'FAILED'`.

### 5.2 Implementation Function
```ts
export interface BackoffResult {
  canRetry: boolean;
  nextRetryAt: Date | null;
  delaySeconds: number;
}

export function calculateExponentialBackoff(
  currentAttempts: number,
  maxAttempts: number = 5,
  baseSeconds: number = 60
): BackoffResult {
  if (currentAttempts >= maxAttempts) {
    return {
      canRetry: false,
      nextRetryAt: null,
      delaySeconds: 0,
    };
  }

  // retryIndex: 0 for 1st failure, 1 for 2nd failure, etc.
  const retryIndex = Math.max(0, currentAttempts - 1);
  const delaySeconds = Math.pow(2, retryIndex) * baseSeconds;
  const nextRetryAt = new Date(Date.now() + delaySeconds * 1000);

  return {
    canRetry: true,
    nextRetryAt,
    delaySeconds,
  };
}
```

---

## 6. Channel Adapters Specification

### 6.1 Email Adapter (`EmailAdapter`)
- **Recipient Validation:** Basic email regex check.
- **Message Content Formatting:**
  - `STOCK_OUT`:
    - Subject: `[RumahKita] PERINGATAN: Stok Barang Habis (${itemName})`
    - Body:
      ```text
      Halo,
      Stok inventori rumah tangga Anda telah habis!
      Barang: ${itemName}
      Stok Saat Ini: 0 ${unit}
      Batas Minimum: ${threshold} ${unit}
      Waktu Terdeteksi: ${timestamp}

      Silakan segera tambahkan ke daftar belanja kebutuhan.
      ```
  - `STOCK_LOW`:
    - Subject: `[RumahKita] Peringatan: Stok Barang Menipis (${itemName})`
    - Body:
      ```text
      Halo,
      Stok inventori rumah tangga Anda berada pada batas minimum.
      Barang: ${itemName}
      Sisa Stok: ${currentStock} ${unit}
      Batas Minimum: ${threshold} ${unit}
      Waktu Terdeteksi: ${timestamp}

      Disarankan untuk segera melakukan pembelian ulang.
      ```
- **Logging / Simulation:** Structured JSON output to `console.log`:
  ```json
  {
    "channel": "EMAIL",
    "recipient": "user@example.com",
    "subject": "[RumahKita] Peringatan: Stok Barang Menipis (Beras Ramos)",
    "status": "DELIVERED_STUB"
  }
  ```
- **Deterministic Error Simulation:** If recipient contains `fail` or `error` (e.g. `fail@rumahkita.local`), throw `new Error("Simulated email delivery failure")` to test retries.

### 6.2 WhatsApp Adapter (`WhatsAppAdapter`)
- **Indonesian Phone Normalization:**
  Indonesian phone numbers must be formatted to E.164 with `+62`:
  - `08123456789` -> `+628123456789`
  - `628123456789` -> `+628123456789`
  - `+628123456789` -> `+628123456789`
- **Validation:** Matches `/^\+62[0-9]{8,15}$/` (consistent with `packages/contracts/src/notifications/notification.schema.ts`).
- **Template Message Formatting:**
  - `STOCK_OUT`: `[RumahKita] Peringatan: Stok "${itemName}" HABIS (0 ${unit}). Segera lakukan pembelian ulang.`
  - `STOCK_LOW`: `[RumahKita] Peringatan: Stok "${itemName}" menipis (sisa: ${currentStock} ${unit}, minimum: ${threshold} ${unit}). Segera lakukan pembelian ulang.`
- **Logging / Simulation:** Structured JSON output to `console.log`:
  ```json
  {
    "channel": "WHATSAPP",
    "recipient": "+6281234567890",
    "message": "[RumahKita] Peringatan: Stok \"Beras Ramos\" menipis (sisa: 2 kg, minimum: 5 kg)...",
    "status": "DELIVERED_STUB"
  }
  ```
- **Deterministic Error Simulation:** If phone contains `999999999` or recipient contains `fail`, throw `new Error("Simulated WhatsApp delivery failure")`.

---

## 7. Integration with API & Stock Triggers

### 7.1 Existing Outbox Event Producer
In `apps/api/src/modules/inventory/inventory.service.ts` (lines 302–371), stock adjustments evaluate transitions:
```ts
const transition = evaluateStockThresholdTransition(previousQuantity, newQuantity, item.lowStockThreshold);
if (transition.shouldNotify && transition.eventType) {
  // Queries active notificationPreferences (emailEnabled / whatsappEnabled)
  // Inserts notificationEvents with status = 'PENDING'
}
```

### 7.2 Deduplication Behavior
`evaluateStockThresholdTransition` in `packages/contracts/src/inventory/transition.ts`:
- Safe -> Low/Out: `shouldNotify: true`
- Low -> Further Low: `shouldNotify: false` (deduplicated!)
- Replenished -> Safe: `shouldNotify: false`

The database will only receive events for valid state transitions, guaranteeing zero alert spam.

---

## 8. Recommended File Structure for `apps/worker`

```text
apps/worker/
├── src/
│   ├── index.ts                      # Process bootstrap, signal handling (SIGTERM/SIGINT)
│   ├── config.ts                     # Environment configuration loader with sensible defaults
│   ├── daemon.ts                     # NotificationDaemon class (loop management, timer, pollOnce)
│   ├── polling/
│   │   ├── outbox-poller.ts          # FOR UPDATE SKIP LOCKED transaction claim logic
│   │   └── types.ts                  # Event & Poller types
│   ├── processors/
│   │   ├── event-processor.ts        # Single-event dispatcher & status updater (SENT / FAILED)
│   │   └── retry.ts                  # calculateExponentialBackoff logic
│   └── adapters/
│       ├── types.ts                  # NotificationAdapter interface
│       ├── email.adapter.ts          # Email channel adapter
│       ├── whatsapp.adapter.ts       # WhatsApp channel adapter with +62 normalization
│       └── adapter-factory.ts        # Adapter registry / resolver
├── __tests__/
│   ├── backoff.test.ts               # Unit test for exponential backoff calculation
│   ├── adapters.test.ts              # Unit test for email & whatsapp phone formatting
│   └── daemon.test.ts                # Unit test for daemon pollOnce integration
├── package.json
└── tsconfig.json
```

---

## 9. Concurrency & Safety Design

1. **Non-Overlapping Polling Loop:** The daemon must never schedule the next iteration via `setInterval`. Instead, use recursive `setTimeout` scheduled inside a `finally` block after the previous poll iteration completes.
2. **Transaction Isolation:** DB row locks are held only during candidate selection and status update to `PROCESSING`. The transaction commits before channel network I/O starts.
3. **Graceful Shutdown:** On `SIGINT`/`SIGTERM`:
   - Set `isShuttingDown = true`.
   - Clear scheduled timer.
   - Wait for currently active batch dispatch to complete.
   - Call `await queryClient.end()`.
   - Exit with code 0.
4. **Idempotency & Reclaim:** If a worker crashes while an event is in `PROCESSING`, the lease timeout (`nextRetryAt <= now()`) allows surviving worker nodes to reclaim and retry the event automatically.
