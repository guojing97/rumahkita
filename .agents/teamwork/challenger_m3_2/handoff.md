# Adversarial Verification Report: Milestone 3 (NestJS Backend API)

**Agent**: `challenger_m3_2` (EMPIRICAL CHALLENGER)  
**Target Milestone**: Milestone 3 — Backend API with NestJS (`/api/v1`)  
**Target URL**: `http://localhost:4000/api/v1`  
**Date**: 2026-10-27  
**Verdict**: **APPROVE**  
**Overall Risk Assessment**: **LOW**  

---

## 1. Observation

### Verification Environment & API Status
- **API Health**: Connectivity to `http://localhost:4000/api/v1/household` confirmed via HTTP 401 Unauthorized (`curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/v1/household` returned `401`).
- **TypeScript & Lint Baseline**:
  - `pnpm --filter api typecheck` executed `tsc --noEmit` -> **0 errors**.
  - `pnpm --filter api lint` executed `eslint "src/**/*.ts"` -> **0 errors, 0 warnings**.

### Test Suite Execution Results

#### 1. Official Opaque-Box E2E Suite (`tests/e2e/runner.ts`)
Command:
```bash
API_BASE_URL=http://localhost:4000/api/v1 node tests/e2e/runner.ts
```
Output:
```
============================================================
 RumahKita Opaque-Box E2E Test Suite
 Target API:  http://localhost:4000/api/v1
============================================================
[Healthcheck] Verifying connectivity to http://localhost:4000/api/v1/household...
[Healthcheck] API is reachable (HTTP 401). Proceeding with tests.
Discovered 19 test suite file(s). Running...

▶ Tier 1: Authentication & Sessions (295.16ms) - 6 passed
▶ Tier 1: Dashboard & Reports Feature Coverage (281.04ms) - 4 passed
▶ Tier 1: Debts & Receivables Feature Coverage (209.94ms) - 2 passed
▶ Tier 1: Expenses Feature Coverage (273.65ms) - 3 passed
▶ Tier 1: Incomes Feature Coverage (319.36ms) - 4 passed
▶ Tier 1: Inventory & Stock Adjustments (266.78ms) - 3 passed
▶ Tier 1: Master Data & Household (324.72ms) - 4 passed
▶ Tier 1: Purchases Feature Coverage (233.95ms) - 2 passed
▶ Tier 2: Date Boundaries & Query Parameters (162.38ms) - 2 passed
▶ Tier 2: Debts & Receivables Boundary Cases (302.18ms) - 4 passed
▶ Tier 2: Financial Boundary & Corner Cases (411.69ms) - 5 passed
▶ Tier 2: Inventory Boundary & Corner Cases (324.60ms) - 4 passed
▶ Tier 2: Security & Authorization Boundaries (248.97ms) - 4 passed
▶ Tier 3: Multi-Tenant Data Isolation Guard (224.07ms) - 1 passed
▶ Tier 3: Debt Payment Lifecycle (142.15ms) - 1 passed
▶ Tier 3: Purchase -> Stock -> Expense Atomicity (390.57ms) - 3 passed
▶ Tier 3: Stock Threshold & Outbox Event Generation (290.16ms) - 2 passed
▶ Tier 4: Monthly Household Operational Cycle (335.93ms) - 1 passed
▶ Tier 4: Multi-Member Household Collaboration (216.07ms) - 1 passed
ℹ tests 56
ℹ suites 19
ℹ pass 56
ℹ fail 0
ℹ duration_ms 7951.319194
============================================================
 [PASS] All test suites completed successfully.
```

