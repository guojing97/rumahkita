# Comprehensive Analysis: E2E Test Suite & Outbox Event Integration

**Document Version:** 1.0.0  
**Date:** 2026-10-27  
**Agent:** Explorer M5 E2E 3 (`explorer_m5_e2e_3`)  
**Scope:** Opaque-Box E2E Test Suite, Outbox Event Insertion, Worker Integration, Runner Prerequisites, and M5 Pass-Rate Guarantee  

---

## 1. Executive Summary

This report delivers a full architectural investigation of the existing End-to-End (E2E) test suite (`tests/e2e/`) and its integration with the transactional notification outbox system (`notification_events`) in the RumahKita monorepo.

Key verified facts:
1. **Test Suite Scope:** The test suite consists of **19 test files** totaling **56 test cases** spanning 4 verification tiers (Tier 1: Feature Coverage [28 tests], Tier 2: Boundary & Corner Cases [19 tests], Tier 3: Cross-Feature Interactions [7 tests], Tier 4: Real-World Persona Scenarios [2 scenario suites]).
2. **Outbox Event Triggering in `apps/api`:** Outbox events are created within database transactions in `apps/api/src/modules/inventory/inventory.service.ts` (`adjustStock`) and `apps/api/src/modules/purchases/purchases.service.ts` (`completePurchase`). Stock transitions are evaluated using `@rumahkita/contracts` (`evaluateStockThresholdTransition`), generating `STOCK_LOW` or `STOCK_OUT` events with state-transition deduplication.
3. **E2E Test Expectations:** In accordance with opaque-box principles (`TEST_INFRA.md`), the 56 tests in `tests/e2e` interact strictly over HTTP (`/api/v1`). In `stock-threshold-outbox-events.test.ts` (T3.5, T3.6), the suite verifies threshold transitions through `POST /items/:id/stock-adjustments` and checks user-visible side effects on `GET /dashboard` (`lowStockItems`). The tests do NOT query the internal `notification_events` database table directly.
4. **Critical Port & URL Mismatch:** In `.env`, `API_PORT=4000`, causing `apps/api` to listen on port 4000. However, `tests/e2e/config.ts` defaults `API_BASE_URL` to `http://localhost:3001/api/v1`. Running `node tests/e2e/runner.ts` without an explicit `API_BASE_URL` override will fail at the healthcheck stage.
5. **Worker Daemon Interaction:** The worker daemon (`apps/worker`) runs asynchronously and polls `notification_events`. For live runs alongside the API and test suite, the worker must employ PostgreSQL's `SELECT ... FOR UPDATE SKIP LOCKED` to prevent table contention or deadlocks with concurrent API transactions.

---

## 2. Test Suite Architecture & Inventory

The E2E test harness is implemented in `tests/e2e/` using native Node.js test primitives (`node:test`, `node:assert/strict`) and native `fetch` with an in-memory RFC 6265 `CookieJar` (`tests/e2e/client/api-client.ts`). The test runner orchestrator is `tests/e2e/runner.ts`.

### 2.1 Complete Test Inventory by Tier

| Tier | Directory | Files | Tests | Invariants & Endpoints Covered |
|---|---|---|---|---|
| **Tier 1: Feature Coverage** | `tests/e2e/tier1-feature-coverage/` | 8 | 28 | Auth (`/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/logout-all`, `/auth/password/forgot`), Household (`/household`), Master Data (`/income-sources`, `/income-categories`, `/expense-categories`), Incomes (`/incomes`), Expenses (`/expenses`), Inventory (`/items`, `/items/:id/stock-adjustments`), Purchases (`/purchases`, `/purchases/:id/cancel`), Debts/Receivables (`/debts-receivables`, `/debts-receivables/:id/payments`), Dashboard & Reports (`/dashboard`, `/reports/monthly`, `/reports/yearly`, `/reports/export/csv`) |
| **Tier 2: Boundary & Corner Cases** | `tests/e2e/tier2-boundary-corner/` | 5 | 19 | Zero/negative nominal validation (HTTP 422), missing category validation, max Rupiah (`999,999,999,999`) handling, missing stock adjustment reason, negative stock prevention, exact 0 stock `Habis` transition, exact threshold `Menipis` transition, debt balance overpayment, unauthenticated 401, forged JWT 401, cross-household 403, refresh token reuse family revocation, 12-month empty year zero-continuity, malformed date validation |
| **Tier 3: Cross-Feature Interactions** | `tests/e2e/tier3-cross-feature/` | 4 | 7 | Atomic purchase completion (creates expense + increments inventory + logs movement) [T3.1], purchase completion idempotency [T3.2], duplicate completion prevention [T3.3], debt lifecycle (`open` $\to$ `partially_paid` $\to$ `settled`) [T3.4], stock threshold outbox event triggering [T3.5], outbox alert deduplication [T3.6], cross-household isolation guard [T3.7] |
| **Tier 4: Real-World Scenarios** | `tests/e2e/tier4-scenarios/` | 2 | 2 | Full monthly household operational cycle (salary $\to$ utilities $\to$ multi-line purchase $\to$ stock consumption $\to$ loan payment $\to$ monthly report reconciliation $\to$ CSV export) [T4.1]; Multi-member household collaboration (Owner and Member sharing budget, dashboard, and inventory in real time) [T4.2] |
| **Total** | `tests/e2e/**` | **19** | **56** | **100% Requirement Coverage** |

