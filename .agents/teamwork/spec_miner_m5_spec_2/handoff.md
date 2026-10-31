# Milestone 5: Notification Worker & Outbox Processing — Handoff Report

**Agent:** Spec Miner M5 Spec 2 (`spec_miner_m5_spec_2`)  
**Date:** 2026-10-27  
**Destination Path:** `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/spec_miner_m5_spec_2/handoff.md`  
**Handoff Type:** Hard (Task Complete)

---

## 1. Observation

Direct observations from authoritative project sources and codebase files:

1. **Transactional Outbox Database Schema (`packages/db/src/schema/notification.ts`):**
   - Lines 18–25: Enums defined:
     ```typescript
     export const notificationChannelEnum = pgEnum('notification_channel', ['EMAIL', 'WHATSAPP']);
     export const notificationStatusEnum = pgEnum('notification_status', [
       'PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED'
     ]);
     ```
   - Lines 57–87: `notification_events` table contains:
     - `id`: `uuid` PK default random
     - `household_id`: `uuid` FK -> `households.id` ON DELETE CASCADE
     - `item_id`: `uuid` FK -> `items.id` ON DELETE CASCADE (nullable)
     - `event_type`: `varchar(50)` NOT NULL
     - `channel`: `notification_channel` NOT NULL DEFAULT `'EMAIL'`
     - `recipient`: `varchar(255)` NOT NULL
     - `payload`: `jsonb` NOT NULL
     - `status`: `notification_status` NOT NULL DEFAULT `'PENDING'`
     - `attempts`: `integer` NOT NULL DEFAULT `0`
     - `max_attempts`: `integer` NOT NULL DEFAULT `5`
     - `last_error`: `text` nullable
     - `next_retry_at`: `timestamptz` nullable
     - `sent_at`: `timestamptz` nullable
     - `created_at`: `timestamptz` NOT NULL DEFAULT NOW()
     - Index `notification_events_outbox_polling_idx` on `(status, next_retry_at, created_at)`.
   - Lines 27–55: `notification_preferences` table contains:
     - `household_id`: `uuid` FK
     - `user_id`: `uuid` FK
     - `email_enabled`: `boolean` default `true`
     - `email_address`: `varchar(255)`
     - `whatsapp_enabled`: `boolean` default `false`
     - `whatsapp_number`: `varchar(30)`
     - `uniqueIndex('notification_preferences_household_user_idx').on(table.householdId, table.userId)`.

2. **Deduplication & State Transition Function (`packages/contracts/src/inventory/transition.ts`):**
   - Lines 6–24:
     ```typescript
     export function evaluateStockThresholdTransition(
       previousQuantity: number,
       newQuantity: number,
       threshold: number
     ): StockThresholdEvaluation {
       if (previousQuantity > 0 && newQuantity <= 0) {
         return { shouldNotify: true, eventType: 'STOCK_OUT' };
       }
       if (previousQuantity > threshold && newQuantity <= threshold && newQuantity > 0) {
         return { shouldNotify: true, eventType: 'STOCK_LOW' };
       }
       return { shouldNotify: false, eventType: null };
     }
     ```

3. **Atomic Outbox Insertion in Backend API (`apps/api/src/modules/inventory/inventory.service.ts`):**
   - Lines 280–370: Inside `await this.db.transaction(async (tx) => { ... })`:
     - Checks `if (newQuantity < 0) throw new BadRequestException('Stok tidak boleh negatif');`
     - Inserts `schema.stockMovements`
     - Evaluates `evaluateStockThresholdTransition(previousQuantity, newQuantity, item.lowStockThreshold)`
     - Queries `schema.notificationPreferences.where(eq(householdId))`
     - If preferences active: inserts `schema.notificationEvents` for each active channel (EMAIL / WHATSAPP)
     - Fallback: inserts event to `'household@rumahkita.local'` if no preferences active.

4. **Validation Contracts (`packages/contracts/src/notifications/notification.schema.ts`):**
   - Lines 27–31: WhatsApp format regex:
     `whatsappNumber: z.string().regex(/^\+62[0-9]{8,15}$/, 'Format nomor WhatsApp harus diawali +62 (contoh: +628123456789)')`
   - Lines 36–43: Payload schema:
     ```typescript
     export const notificationEventPayloadSchema = z.object({
       itemId: z.string().uuid(),
       itemName: z.string(),
       unit: z.string(),
       currentStock: z.number().int(),
       threshold: z.number().int(),
       timestamp: z.string(),
     });
     ```

5. **Worker Daemon Baseline (`apps/worker/src/index.ts`):**
   - Lines 6–66: Current stub imports `dotenv`, defines `NotificationWorker` with `pollIntervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS) || 5000;`, and binds SIGTERM/SIGINT listeners.

---

## 2. Logic Chain