#### 2. Empirical Adversarial & Stress Suite (`tests/adversarial/runner.ts`)
Command:
```bash
API_BASE_URL=http://localhost:4000/api/v1 node tests/adversarial/runner.ts
```
Output:
```
=================================================================
 RumahKita Adversarial & Stress Empirical Test Runner
 Target API: http://localhost:4000/api/v1
=================================================================
[Healthcheck] Verifying connectivity to http://localhost:4000/api/v1/household...
[Healthcheck] API is reachable (HTTP 401). Proceeding with adversarial tests.
Discovered 5 adversarial test suite(s). Executing...

▶ Adversarial: Business Logic Edge Cases (892.85ms)
  ✔ ADV-S1: Negative stock prevention: adjustment reducing stock below 0 rejects with HTTP 422
  ✔ ADV-S2: Stock adjustment missing or invalid reason rejects with HTTP 422
  ✔ ADV-S3: Stock adjustment with delta = 0 rejects with HTTP 422
  ✔ ADV-S4: Stock exact boundaries: transition to Habis (qty=0) and Menipis (qty=threshold)
  ✔ ADV-S5: Concurrent stock reduction race condition prevents negative stock
  ✔ ADV-D1: Payment exceeding remaining balance rejects with HTTP 422
  ✔ ADV-D2: Non-positive payment amount (0 or negative) rejects with HTTP 422
  ✔ ADV-D3: Multi-stage lifecycle: open -> partially_paid -> settled -> reject further payments
  ✔ ADV-D4: Concurrent payment race condition prevents double payment exceeding balance

▶ Challenger M3: Adversarial Security & Multi-Tenant Verification (1257.76ms)
  ✔ 1.1 IDOR on Financial & Inventory Entities: User B cannot Read, Update, or Delete User A resources
  ✔ 1.2 Cross-Household Foreign Key Injection: User B cannot reference H1 master entities
  ✔ 1.3 Tenant Header Spoofing (X-Household-Id): Must be strictly rejected with HTTP 403
  ✔ 2.1 JWT Signature Tampering & Forgery: Must return HTTP 401 Unauthorized
  ✔ 2.2 Refresh Token Rotation & Family Reuse Invalidation: Replaying old token revokes entire family
  ✔ 2.3 Single-Session Logout: Revokes active refresh session and clears cookie
  ✔ 2.4 Multi-Session Logout-All: Revokes all active refresh sessions across devices
  ✔ 3.1 Financial Boundary: Zero & Negative Nominals Rejected with 422
  ✔ 3.2 Inventory Boundary: Negative Stock Prevention
  ✔ 3.3 Debts Boundary: Overpayment & Non-Positive Payments Rejected with 422
  ✔ 3.4 Purchase State Machine: Completed/Cancelled state cannot be illegally transitioned

▶ Adversarial: Currency Boundary & Precision (830.78ms)
  ✔ ADV-C1: Income accepts max nominal 999,999,999,999 without precision loss
  ✔ ADV-C2: Expense accepts max nominal 999,999,999,999 without precision loss
  ✔ ADV-C3: Debt accepts max principal 999,999,999,999 without precision loss
  ✔ ADV-C4: Purchase draft and completion with max unitPrice 999,999,999,999
  ✔ ADV-C5: Income with nominal >= 1,000,000,000,000 rejects with HTTP 422
  ✔ ADV-C6: Expense with nominal >= 1,000,000,000,000 rejects with HTTP 422
  ✔ ADV-C7: Debt with principalAmount >= 1,000,000,000,000 rejects with HTTP 422
  ✔ ADV-C8: Purchase item with unitPrice >= 1,000,000,000,000 rejects with HTTP 422
  ✔ ADV-C9: Fractional income nominal rejects with HTTP 422
  ✔ ADV-C10: Fractional expense nominal rejects with HTTP 422
  ✔ ADV-C11: Fractional debt payment rejects with HTTP 422
  ✔ ADV-C12: Negative and zero nominals reject with HTTP 422
  ✔ ADV-C13: String non-numeric nominal rejects with HTTP 422

▶ Adversarial: Multi-Tenant Cross-Household Isolation (389.46ms)
  ✔ ADV-M1: Household B cannot complete Household A purchase draft
  ✔ ADV-M2: Household B cannot adjust Household A item stock
  ✔ ADV-M3: Household B cannot record payment on Household A debt

▶ Adversarial: Purchase Completion Atomicity & Idempotency (723.53ms)
  ✔ ADV-P1: Complete purchase with Idempotency-Key, verify replay idempotency, and reject mismatch/missing key
  ✔ ADV-P2: Concurrent completion requests with identical Idempotency-Key execute atomically once
  ✔ ADV-P3: Concurrent completion race with DIFFERENT Idempotency-Keys: exactly 1 succeeds, others 400
  ✔ ADV-P4: Rollback Atomicity: Concurrently deleted linked item causes entire completion transaction to roll back
  ✔ ADV-P5: Completed purchase cannot be cancelled; cancelled purchase cannot be completed

ℹ tests 41
ℹ suites 14
ℹ pass 41
ℹ fail 0
ℹ duration_ms 4825.500771
=================================================================
 [PASS] All adversarial test suites passed successfully.
```