### 2.2 Deep Dive: Notification & Outbox Test Suites

The primary outbox test file is `tests/e2e/tier3-cross-feature/stock-threshold-outbox-events.test.ts`.

#### Test Case T3.5: Transition from Safe to Low Stock
- **Setup:** Creates an inventory item fixture with `quantityOnHand: 8` and `lowStockThreshold: 3`. State is `Aman` ($8 > 3$).
- **Trigger:** Calls `POST /items/:id/stock-adjustments` with `{ delta: -6, reason: 'Pemakaian dapur besar' }`.
- **Assertions:**
  - `adjRes.status === 200`
  - `Number(adjRes.body.data.newQuantity) === 2`
  - `adjRes.body.data.status === 'Menipis'`
  - Calls `GET /dashboard`, asserts that `dashRes.body.data.lowStockItems` contains the item ID.

#### Test Case T3.6: Deduplication on Already-Low Items
- **Setup:** Creates an inventory item fixture with `quantityOnHand: 2` and `lowStockThreshold: 3`. State is already `Menipis` ($2 \le 3$).
- **Trigger:** Calls `POST /items/:id/stock-adjustments` with `{ delta: -1, reason: 'Pemakaian lanjutan' }`.
- **Assertions:**
  - `adjRes.status === 200`
  - `Number(adjRes.body.data.newQuantity) === 1`
  - `adjRes.body.data.status === 'Menipis'`
  - Calls `GET /dashboard`, asserts that `dashRes.body.data.lowStockItems` lists the item with updated `currentStock = 1`.

#### Related Test Cases:
- **T4.1 (`monthly-household-cycle.test.ts`):** In Step 3, a completed purchase restocks `Beras` from 1 to 3 (`Aman`). In Step 4, an adjustment reduces stock to 1, causing a transition to `Menipis`.
- **T1.19 (`inventory.test.ts`):** Tests status computation for `Aman`, `Menipis`, and `Habis`.
- **T2.8 & T2.9 (`inventory-boundaries.test.ts`):** Tests boundary transitions for exact 0 (`Habis`) and exact threshold (`Menipis`).

---

## 3. Outbox Event Generation in `apps/api`

### 3.1 Contract: State Transition Logic

The evaluation logic resides in `packages/contracts/src/inventory/transition.ts`:

