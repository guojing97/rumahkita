# Handoff Report: E2E Test Suite & Outbox Event Integration

**Agent:** Explorer M5 E2E 3 (`explorer_m5_e2e_3`)  
**Target:** Orchestrator (`70f30c57-3b98-4e37-8e6c-d4b8d72ee082`) & Worker Agent  
**Date:** 2026-10-27  
**Status:** COMPLETE (Hard Handoff)  

---

## 1. Observation

1. **Test Runner & Test Inventory:**
   - In `tests/e2e/runner.ts` (lines 6–11, 125–136): Discovers all `*.test.ts` files across four directories:
     - `tier1-feature-coverage` (8 files, 28 tests)
     - `tier2-boundary-corner` (5 files, 19 tests)
     - `tier3-cross-feature` (4 files, 7 tests)
     - `tier4-scenarios` (2 files, 2 scenario tests)
     - Total: **19 files**, **56 tests**.
   - In `tests/e2e/config.ts` (lines 8–30):
     - Line 8: `API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3001/api/v1'`
     - Lines 14–30: Seeded test users:
       - `OWNER`: `budi@rumahkita.local` / `Password123!`
       - `MEMBER`: `ani@rumahkita.local` / `Password123!`
       - `OTHER_HOUSEHOLD`: `joko@rumahkita.local` / `Password123!`

2. **Port Configuration Discrepancy:**
   - In `.env` (line 20): `API_PORT=4000`
   - In `apps/api/src/main.ts` (line 65): `const port = process.env.API_PORT || process.env.PORT || 3001;`
   - In `apps/api/src/main.ts` (line 67): `Server running at http://localhost:${port}/${apiPrefix}` -> API listens on port 4000 when `.env` is loaded.
   - Result: Default runner execution `node tests/e2e/runner.ts` targets `http://localhost:3001/api/v1` and fails healthcheck unless `API_BASE_URL=http://localhost:4000/api/v1` is explicitly specified.

3. **Stock Transition & Outbox Event Generation in `apps/api`:**
   - In `packages/contracts/src/inventory/transition.ts` (lines 6–24):
     - `evaluateStockThresholdTransition(previousQuantity, newQuantity, threshold)` returns `{ shouldNotify: true, eventType: 'STOCK_OUT' }` when `previousQuantity > 0 && newQuantity <= 0`.
     - Returns `{ shouldNotify: true, eventType: 'STOCK_LOW' }` when `previousQuantity > threshold && newQuantity <= threshold && newQuantity > 0`.
     - Returns `{ shouldNotify: false, eventType: null }` when already low/out (deduplication) or replenished.
   - In `apps/api/src/modules/inventory/inventory.service.ts` (`adjustStock`, lines 295–371):
     - Runs inside a database transaction with pessimistic row lock (`FOR UPDATE` on `items`).
     - Evaluates transition. If `shouldNotify === true`, queries `notification_preferences` for active channels and inserts records into `notification_events` with `status: 'PENDING'`. If no preferences, inserts fallback email to `household@rumahkita.local`.
   - In `apps/api/src/modules/purchases/purchases.service.ts` (`completePurchase`, lines 320–345):
     - Evaluates stock replenishment inside purchase transaction and logs movement.

4. **E2E Test Expectations on Notifications:**
   - In `tests/e2e/tier3-cross-feature/stock-threshold-outbox-events.test.ts`:
     - Test `T3.5`: Calls `POST /items/${item.id}/stock-adjustments` (stock drops from 8 to 2, threshold 3). Asserts `adjRes.status === 200`, `status === 'Menipis'`, and verifies item is present in `GET /dashboard` (`lowStockItems`).
     - Test `T3.6`: Calls `POST /items/${item.id}/stock-adjustments` on an already-low item (stock 2 to 1). Asserts `adjRes.status === 200`, `status === 'Menipis'`, and verifies item remains in `GET /dashboard` with updated stock 1.
   - No E2E test file queries `notification_events` directly over HTTP (there is no public REST endpoint for outbox events, only `GET/PUT /settings/notifications` for preferences).

5. **Worker Daemon Status:**
   - In `apps/worker/src/index.ts` (lines 49–51):
     ```typescript
     public async pollOutbox(): Promise<void> {
       // In M5, this will execute SELECT FOR UPDATE SKIP LOCKED on notification_events
     }
     ```
   - Currently a stub skeleton awaiting M5 implementation.