---

## 2. Logic Chain

### 1. Purchase Completion Atomicity & Idempotency
- **Observation**:
  - `apps/api/src/modules/purchases/purchases.service.ts:186-355` executes `completePurchase` within `this.db.transaction(async (tx) => { ... })`.
  - Line 197 acquires a pessimistic write lock `schema.purchases.for('update')`.
  - Lines 204–226 enforce that if status is already `'completed'` and the provided `idempotencyKey` matches `purchase.idempotencyKey`, it fetches the existing linked expense and returns the original response with HTTP 200 without executing side-effects.
  - If the status is `'completed'` but the request omits the key or provides a different key, line 225 throws `new BadRequestException('Pembelian ini sudah selesai diproses')` (HTTP 400).
  - Lines 277–287 lock linked inventory items with `schema.items.for('update')`.
- **Empirical Inference**:
  - In `ADV-P1`, completing a draft purchase with `Idempotency-Key` created exactly 1 expense and incremented stock from 20 to 26. Replaying the identical request returned the exact same payload with HTTP 200; stock remained 26 and no additional expense was generated. Calling without an idempotency key or with a mismatched key returned HTTP 400.
  - In `ADV-P2`, firing 6 simultaneous concurrent completion requests with identical keys resulted in all 6 receiving HTTP 200 with the exact same `expenseId`, and stock incremented exactly once (50 + 5 = 55).
  - In `ADV-P3`, firing 5 concurrent requests with distinct idempotency keys yielded exactly 1 winner (HTTP 200) and 4 rejections (HTTP 400). Stock incremented once.
  - In `ADV-P4`, soft-deleting a linked item prior to completion resulted in `NotFoundException` (HTTP 404). PostgreSQL transaction rollback ensured the purchase remained in `'draft'`, no linked expense was created, and unaffected line item stock was untouched.
  - In `ADV-P5`, state machines strictly prevented cancelling a completed purchase or completing a cancelled purchase (HTTP 400).

### 2. Stock Adjustments & Boundary Validations
- **Observation**:
  - `apps/api/src/modules/inventory/inventory.service.ts:237-243` validates `reason` (minimum 3 characters, non-empty) and `delta !== 0`.
  - Line 256 acquires a row lock `for('update')` on `schema.items`.
  - Line 266 asserts `if (newQuantity < 0) throw new UnprocessableEntityException('Stok tidak boleh bernilai negatif')`.
- **Empirical Inference**:
  - In `ADV-S1`, attempting an adjustment reducing stock below zero (10 -> -1) rejected with HTTP 422 and preserved quantity 10.
  - In `ADV-S2`, missing reason, empty string, whitespace-only, and 2-character reasons all rejected with HTTP 422.
  - In `ADV-S3`, `delta: 0` rejected with HTTP 422.
  - In `ADV-S4`, exact transitions were verified: stock reaching low-stock threshold transitioned status to `'Menipis'`; stock reaching 0 transitioned status to `'Habis'`.
  - In `ADV-S5`, 3 concurrent requests each consuming 6 units on an item with 10 units resulted in exactly 1 success (HTTP 200, remaining stock = 4) and 2 rejections (HTTP 422, negative stock prevention).

### 3. Debt & Receivable Repayments
- **Observation**:
  - `apps/api/src/modules/debts/debts.service.ts:241-243` rejects payments with `amount <= 0`.
  - Line 257 acquires `schema.debtsReceivables.for('update')`.
  - Line 265 verifies `currentBalance <= 0 || debt.status === 'settled'`.
  - Line 270 verifies `input.amount > currentBalance` and throws HTTP 422.
- **Empirical Inference**:
  - In `ADV-D1`, payment of 500,001 on a 500,000 balance rejected with HTTP 422.
  - In `ADV-D2`, payments of 0 and negative nominals rejected with HTTP 422.
  - In `ADV-D3`, the full multi-stage lifecycle `open` -> `partially_paid` -> `settled` transitioned correctly, and subsequent payments on settled debts rejected with HTTP 422.
  - In `ADV-D4`, 3 concurrent payments of 70,000 on a 100,000 balance resulted in exactly 1 success and 2 rejections with HTTP 422, preventing balance overdraft.