```typescript
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

### 3.2 Insertion Triggers in the Backend

Two API services write to `notification_events`:

1. **`apps/api/src/modules/inventory/inventory.service.ts` (`adjustStock`, lines 295–371):**
   - Executed inside a PostgreSQL transaction with pessimistic row lock (`FOR UPDATE` on `items`).
   - Computes transition via `evaluateStockThresholdTransition`.
   - If `transition.shouldNotify === true`:
     - Queries `notification_preferences` for the household.
     - Iterates over active preferences (`emailEnabled` and/or `whatsappEnabled`).
     - Inserts a row into `notification_events` with `status: 'PENDING'` for each active channel.
     - If no active preferences exist, inserts a fallback default email event to `household@rumahkita.local`.

2. **`apps/api/src/modules/purchases/purchases.service.ts` (`completePurchase`, lines 320–345):**
   - Executed inside a PostgreSQL transaction with pessimistic row lock on `purchases` and all referenced `items`.
   - Evaluates transition on stock replenishment. (Normally purchases increment stock, but the transition helper is evaluated for consistency).
   - If notification is indicated, inserts into `notification_events` with `status: 'PENDING'`.

### 3.3 Database Schema: `notification_events` Table

Located in `packages/db/src/schema/notification.ts`:

```typescript
export const notificationEvents = pgTable(
  'notification_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id').references(() => items.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 50 }).notNull(), // 'STOCK_LOW' | 'STOCK_OUT'
    channel: notificationChannelEnum('channel').notNull().default('EMAIL'), // 'EMAIL' | 'WHATSAPP'
    recipient: varchar('recipient', { length: 255 }).notNull(),
    payload: jsonb('payload').notNull(),
    status: notificationStatusEnum('status').notNull().default('PENDING'), // 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELLED'
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(5),
    lastError: text('last_error'),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true, mode: 'date' }),
    sentAt: timestamp('sent_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    outboxPollingIdx: index('notification_events_outbox_polling_idx').on(
      table.status,
      table.nextRetryAt,
      table.createdAt
    ),
    householdIdx: index('notification_events_household_idx').on(table.householdId),
    itemIdIdx: index('notification_events_item_id_idx').on(table.itemId),
  })
);
```

---

## 4. Worker Daemon Expectations & Behavior

### 4.1 Opaque-Box vs. White-Box Expectations

1. **Opaque-Box E2E Tests (`tests/e2e/runner.ts`):**
   - The 56 E2E tests are strictly HTTP-level black-box tests. They verify that the backend API properly accepts stock adjustments and that the frontend dashboard endpoint aggregates low-stock alerts.
   - The test suite does NOT assert on the internal `status` of `notification_events` or depend on the worker daemon process running.
   - However, if the worker daemon is running concurrently during test runs, it must NOT lock rows in a manner that blocks API stock adjustments or transactions.

2. **System Acceptance Criteria (`ORIGINAL_REQUEST.md` § Acceptance Criteria § Notifications):**
   - *"Completing a purchase that brings stock from above threshold to at/below threshold creates a notification event"*
   - *"A second stock check on an already-low item does not create a duplicate notification event"*
   - *"Worker processes the event and updates `notification_events.status`"*
   - In M5 Phase 2, automated unit/integration tests and code reviews will verify that the worker daemon correctly polls `notification_events`, transitions rows `PENDING` $\to$ `PROCESSING` $\to$ `SENT` (or `FAILED` with backoff), and writes delivery log messages for Email and WhatsApp stubs.

### 4.2 Concurrency & Outbox Polling Contract

The worker implementation must adhere to these transactional requirements:
1. **Locking Strategy:** Use `SELECT ... FROM notification_events WHERE status = 'PENDING' OR (status = 'FAILED' AND next_retry_at <= NOW() AND attempts < max_attempts) ORDER BY created_at ASC LIMIT :batchSize FOR UPDATE SKIP LOCKED`.
   - `SKIP LOCKED` ensures that if multiple worker workers or API transactions access the table, workers do not deadlock or block pending insertions.
2. **Status Progression:**
   - On claim: `UPDATE notification_events SET status = 'PROCESSING', attempts = attempts + 1 WHERE id = :id`.
   - On successful delivery stub: `UPDATE notification_events SET status = 'SENT', sent_at = NOW() WHERE id = :id`.
   - On delivery failure: compute exponential backoff (`next_retry_at = NOW() + (2 ^ attempts * baseDelay)`), set `status = (attempts >= max_attempts ? 'FAILED' : 'PENDING')`, record `last_error`.
3. **Graceful Shutdown:** On `SIGTERM` / `SIGINT`, cancel the polling timer, await in-flight batch delivery, release active transactions, and exit with code 0.

---

## 5. Prerequisite Setup for 100% Pass Rate on `runner.ts`

### 5.1 The Port & Environment Variable Discrepancy

There is a critical mismatch between default configuration files:
- **In `.env`:**
  ```env
  API_PORT=4000
  ```
- **In `apps/api/src/main.ts` (line 65):**
  ```typescript
  const port = process.env.API_PORT || process.env.PORT || 3001;
  ```
  Since `.env` defines `API_PORT=4000`, the NestJS API server binds to `http://localhost:4000/api/v1`.
- **In `tests/e2e/config.ts` (line 8):**
  ```typescript
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3001/api/v1',
  ```
  If executed as `node tests/e2e/runner.ts` without an environment variable, `runner.ts` queries port 3001 and fails with:
  ```text
  [Healthcheck Warning] Target API is currently unreachable at http://localhost:3001/api/v1.
  ```

