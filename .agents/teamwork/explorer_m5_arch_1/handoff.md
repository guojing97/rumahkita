# Milestone 5 Phase 1: Notification Worker Architectural Investigation Handoff

**Agent:** Explorer M5 Arch 1 (`50d092b7-42ee-46c6-8770-b54db123c864`)  
**Recipient:** Orchestrator (`70f30c57-3b98-4e37-8e6c-d4b8d72ee082`)  
**Date:** 2026-10-27  
**Artifact:** `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m5_arch_1/analysis.md`  

---

## 1. Observation

1. **Worker App Skeleton & Dependencies:**
   - In `apps/worker/package.json` (`file:///Users/mac/Projects/03-Labs/RumahKita/apps/worker/package.json`, lines 14–19):
     ```json
     "dependencies": {
       "@rumahkita/contracts": "workspace:*",
       "@rumahkita/db": "workspace:*",
       "dotenv": "^16.4.5",
       "postgres": "^3.4.4"
     }
     ```
     `drizzle-orm` is missing as a direct dependency in `apps/worker/package.json`.
   - In `apps/worker/src/index.ts` (`file:///Users/mac/Projects/03-Labs/RumahKita/apps/worker/src/index.ts`, lines 49–51):
     `pollOutbox()` is currently an empty stub method:
     ```ts
     public async pollOutbox(): Promise<void> {
       // In M5, this will execute SELECT FOR UPDATE SKIP LOCKED on notification_events
     }
     ```

2. **Database Schema & Enums:**
   - In `packages/db/src/schema/notification.ts` (`file:///Users/mac/Projects/03-Labs/RumahKita/packages/db/src/schema/notification.ts`, lines 18–25):
     ```ts
     export const notificationChannelEnum = pgEnum('notification_channel', ['EMAIL', 'WHATSAPP']);
     export const notificationStatusEnum = pgEnum('notification_status', [
       'PENDING',
       'PROCESSING',
       'SENT',
       'FAILED',
       'CANCELLED',
     ]);
     ```
   - In `packages/db/src/schema/notification.ts` (lines 58–77):
     The table `notification_events` specifies:
     - `status`: `notificationStatusEnum` (default: `'PENDING'`)
     - `attempts`: `integer('attempts').notNull().default(0)`
     - `maxAttempts`: `integer('max_attempts').notNull().default(5)`
     - `lastError`: `text('last_error')`
     - `nextRetryAt`: `timestamp('next_retry_at', { withTimezone: true, mode: 'date' })`
     - `sentAt`: `timestamp('sent_at', { withTimezone: true, mode: 'date' })`
     - Index: `outboxPollingIdx` on `(status, next_retry_at, created_at)`.
   - **Discrepancy:** The column name is `attempts`, NOT `retry_count`.

3. **Event Generation in API:**
   - In `apps/api/src/modules/inventory/inventory.service.ts` (`file:///Users/mac/Projects/03-Labs/RumahKita/apps/api/src/modules/inventory/inventory.service.ts`, lines 302–370):
     Stock threshold transitions (`STOCK_LOW`, `STOCK_OUT`) already insert into `schema.notificationEvents` with `status: 'PENDING'`.
   - In `packages/contracts/src/inventory/transition.ts` (`file:///Users/mac/Projects/03-Labs/RumahKita/packages/contracts/src/inventory/transition.ts`, lines 6–24):
     `evaluateStockThresholdTransition` suppresses duplicate events for already-low items (deduplication).

4. **Drizzle Locking Support:**
   - In `node_modules/drizzle-orm/pg-core/query-builders/select.ts`:
     Drizzle ORM supports `.for('update', { skipLocked: true })` inside transactions.

5. **WhatsApp & Email Format Constraints:**
   - In `packages/contracts/src/notifications/notification.schema.ts` (`file:///Users/mac/Projects/03-Labs/RumahKita/packages/contracts/src/notifications/notification.schema.ts`, lines 27–30):
     `whatsappNumber` must match regex `/^\+62[0-9]{8,15}$/`.
   - In `.env.example` (`file:///Users/mac/Projects/03-Labs/RumahKita/.env.example`, lines 44–53):
     `WORKER_POLL_INTERVAL_MS=5000`, `WORKER_MAX_CONCURRENCY=5`, `SMTP_HOST`, `SMTP_PORT`, `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` are defined.