---

## 2. Logic Chain

1. **From Observation 1 & 2:**
   - `apps/api` defaults to port 4000 when started with `.env`.
   - `runner.ts` defaults to port 3001 if `process.env.API_BASE_URL` is unset.
   - **Therefore:** To run the test runner against a live backend without configuration failure, `API_BASE_URL=http://localhost:4000/api/v1` must be provided in the command line or environment.

2. **From Observation 1 & Database Seeder (`packages/db/src/seed.ts`):**
   - The test suites authenticate using three deterministic users (`budi@rumahkita.local`, `ani@rumahkita.local`, `joko@rumahkita.local`).
   - The seeder seeds both `Keluarga Cemara` (Household 1) and `Keluarga Anwar` (Household 2).
   - **Therefore:** Running `pnpm --filter @rumahkita/db db:migrate` and `pnpm --filter @rumahkita/db db:seed` before running tests is an absolute prerequisite for test suite pass rate.

3. **From Observation 3 & 4:**
   - The backend API creates `notification_events` records inside the `adjustStock` transaction and reflects stock status on the dashboard.
   - E2E tests verify the HTTP interface and dashboard contract (`T3.5`, `T3.6`).
   - **Therefore:** The 56 E2E tests pass independently of whether the worker is currently polling, BUT when the worker runs, it must not lock rows in a way that blocks concurrent API calls.

4. **From Observation 3 & 5:**
   - `notification_events` schema contains `status`, `attempts`, `max_attempts`, `next_retry_at`, and `last_error`.
   - The worker must poll with `SELECT ... FOR UPDATE SKIP LOCKED` on `status IN ('PENDING', 'FAILED')` to process events and transition them to `PROCESSING` $\to$ `SENT`.
   - **Therefore:** Implementing this polling loop in `apps/worker` satisfies the acceptance criterion in `ORIGINAL_REQUEST.md` line 83 without risking deadlocks during live E2E test runs.

---

## 3. Caveats

- **No Public API for `notification_events`:** E2E tests do not verify that rows in `notification_events` transition to `SENT` because the REST API does not expose outbox rows over HTTP (strict encapsulation). Verification of `notification_events.status` transitions will be conducted via direct database inspection or integration/auditor tests.
- **Port Convention Assumption:** We assume `API_PORT=4000` remains standard across the repository as defined in `.env` and `.env.example`.
- **Read-Only Scope:** No source code or tests were modified during this investigation.

---

## 4. Conclusion

1. The E2E test suite (`tests/e2e/runner.ts`) is complete and well-structured, containing **56 test cases across 19 files**.
2. Outbox event creation is already implemented in `apps/api` (`inventory.service.ts` and `purchases.service.ts`), triggered by stock reductions that transition items from `Aman` to `Menipis` (`STOCK_LOW`) or to 0 (`STOCK_OUT`).
3. To achieve a 100% pass rate on `runner.ts`, the environment must have:
   - PostgreSQL running on port 5432 with migrations and seed applied (`pnpm --filter @rumahkita/db db:migrate && pnpm --filter @rumahkita/db db:seed`).
   - `apps/api` running on port 4000.
   - The runner invoked with `API_BASE_URL=http://localhost:4000/api/v1 node tests/e2e/runner.ts`.
4. The worker daemon should be implemented in `apps/worker/src/index.ts` using `SELECT ... FOR UPDATE SKIP LOCKED` with stubs for Email and WhatsApp delivery, updating `notification_events.status` to `SENT`.

---

## 5. Verification Method

To independently verify all findings and execute the full test suite:

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Apply migrations and seed test baseline fixtures
pnpm --filter @rumahkita/db db:migrate
pnpm --filter @rumahkita/db db:seed

# 3. Start Backend API server (in separate terminal)
pnpm --filter @rumahkita/api dev

# 4. Optional: Start Worker daemon (in separate terminal)
pnpm --filter @rumahkita/worker dev

# 5. Run the 56 E2E tests via the custom runner
API_BASE_URL=http://localhost:4000/api/v1 node tests/e2e/runner.ts

# Invalidation Condition:
# If the runner exits with code 1 or fails to reach http://localhost:4000/api/v1/household,
# verify that the API is running and that API_BASE_URL points to port 4000.
```