**Mandatory Resolution:** The test runner must be executed with:
```bash
API_BASE_URL=http://localhost:4000/api/v1 node tests/e2e/runner.ts
```

### 5.2 Complete Step-by-Step Prerequisite Workflow

To achieve 56/56 passing tests (100% pass rate):

#### 1. PostgreSQL Container Running
```bash
docker compose up -d
```
Verify PostgreSQL is reachable on `localhost:5432` (`postgres://rumahkita:rumahkita_dev_password@localhost:5432/rumahkita`).

#### 2. Clean Migrations & Seed Baseline
The test suite depends on the seeded baseline accounts:
- Owner: `budi@rumahkita.local` / `Password123!`
- Member: `ani@rumahkita.local` / `Password123!`
- Other Household: `joko@rumahkita.local` / `Password123!`

Apply migrations and seed:
```bash
pnpm --filter @rumahkita/db db:migrate
pnpm --filter @rumahkita/db db:seed
```
*Note: The seeder runs `TRUNCATE ... CASCADE` internally, ensuring a clean deterministic state even when re-run.*

#### 3. Backend API Running on Port 4000
Start the API in development mode:
```bash
pnpm --filter @rumahkita/api dev
```
Wait until the console displays:
```text
[RumahKita API] Server running at http://localhost:4000/api/v1
```

#### 4. Notification Worker Running (Optional for HTTP E2E, Required for M5 Scope)
Start the worker daemon:
```bash
pnpm --filter @rumahkita/worker dev
```

#### 5. Execute E2E Test Suite
Run all 56 tests across all 4 tiers:
```bash
API_BASE_URL=http://localhost:4000/api/v1 node tests/e2e/runner.ts
```
Expected output:
```text
============================================================
 RumahKita Opaque-Box E2E Test Suite
 Target API:  http://localhost:4000/api/v1
============================================================

[Healthcheck] Verifying connectivity to http://localhost:4000/api/v1/household...
[Healthcheck] API is reachable (HTTP 401). Proceeding with tests.

Discovered 19 test suite file(s). Running...

...
[PASS] All test suites completed successfully.
```

---

## 6. Actionable Recommendations for the Worker Agent

To guarantee full completion of Milestone 5 and 100% verification compliance, the implementing worker agent should execute the following actions:

1. **Implement `apps/worker/src/index.ts` Polling Engine:**
   - Instantiate a database connection using the monorepo's `@rumahkita/db` drizzle client or `postgres` connection pool.
   - In `pollOutbox()`:
     - Execute a transactional query with `FOR UPDATE SKIP LOCKED`.
     - Claim up to `WORKER_MAX_CONCURRENCY` (default: 5) rows where `status IN ('PENDING', 'FAILED')` and `(next_retry_at IS NULL OR next_retry_at <= NOW())` and `attempts < max_attempts`.
     - Update claimed rows to `status = 'PROCESSING'`.
2. **Channel Adapters (Email & WhatsApp Stubs):**
   - Structure clean delivery functions for `EMAIL` and `WHATSAPP`:
     - Email stub logs: `[Worker][Email] Sending stock alert to ${recipient}: ${payload.itemName} is ${payload.currentStock} ${payload.unit}`.
     - WhatsApp stub logs: `[Worker][WhatsApp] Sending alert to ${recipient}: ${payload.itemName} (${payload.currentStock} left)`.
   - Update event status to `SENT` and record `sentAt = new Date()`.
3. **Exponential Backoff & Failure Handling:**
   - If delivery throws, increment `attempts`.
   - If `attempts >= maxAttempts`, set `status = 'FAILED'`, record `lastError`.
   - If `attempts < maxAttempts`, set `status = 'PENDING'`, compute `nextRetryAt = new Date(Date.now() + Math.pow(2, attempts) * 1000)`.
4. **Graceful Daemon Shutdown:**
   - Listen on `SIGINT` and `SIGTERM`.
   - Clear timer, wait for in-flight promises to settle, close database connection pool cleanly.
5. **Add E2E Convenience Command in Monorepo Root `package.json`:**
   - Add a root script: `"test:e2e": "API_BASE_URL=http://localhost:4000/api/v1 node tests/e2e/runner.ts"`.
   - This eliminates human error regarding the port 4000 vs 3001 difference.