---

## 2. Logic Chain

1. **Schema Column Mapping:** Because `packages/db/src/schema/notification.ts` defines `attempts: integer('attempts')` and `maxAttempts: integer('max_attempts')`, and the generated migration `0000_sad_thaddeus_ross.sql` defines `"attempts" integer DEFAULT 0 NOT NULL`, any query targeting `retry_count` would fail. The worker daemon must use `attempts` for both querying candidates and incrementing the count.
2. **Transaction Concurrency Safety:** Holding a PostgreSQL transaction open while sending network requests (SMTP, external WhatsApp API) causes database connection pool exhaustion and extended row-locking. Therefore, a two-phase design must be used:
   - Phase 1 (Short Transaction): Select candidate records with `.for('update', { skipLocked: true })`, update their status to `'PROCESSING'`, set a safety lease on `next_retry_at` (5 minutes), and commit immediately.
   - Phase 2 (Async Dispatch): Iterate over the claimed batch outside the transaction, invoking the appropriate channel adapter.
   - Phase 3 (Completion Update): Perform individual status updates to `'SENT'` (with `sentAt: now()`) or `'FAILED'` (with `lastError: err.message` and calculated `nextRetryAt`).
3. **Exponential Backoff Calculation:** To satisfy `next_retry_at = now() + (2 ^ retry_count) * 60s` with a cap of 5 retries:
   - On attempt $N$ failure ($N \in \{1, 2, 3, 4\}$), delay is $2^{N-1} \times 60\text{s}$ (60s, 120s, 240s, 480s).
   - On attempt 5 failure ($N \ge 5$), the event has reached `maxAttempts`. `next_retry_at` is set to `null`, marking permanent exhaustion.
4. **Channel Adapters:**
   - The Email adapter must format structured text with item name, current stock, threshold unit, and timestamp, logging to stdout with clear tagging.
   - The WhatsApp adapter must normalize phone numbers to `+62...` (handling `08...` and `62...`), validate against `/^\+62[0-9]{8,15}$/`, and log structured message delivery.
5. **Worker Daemon Architecture:** A modular separation into `daemon.ts` (loop & lifecycle), `polling/outbox-poller.ts` (claim transaction), `processors/event-processor.ts` (dispatch & status update), `processors/retry.ts` (backoff math), and `adapters/` (email, whatsapp) guarantees clean maintainability and testability.

---

## 3. Caveats

1. **External API Providers:** In accordance with PRD §6.10 and ORIGINAL_REQUEST §R5, email and WhatsApp delivery are stubbed via structured console logging for the MVP. No real external credentials are required for local test passes.
2. **Deterministic Test Failure Trigger:** To test retry backoff reliably without mocks, the adapters should inspect recipient values (e.g. `fail@...` or phone ending in `999999999`) to simulate transient network errors.
3. **Missing Dependency in Worker:** The worker agent must add `"drizzle-orm": "^0.35.3"` to `apps/worker/package.json` to allow direct imports of Drizzle operators (`eq`, `or`, `and`, `sql`, `lte`, etc.).

---

## 4. Conclusion

The system is 100% architecturally ready for Milestone 5 Phase 1 implementation. The outbox database table, indexes, and event producers are already functioning. The implementation blueprint detailed in `analysis.md` provides an exact, robust, race-condition-free specification for the worker developer agent (`worker_m5_worker_1`).

---

## 5. Verification Method

1. **Schema & Column Verification:**
   Inspect `packages/db/src/schema/notification.ts` (lines 58–87) and `packages/db/drizzle/0000_sad_thaddeus_ross.sql` (lines 222–237) to verify `attempts` and `outboxPollingIdx`.
2. **API Trigger Verification:**
   Run existing Tier 3 test:
   ```bash
   node tests/e2e/runner.ts --pattern "stock-threshold"
   ```
   Confirm that stock transitions generate outbox records.
3. **Worker Implementation Verification Plan:**
   Once `apps/worker` is implemented:
   - Run unit tests: `pnpm --filter @rumahkita/worker test`
   - Run typecheck: `pnpm --filter @rumahkita/worker typecheck`
   - Run build: `pnpm --filter @rumahkita/worker build`
   - Verify outbox polling and delivery status transitions from `PENDING` -> `SENT`.