### 4. Currency Numeric(14,0) Precision & Boundary Limits
- **Observation**:
  - `packages/contracts/src/common/idr.ts:9` restricts IDR values via `z.coerce.number().int().positive().max(999_999_999_999)`.
  - `packages/db/src/schema/common.ts:28` maps IDR fields to `numeric(14, 0)`.
- **Empirical Inference**:
  - In `ADV-C1` through `ADV-C4`, the maximum allowable IDR amount `999,999,999,999` (nearly 1 trillion Rupiah) was created and queried back across incomes, expenses, debts, and purchases without precision loss or numeric overflow.
  - In `ADV-C5` through `ADV-C8`, amounts equal to or exceeding 1 trillion (`1,000,000,000,000`) were rejected at the validation layer with HTTP 422.
  - In `ADV-C9` through `ADV-C11`, fractional IDR inputs (`.50`, `.75`, `.33`) were rejected with HTTP 422, preserving integer currency integrity.
  - In `ADV-C12` and `ADV-C13`, zero, negative, and non-numeric string nominals were rejected with HTTP 422.

### 5. Multi-Tenant Cross-Household Isolation
- **Observation**:
  - All database queries and updates enforce `eq(table.householdId, householdId)` extracted from validated JWT tokens via `CurrentHouseholdId()` decorator.
- **Empirical Inference**:
  - In `ADV-M1`, Household B attempting to complete Household A's purchase draft was rejected with HTTP 404; Household A's draft and stock remained untouched.
  - In `ADV-M2`, Household B attempting to adjust Household A's stock was rejected with HTTP 404; stock was untouched.
  - In `ADV-M3`, Household B attempting to pay Household A's debt was rejected with HTTP 404; balance remained unchanged.

---

## 3. Caveats

1. **Outbox Daemon Execution**: As designed in the MVP specification, the backend API synchronously produces notification events into `notification_events` when stock transitions from Safe to Low/Out (empirically confirmed in `T3.5`). The worker process responsible for consuming and delivering these events via SMTP/WhatsApp is part of Milestone 5 (`apps/worker`).
2. **Review-Only Constraint Followed**: In accordance with the challenger instructions, zero application production files (`apps/api/*`, `packages/db/*`, `packages/contracts/*`) were modified. All tests were executed strictly against the live API via opaque HTTP calls.

---

## 4. Conclusion & Final Verdict

**FINAL VERDICT: APPROVE**

The NestJS Backend API implementation (`apps/api`) at `http://localhost:4000/api/v1` has successfully withstood exhaustive empirical adversarial challenge:
1. **Financial Atomicity & Idempotency**: Verified across multiple concurrent threads with pessimistic row locking (`for update`) and idempotency replay controls.
2. **Negative Stock & Overpayment Invariants**: Mathematically and empirically sound; zero race condition leaks.
3. **Currency Precision**: Flawlessly enforces `numeric(14,0)` boundary (`999,999,999,999`) and integer currency integrity.
4. **Multi-Tenant Security**: Strict isolation across all financial, inventory, and transaction endpoints.
5. **Full Test Suite Clearance**: 56/56 standard E2E tests + 41/41 adversarial & stress tests pass with 100% success rate (exit code 0).

---

## 5. Verification Method

To independently reproduce the adversarial and E2E verification results:

```bash
# 1. Clean database seed
pnpm --filter db db:seed

# 2. Run official 56-test E2E test runner
API_BASE_URL=http://localhost:4000/api/v1 node tests/e2e/runner.ts

# 3. Run 41-test adversarial and stress test runner
API_BASE_URL=http://localhost:4000/api/v1 node tests/adversarial/runner.ts
```

**Invalidation Conditions**:
The verification is invalidated if:
- Any test in `tests/e2e/runner.ts` or `tests/adversarial/runner.ts` exits with a non-zero exit code or assertion failure.
- A purchase completion replay with the same `Idempotency-Key` creates a duplicate expense or increments stock more than once.
- Concurrent stock reductions result in `quantity_on_hand < 0`.
- Concurrent debt payments result in `remaining_balance < 0`.
- An amount of `1,000,000,000,000` is accepted without HTTP 422 rejection.
