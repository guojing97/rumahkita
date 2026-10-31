# Milestone 5: Notification Worker & Outbox Processing — Technical Specification Analysis

**Author:** Spec Miner M5 Spec 2  
**Date:** 2026-10-27  
**Working Directory:** `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/spec_miner_m5_spec_2`  
**Target Milestone:** Milestone 5 (Notification Worker & Outbox Processing)  
**Authoritative Sources:**
- `ORIGINAL_REQUEST.md` (§R5, Acceptance Criteria)
- `Doc/prd.md` (§3, §6.3, §6.10, §7.D, §9, §10, §11, §13, §14)
- `Doc/design.md` (§4.9)
- `PROJECT.md` (§Architecture, §Feature Inventory #38–41, §Interface Contracts)
- `packages/db/src/schema/notification.ts`
- `packages/contracts/src/notifications/notification.schema.ts`
- `packages/contracts/src/inventory/transition.ts`
- `apps/api/src/modules/inventory/inventory.service.ts`
- `apps/api/src/modules/purchases/purchases.service.ts`
- `apps/api/src/modules/notifications/notifications.service.ts`
- `apps/worker/src/index.ts`

---

## 1. Executive Summary

Milestone 5 implements the **Transactional Outbox Pattern** and a robust background **Notification Worker Daemon** (`apps/worker`) to deliver inventory alerts (low stock and out of stock) via **Email** and **WhatsApp**.

The architecture decouples user-facing web mutations from external delivery providers (Resend/SMTP and WhatsApp Cloud API), guaranteeing zero loss of notification events, state-transition deduplication, multi-worker concurrency safety via PostgreSQL `FOR UPDATE SKIP LOCKED`, exponential backoff with dead-letter status, and graceful shutdown handling.

---

## 2. Technical Specification Breakdown

### 2.1 Trigger Conditions & Stock Threshold State Transitions (PRD §6.10, §10)

#### A. Trigger Events
Notification events are initiated strictly when an inventory mutation causes a stock level transition. Two domain endpoints trigger stock changes:
1. **Stock Adjustment** (`POST /api/v1/items/:id/stock-adjustments`):
   - Invoked via `InventoryService.adjustStock()`.
   - Mutation delta: `input.delta` (negative delta indicates usage, damage, or consumption).
   - Invariant: `newQuantity = previousQuantity + input.delta >= 0`. (Negative resulting stock is rejected with HTTP 422/400).
2. **Purchase Completion** (`POST /api/v1/purchases/:id/complete`):
   - Invoked via `PurchasesService.completePurchase()`.
   - Mutation delta: `+line.quantity` (increases stock).
   - Although evaluated, replenishments do not trigger alerts under the deduplication rule.

#### B. Stock Status Classification Model
The system defines three discrete inventory states per item (`calculateStockStatus` in `@rumahkita/contracts`):
- **Safe (`Aman` ✓)**: `quantityOnHand > lowStockThreshold` (and `> 0`)
- **Low (`Menipis` ⚠)**: `quantityOnHand <= lowStockThreshold && quantityOnHand > 0`
- **Out of Stock (`Habis` ✕)**: `quantityOnHand <= 0`

#### C. Transition Evaluation Function
The transition logic is encapsulated in `evaluateStockThresholdTransition` (`packages/contracts/src/inventory/transition.ts`):
```typescript
export interface StockThresholdEvaluation {
  shouldNotify: boolean;
  eventType: 'STOCK_LOW' | 'STOCK_OUT' | null;
}

export function evaluateStockThresholdTransition(
  previousQuantity: number,
  newQuantity: number,
  threshold: number
): StockThresholdEvaluation {
  // Case 1: Out of stock transition (had stock before, now 0 or less)
  if (previousQuantity > 0 && newQuantity <= 0) {
    return { shouldNotify: true, eventType: 'STOCK_OUT' };
  }

  // Case 2: Safe to Low stock transition (was above threshold, now at or below threshold but > 0)
  if (previousQuantity > threshold && newQuantity <= threshold && newQuantity > 0) {
    return { shouldNotify: true, eventType: 'STOCK_LOW' };
  }

  // Case 3: Already low or out, and further reduced: DO NOT NOTIFY (prevents alert spam)
  // Case 4: Stock replenished back above threshold: DO NOT NOTIFY
  return { shouldNotify: false, eventType: null };
}
```

#### D. Complete State Transition Matrix
| From State (`previousQuantity`) | To State (`newQuantity`) | Condition | `shouldNotify` | `eventType` | Business Rationale / Deduplication Rule |
|---|---|---|---|---|---|
| **Safe** (`> threshold`) | **Low** (`<= threshold && > 0`) | `previousQuantity > threshold && newQuantity <= threshold && newQuantity > 0` | **TRUE** | `'STOCK_LOW'` | Crosses threshold from safe to low. Fresh notification required. |
| **Safe** (`> threshold`) | **Out** (`<= 0`) | `previousQuantity > 0 && newQuantity <= 0` | **TRUE** | `'STOCK_OUT'` | Complete depletion in a single adjustment. Immediate alert required. |
| **Low** (`<= threshold && > 0`) | **Out** (`<= 0`) | `previousQuantity > 0 && newQuantity <= 0` | **TRUE** | `'STOCK_OUT'` | Escalation from low to fully exhausted. Critical alert required. |
| **Low** (`<= threshold && > 0`) | **Low** (`<= threshold && > 0`) | Further reduction (e.g., 2 -> 1 with threshold 3) | **FALSE** | `null` | **Deduplication:** Item was already low. Alert suppressed to prevent spam. |
| **Out** (`<= 0`) | **Out** (`<= 0`) | Zero adjustment or floor check | **FALSE** | `null` | **Deduplication:** Item was already empty. Alert suppressed. |
| **Low** (`<= threshold`) | **Safe** (`> threshold`) | Stock replenishment (purchase / restock) | **FALSE** | `null` | Recovery to safe level. No alarm triggered. Arms subsequent alerts. |
| **Out** (`<= 0`) | **Safe** (`> threshold`) | Stock replenishment | **FALSE** | `null` | Recovery to safe level. No alarm triggered. Arms subsequent alerts. |
| **Out** (`<= 0`) | **Low** (`<= threshold`) | Partial restock | **FALSE** | `null` | Upward movement. No alarm triggered. |

#### E. Transactional Outbox Guarantee
In `InventoryService.adjustStock()` and `PurchasesService.completePurchase()`, the insert into `notification_events` is executed **inside the identical PostgreSQL transaction (`tx`)** that updates `items` and inserts `stock_movements`.
- **Atomicity:** If the stock change succeeds, the notification event is guaranteed to exist in the database.
- **Rollback Safety:** If any validation or database constraint fails, neither stock nor notification event is saved.

---

### 2.2 Payload Schemas & Recipient Formatting Rules

#### A. Outbox Table Schema (`notification_events`)
From `packages/db/src/schema/notification.ts`:
| Column | Type | Constraints / Defaults | Description |
|---|---|---|---|
| `id` | `uuid` | Primary Key, `defaultRandom()` | Unique event identifier (UUID v4) |
| `household_id` | `uuid` | Not Null, FK -> `households.id` ON DELETE CASCADE | Household tenant identifier |
| `item_id` | `uuid` | Nullable, FK -> `items.id` ON DELETE CASCADE | Reference to affected inventory item |
| `event_type` | `varchar(50)` | Not Null | Event identifier: `'STOCK_LOW'` or `'STOCK_OUT'` |
| `channel` | `pgEnum('notification_channel')` | Not Null, default `'EMAIL'` | Delivery channel: `'EMAIL'` or `'WHATSAPP'` |
| `recipient` | `varchar(255)` | Not Null | Target address (email or WhatsApp phone) |
| `payload` | `jsonb` | Not Null | Structured event payload |
| `status` | `pgEnum('notification_status')` | Not Null, default `'PENDING'` | Lifecycle state: `'PENDING'`, `'PROCESSING'`, `'SENT'`, `'FAILED'`, `'CANCELLED'` |
| `attempts` | `integer` | Not Null, default `0` | Count of dispatch attempts made |
| `max_attempts` | `integer` | Not Null, default `5` | Maximum retry threshold before moving to `FAILED` |
| `last_error` | `text` | Nullable | Error message from most recent failed attempt |
| `next_retry_at` | `timestamptz` | Nullable | Scheduled timestamp for next retry execution |
| `sent_at` | `timestamptz` | Nullable | Timestamp when message was successfully delivered |
| `created_at` | `timestamptz` | Not Null, default `now()` | Outbox creation timestamp |

**Indexes:**
- `notification_events_outbox_polling_idx` on `(status, next_retry_at, created_at)`: Optimized for FIFO outbox queue polling.
- `notification_events_household_idx` on `(household_id)`.
- `notification_events_item_id_idx` on `(item_id)`.

#### B. Payload JSON Schema
Defined in `packages/contracts/src/notifications/notification.schema.ts` (`notificationEventPayloadSchema`):
```json
{
  "itemId": "00000000-0000-4000-a000-000000000402",
  "itemName": "Minyak Goreng 2L",
  "unit": "pouch",
  "currentStock": 1,
  "threshold": 2,
  "timestamp": "2026-10-27T19:30:00.000Z"
}
```
Field Specifications:
- `itemId`: Valid UUID string (`z.string().uuid()`).
- `itemName`: Plain string name of the item (`z.string()`).
- `unit`: Measurement unit (`z.string()`), e.g., `'kg'`, `'pack'`, `'pouch'`, `'liter'`, `'pcs'`.
- `currentStock`: Integer value of resulting quantity on hand (`z.number().int()`).
- `threshold`: Integer value of item's `lowStockThreshold` (`z.number().int()`).
- `timestamp`: ISO-8601 UTC timestamp string (`z.string()`).

#### C. Recipient Formatting & Validation Rules
1. **Email Channel (`EMAIL`)**:
   - **Validation:** Standard RFC 5322 email string per `z.string().email('Format email tidak valid')`.
   - **Normalization:** Trimming whitespace, lowercasing domain.
   - **Max Length:** 255 characters (`varchar(255)`).
   - **Fallback Recipient:** If household members have no email configured, fallback address is `'household@rumahkita.local'`.
2. **WhatsApp Channel (`WHATSAPP`)**:
   - **Validation:** Indonesian / International E.164 phone format per contract regex:
     ```regex
     /^\+62[0-9]{8,15}$/
     ```
   - **Prefix Requirement:** Must begin with `+62` followed by 8 to 15 numeric digits (e.g., `+6281234567890`).
   - **Validation Error Message:** `'Format nomor WhatsApp harus diawali +62 (contoh: +628123456789)'`.
   - **DB Column Length:** `varchar(30)` in `notification_preferences`.
   - **Cloud API Normalization:** For HTTP calls to Meta WhatsApp Business Cloud API, strip the leading `+` to yield numeric MSISDN `6281234567890`.

#### D. Rendered Message Templates
1. **Email Template (Resend / SMTP Adapter)**:
   - **Subject Line:**
     - `STOCK_LOW`: `[RumahKita] Peringatan: Stok Barang Menipis (${payload.itemName})`
     - `STOCK_OUT`: `[RumahKita] PERINGATAN: Stok Barang Habis (${payload.itemName})`
   - **From Address:** Configurable via `NOTIFICATION_FROM_EMAIL` (default: `RumahKita <notifikasi@rumahkita.local>`).
   - **Content:**
     - Greeting: "Halo Anggota Keluarga RumahKita,"
     - Status Alert: "Stok barang kebutuhan rumah tangga Anda telah mencapai ambang batas:"
     - Details Table:
       - Nama Barang: `{itemName}`
       - Sisa Stok Saat Ini: `{currentStock} {unit}`
       - Batas Minimum: `{threshold} {unit}`
       - Waktu Pencatatan: `{timestamp}` (formatted in `Asia/Jakarta` WIB)
     - Call to Action: "Segera lakukan pembelian atau tambahkan barang ini ke daftar belanjaan Anda."
2. **WhatsApp Template (Meta Cloud API / Stub Adapter)**:
   - **Body Structure:**
     ```text
     ⚠️ *Peringatan Stok RumahKita*
     
     Perhatian, stok barang berikut telah {{eventType === 'STOCK_OUT' ? 'HABIS' : 'MENIPIS'}}:
     • *Barang*: {{itemName}}
     • *Sisa Stok*: {{currentStock}} {{unit}}
     • *Batas Minimum*: {{threshold}} {{unit}}
     
     Segera lakukan pengecekan dan tambahkan ke daftar belanja rumah tangga Anda.
     ```

---

### 2.3 Notification Preference Rules

#### A. Scope & Hierarchy: User-Level within Household
- **Database Model:** Table `notification_preferences` possesses a composite unique index:
  `uniqueIndex('notification_preferences_household_user_idx').on(table.householdId, table.userId)`.
- **Architectural Scope:** **User-level preference scoped to a household**.
- **Rationale:** In a multi-member household (e.g., Budi and Ani), each partner manages their own alert subscriptions. One member may opt into WhatsApp alerts while the other prefers Email only.

#### B. Auto-Provisioning & Default Settings
When a user accesses `/api/v1/settings/notifications` or is invited to a household:
- If no record exists for `(householdId, userId)`:
  - `emailEnabled`: `true`
  - `emailAddress`: `user.email`
  - `whatsappEnabled`: `false`
  - `whatsappNumber`: `user.phoneNumber || null`

#### C. Outbox Broadcasting Across Household Members
When an inventory threshold transition occurs on an item belonging to household $H$:
1. Query all records from `notification_preferences` where `household_id = H`.
2. Filter active preferences: `p.emailEnabled === true || p.whatsappEnabled === true`.
3. For each active preference:
   - If `p.emailEnabled && p.emailAddress`: Create `notification_events` record with `channel = 'EMAIL'`, `recipient = p.emailAddress`.
   - If `p.whatsappEnabled && p.whatsappNumber`: Create `notification_events` record with `channel = 'WHATSAPP'`, `recipient = p.whatsappNumber`.
4. Fallback Rule: If no member has active notifications configured:
   - Create single fallback outbox event: `channel = 'EMAIL'`, `recipient = 'household@rumahkita.local'` to ensure audit visibility.

#### D. Quiet Hours & Scheduling Policy
- **Database Schema Finding:** Neither `notification_preferences` nor `households` contains quiet hours columns (`quiet_hours_start`, `quiet_hours_end`).
- **Policy:** Inventory shortage alerts are treated as high-priority state events dispatched immediately upon trigger.
- **Spam Mitigation:** State-transition deduplication (§2.1) serves as the primary spam prevention mechanism, rendering complex quiet-hour buffers unnecessary for the MVP.

---

### 2.4 Retry Policies, Exponential Backoff & Dead-Letter Handling

#### A. Retry State Machine
The lifecycle of an outbox event is governed by:
`PENDING` $\to$ `PROCESSING` $\to$ `SENT` (success)  
`PENDING` $\to$ `PROCESSING` $\to$ `PENDING` (transient failure with `next_retry_at`)  
`PENDING` $\to$ `PROCESSING` $\to$ `FAILED` (terminal failure when `attempts >= max_attempts`)

#### B. Constants & Parameters
- `max_attempts`: `5` (Column default in `packages/db/src/schema/notification.ts`).
- `base_delay_seconds`: `30` seconds (default configurable via `WORKER_BACKOFF_BASE_SEC`).
- `max_delay_seconds`: `1800` seconds (30 minutes cap).

#### C. Backoff Formula
For attempt number $k \in [1, \text{max\_attempts}]$:
$$\text{delay\_seconds} = \min\left(\text{max\_delay}, \text{base\_delay} \times 2^{k - 1}\right)$$

| Attempt ($k$) | Failure Event | Calculated Delay | Scheduled `next_retry_at` | Status |
|---|---|---|---|---|
| **1** | Initial dispatch fails | $30 \times 2^0 = 30\text{s}$ | $\text{now}() + 30\text{s}$ | `PENDING` |
| **2** | 1st retry fails | $30 \times 2^1 = 60\text{s}$ (1 min) | $\text{now}() + 60\text{s}$ | `PENDING` |
| **3** | 2nd retry fails | $30 \times 2^2 = 120\text{s}$ (2 min) | $\text{now}() + 120\text{s}$ | `PENDING` |
| **4** | 3rd retry fails | $30 \times 2^3 = 240\text{s}$ (4 min) | $\text{now}() + 240\text{s}$ | `PENDING` |
| **5** | 4th retry fails ($k \ge \text{max\_attempts}$) | Retries exhausted | `NULL` | **`FAILED` (Dead-Letter)** |

#### D. Dead-Letter Behavior
- Once `attempts >= max_attempts`:
  - `status` is set to `'FAILED'`.
  - `next_retry_at` is set to `null` (permanently excluded from active polling index).
  - `last_error` stores the full error message and stack trace.
  - An error log is emitted: `[Worker Dead-Letter] Event ${id} permanently failed after ${attempts} attempts: ${error}`.

---

### 2.5 Worker Process Lifecycle, Concurrency & Shutdown

#### A. Concurrency Safety: `FOR UPDATE SKIP LOCKED`
To support zero-contention parallel polling across multiple worker instances or threads, the outbox selection query must lock claimed rows while skipping rows currently held by another worker:
```sql
SELECT
  id,
  household_id,
  item_id,
  event_type,
  channel,
  recipient,
  payload,
  attempts,
  max_attempts
FROM notification_events
WHERE status = 'PENDING'
  AND (next_retry_at IS NULL OR next_retry_at <= NOW())
ORDER BY created_at ASC
LIMIT $1
FOR UPDATE SKIP LOCKED;
```

#### B. Polling Daemon Lifecycle
- **Poll Interval:** `WORKER_POLL_INTERVAL_MS` environment variable (default: `5000` ms, 500ms in fast-test mode).
- **Batch Size:** `WORKER_BATCH_SIZE` (default: `10` events per tick).
- **Execution States:**
  - `STOPPED`: Worker inactive.
  - `RUNNING`: Polling timer active; recurring calls to `pollOutbox()`.
  - `STOPPING`: Signal received; drain phase in progress.

#### C. Graceful Shutdown Protocol (SIGTERM & SIGINT)
When a termination signal (`SIGTERM` from Docker/Kubernetes or `SIGINT` from terminal) is received:
1. **Signal Interception:**
   ```typescript
   process.on('SIGTERM', () => worker.gracefulShutdown());
   process.on('SIGINT', () => worker.gracefulShutdown());
   ```
2. **Stop Ingestion:**
   - Set internal flag `isRunning = false`.
   - Clear scheduled timer: `clearTimeout(this.timer)`.
3. **In-Flight Job Draining:**
   - Track `isProcessing` / `activeBatchesCount`.
   - Await completion of current in-flight delivery promises.
   - Max drain timeout: `SHUTDOWN_TIMEOUT_MS = 10000` (10 seconds).
4. **Database Connection Teardown:**
   - Close Postgres connection pool: `await queryClient.end()`.
5. **Clean Exit:**
   - On clean drain: `process.exit(0)`.
   - On timeout expiry: log error and `process.exit(1)`.

---

## 3. Discovered Features & Edge Cases

## Features Discovered
| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Trigger | Safe -> Low Transition | Evaluates stock drop from above threshold to `<= threshold && > 0` | `previousQuantity > threshold`, `newQuantity <= threshold` | `shouldNotify: true`, `eventType: 'STOCK_LOW'` | Rejects negative resulting stock with HTTP 422 | `packages/contracts/src/inventory/transition.ts` |
| 2 | Trigger | Safe -> Out Transition | Evaluates stock drop from above threshold straight to `<= 0` | `previousQuantity > 0`, `newQuantity <= 0` | `shouldNotify: true`, `eventType: 'STOCK_OUT'` | Rejects negative resulting stock with HTTP 422 | `packages/contracts/src/inventory/transition.ts` |
| 3 | Trigger | Low -> Out Transition | Escalation alert when low stock drops to `<= 0` | `previousQuantity <= threshold && > 0`, `newQuantity <= 0` | `shouldNotify: true`, `eventType: 'STOCK_OUT'` | Rejects negative resulting stock with HTTP 422 | `packages/contracts/src/inventory/transition.ts` |
| 4 | Deduplication | Low -> Low Suppression | Suppresses duplicate alerts on repeated decrements while remaining low | `previousQuantity <= threshold`, `newQuantity <= threshold && > 0` | `shouldNotify: false`, `eventType: null` | No outbox record created; quiet pass | PRD §6.10, `transition.ts` Case 3 |
| 5 | Deduplication | Restock Suppression | Suppresses alerts when stock is replenished upward | `newQuantity > previousQuantity` | `shouldNotify: false`, `eventType: null` | No outbox record created; arms future alerts | PRD §6.10, `transition.ts` Case 4 |
| 6 | Outbox | Transactional Enqueue | Atomically inserts outbox rows in same DB transaction as stock changes | `tx: PgTransaction`, item, newQuantity | `notification_events` record inserted with status `'PENDING'` | If DB transaction rolls back, event is discarded | `apps/api/src/modules/inventory/inventory.service.ts` |
| 7 | Preference | User-Level Preferences | Multi-member household preference storage with compound unique key | `household_id`, `user_id` | `notification_preferences` row | Returns 404/403 if household membership invalid | `packages/db/src/schema/notification.ts` |
| 8 | Preference | Auto-Default Creation | Automatically seeds default preferences on first read | `household_id`, `user_id`, `user.email` | `emailEnabled: true`, `whatsappEnabled: false` | None | `apps/api/src/modules/notifications/notifications.service.ts` |
| 9 | Preference | Multi-Member Broadcast | Generates individual outbox records for each active member preference | Trigger event + household member preferences | 1 to $N$ outbox rows (Email/WhatsApp per member) | Fallback to `household@rumahkita.local` if none active | `apps/api/src/modules/inventory/inventory.service.ts` |
| 10 | Formatting | WhatsApp Number Validation | Enforces Indonesian E.164 phone formatting starting with `+62` | `whatsappNumber: string` | Validated E.164 string | Throws Zod error: `'Format nomor WhatsApp harus diawali +62'` | `packages/contracts/src/notifications/notification.schema.ts` |
| 11 | Formatting | Email Validation | Enforces RFC 5322 email formatting | `emailAddress: string` | Validated email string | Throws Zod error: `'Format email tidak valid'` | `packages/contracts/src/notifications/notification.schema.ts` |
| 12 | Worker | FIFO Outbox Polling | Selects unhandled events sorted by `created_at ASC` | Index on `(status, next_retry_at, created_at)` | Batch of `notification_events` rows | Logs poll errors and reschedules next poll | `packages/db/src/schema/notification.ts` |
| 13 | Concurrency | Row Locking with Skip | Prevents dual-processing via `SELECT FOR UPDATE SKIP LOCKED` | Database transaction | Exclusive row lock on claimed batch | Skipped rows processed by next available worker | `PROJECT.md` §Interface Contracts |
| 14 | Retry | Exponential Backoff | Schedules retry with $30 \times 2^{k-1}$ second backoff | Failed delivery attempt, `attempts < max_attempts` | `next_retry_at = now() + delay`, `status = 'PENDING'` | Updates `last_error` with error stack/message | `packages/db/src/schema/notification.ts` |
| 15 | Retry | Dead-Letter Status | Marks events that exceed 5 attempts as permanently failed | `attempts >= max_attempts` (5) | `status = 'FAILED'`, `next_retry_at = null` | Emits `[Worker Dead-Letter]` error log | `packages/db/src/schema/notification.ts` |
| 16 | Lifecycle | Graceful SIGTERM/SIGINT | Intercepts OS signals, stops timer, drains batch, closes pool | OS signal `SIGTERM` / `SIGINT` | Process exits with code 0 | Exits with code 1 if drain exceeds 10s timeout | `apps/worker/src/index.ts` |

## Edge Cases
| # | Feature | Input / Condition | Observed / Required Behavior |
|---|---------|-------------------|-----------------------------|
| 1 | Stock Adjustment Floor | Adjustment delta results in `newQuantity < 0` (e.g., current 2, delta -5) | Backend rejects with HTTP 422/400 (`'Stok tidak boleh negatif'`). No stock movement, no notification event created. |
| 2 | Zero Stock Threshold | Item configured with `lowStockThreshold = 0`. Stock drops from 2 to 0 | `previousQuantity > 0 && newQuantity <= 0` matches Case 1. Triggers `'STOCK_OUT'`. |
| 3 | Exact Threshold Boundary | Stock drops to exactly `lowStockThreshold` (e.g., 5 -> 3 with threshold 3) | Matches Case 2 (`newQuantity <= threshold && newQuantity > 0`). Triggers `'STOCK_LOW'`. |
| 4 | Rapid Consecutive Decrements | Item stock 5, threshold 3. Decrement 1 (5 -> 2) followed immediately by Decrement 2 (2 -> 1) | Decrement 1 creates 1 `'STOCK_LOW'` event. Decrement 2 matches Case 3 (`previousQuantity <= threshold`), creating 0 duplicate events. |
| 5 | Restock then Deplete Cycle | Item drops from 5 to 2 (`STOCK_LOW`), restocked to 10 (no alert), then consumed to 2 | Second consumption re-triggers `'STOCK_LOW'` because `previousQuantity` (10) was above threshold. |
| 6 | No Active Preferences | All household members have disabled both email and WhatsApp | System enqueues fallback event to `household@rumahkita.local` with status `PENDING` so the event is not silently lost. |
| 7 | Cross-Household Access | Member of Household A attempts to update notification preferences of Household B | NestJS `HouseholdGuard` enforces tenant boundary and rejects with HTTP 403. |
| 8 | Transient Network Outage | Resend / WhatsApp API returns HTTP 503 or network timeout on attempt 1 | Worker catches error, increments `attempts` to 1, sets `next_retry_at = now() + 30s`, retains `status = 'PENDING'`. |
| 9 | Repeated Permanent Outage | Resend / WhatsApp API remains unreachable for 5 consecutive attempts | On 5th failure, `attempts` reaches `max_attempts` (5). Worker sets `status = 'FAILED'`, `next_retry_at = null`, records error in `last_error`. |
| 10 | SIGTERM During Active Batch | OS issues `SIGTERM` while worker is executing HTTP requests for batch | Worker clears polling timer, awaits in-flight batch promises, commits final statuses to DB, closes PG client, exits with code 0. |
| 11 | WhatsApp Leading Plus Stripping | User configures number `+6281234567890` | Contracts validate with `+62`. WhatsApp Cloud API adapter strips `+` to pass MSISDN `6281234567890` to Meta API. |
| 12 | Item Deletion Cascade | Inventory item is soft/hard deleted while outbox event is pending | Foreign key `ON DELETE CASCADE` removes pending outbox rows or worker checks item validity. |