1. **Trigger Condition Chain:**
   - From Observation 3, when a user posts a stock adjustment, the stock quantity is updated.
   - From Observation 2, `evaluateStockThresholdTransition` evaluates whether a transition from `Safe` to `Low`, `Safe` to `Out`, or `Low` to `Out` occurred.
   - If stock was already low (`previousQuantity <= threshold`) and is further decremented to a positive quantity (`newQuantity > 0`), neither condition matches, returning `{ shouldNotify: false, eventType: null }`.
   - Therefore, deduplication operates strictly at the state transition level: consecutive low stock events are suppressed without requiring an arbitrary timed cache.

2. **Recipient & Channel Preferences Chain:**
   - From Observation 1, `notification_preferences` has a unique compound index on `(household_id, user_id)`.
   - From Observation 3, when an alert event is generated, all active member preferences within that household are queried.
   - For each active member, an outbox row is created per enabled channel (`EMAIL` and/or `WHATSAPP`).
   - If no active preferences exist, the fallback recipient `household@rumahkita.local` is enqueued to ensure that events remain observable in the outbox.

3. **Retry & Backoff Chain:**
   - From Observation 1, `notification_events` has `max_attempts` defaulting to `5`, `attempts` defaulting to `0`, `next_retry_at`, and `last_error`.
   - Standard exponential backoff dictates that on failure $k$, `delay = base_delay * 2^(k - 1)`.
   - For $k = 1, 2, 3, 4$, with base delay 30s, delays are 30s, 60s, 120s, 240s, and `status` remains `'PENDING'`.
   - For $k \ge 5$, retries are exhausted; `status` transitions to `'FAILED'` (Dead-Letter) and `next_retry_at` is set to `null`, removing the row from the FIFO polling index.

4. **Worker Lifecycle & Concurrency Chain:**
   - From Observation 1 and `PROJECT.md` §Interface Contracts, concurrent worker workers must poll the outbox using `SELECT ... WHERE status = 'PENDING' AND (next_retry_at IS NULL OR next_retry_at <= NOW()) ORDER BY created_at ASC LIMIT 10 FOR UPDATE SKIP LOCKED`.
   - This ensures multiple worker instances do not lock or duplicate the processing of the same notification.
   - From Observation 5, on SIGTERM/SIGINT, the worker stops the polling timer, awaits in-flight batch execution up to a 10s shutdown timeout, terminates the Postgres pool connection, and exits with code 0.

---

## 3. Caveats

1. **Quiet Hours:** The database schema (`notification_preferences`) does not contain quiet hours columns (`quiet_hours_start`, `quiet_hours_end`). As verified in `Doc/prd.md` §6.10, the primary anti-spam guarantee is state-transition deduplication rather than quiet-hour suppression.
2. **Channel Delivery Stubs:** In the MVP environment, actual Resend API keys or Meta WhatsApp Cloud API credentials may not be configured; the worker must implement stub adapters with structured console logging for dev/test execution while retaining full schema and status updates in the database.

---

## 4. Conclusion

All 5 core technical specification questions for Milestone 5 have been fully mined, mapped, and documented:
1. **Triggers & Transitions:** Evaluated via `evaluateStockThresholdTransition` in `@rumahkita/contracts`. Triggers on Safe->Low (`STOCK_LOW`), Safe->Out (`STOCK_OUT`), and Low->Out (`STOCK_OUT`). Deduplication suppresses Low->Low and Restock->Safe.
2. **Payload & Formatting:** JSON payload containing `{ itemId, itemName, unit, currentStock, threshold, timestamp }`. Email requires valid RFC 5322 string. WhatsApp requires E.164 string matching `/^\+62[0-9]{8,15}$/` (normalized by stripping `+` for Cloud API).
3. **Preferences:** User-level within household via `(household_id, user_id)`. Broadcasts to all active members in the household. Fallback to `household@rumahkita.local`.
4. **Retries:** Max 5 attempts. Exponential backoff $30 \times 2^{k-1}$ seconds. Terminal failure transitions to `'FAILED'` (Dead-Letter).
5. **Lifecycle:** Polling loop via `FOR UPDATE SKIP LOCKED`. Graceful shutdown intercepts SIGTERM/SIGINT, drains in-flight jobs within 10s, closes Postgres connection, and exits cleanly.

All specifications, feature discovery tables, and edge case inventories are documented in:
`/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/spec_miner_m5_spec_2/analysis.md`.

---

## 5. Verification Method

To independently verify the mined specification contracts:

1. **Inspect Transition Logic & Unit Tests:**
   ```bash
   pnpm --filter @rumahkita/contracts test
   ```
   Inspect `packages/contracts/src/inventory/transition.ts` and `packages/contracts/src/__tests__/contracts.test.ts`.

2. **Inspect Database Outbox Schema:**
   Inspect `packages/db/src/schema/notification.ts` lines 18–87 to verify enums, columns, constraints, and indexes.

3. **Inspect Inventory Outbox Insertion:**
   Inspect `apps/api/src/modules/inventory/inventory.service.ts` lines 295–370.

4. **Verify Outbox Deduplication E2E Test:**
   ```bash
   node tests/e2e/runner.ts --tier 3
   ```
   Inspect test file `tests/e2e/tier3-cross-feature/stock-threshold-outbox-events.test.ts`.
