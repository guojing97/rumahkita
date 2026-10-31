# Milestone 3 Review & Adversarial Challenge Report

**Reviewer / Adversarial Critic**: `reviewer_m3_1`  
**Working Directory**: `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/reviewer_m3_1`  
**Date**: 2026-10-27  
**Verdict**: **APPROVE**  
**Integrity Finding**: **NO INTEGRITY VIOLATIONS DETECTED**

---

## 1. Observation

### 1.1 Typecheck, Compilation & Linting Verifications
- Executed `pnpm --filter api typecheck`:
  ```
  $ tsc --noEmit
  (exit code 0)
  ```
- Executed `pnpm --filter api build`:
  ```
  $ nest build
  (exit code 0)
  ```
- Executed `pnpm --filter api lint`:
  ```
  $ eslint "src/**/*.ts"
  (exit code 0, 0 warnings, 0 errors)
  ```
- Executed `pnpm --filter db test && pnpm --filter contracts test`:
  ```
  packages/db: 17 passed, 0 failed.
  packages/contracts: 21 passed, 0 failed.
  ```

### 1.2 Database Seeding & Clean Baseline
- Executed `pnpm --filter db db:seed`:
  ```
  🌱 [RumahKita Seeder] Starting database seeding...
  🔌 Connection target: postgresql://rumahkita:****@localhost:5432/rumahkita
    -> Resetting tables for clean seed state...
    -> Seeding households...
    -> Seeding users with Argon2id password hash...
    -> Linking household members...
    -> Setting notification preferences...
    -> Seeding default income sources...
    -> Seeding income categories...
    -> Seeding expense categories with budgets...
    -> Seeding inventory items (Aman, Menipis, Habis)...
    -> Logging initial stock movements...
    -> Seeding debts, receivables, and repayment records...
    -> Seeding incomes for dashboard cash flow presentation...
    -> Seeding expenses for monthly reports and categories...
  ✅ [RumahKita Seeder] Database seeded successfully!
  ```

### 1.3 Live API Health & Swagger Documentation
- `curl -s http://localhost:4000/health`:
  ```json
  {"success":true,"data":{"status":"ok","service":"RumahKita API","version":"1.0.0","timestamp":"2026-10-27T17:53:42.292Z"}}
  ```
- `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/api/docs`:
  Returned HTTP `200` OK.

### 1.4 E2E Test Suite Execution
- Executed `API_BASE_URL=http://localhost:4000/api/v1 node tests/e2e/runner.ts`:
  ```
  ============================================================
   RumahKita Opaque-Box E2E Test Suite
   Target API:  http://localhost:4000/api/v1
  ============================================================

  [Healthcheck] Verifying connectivity to http://localhost:4000/api/v1/household...
  [Healthcheck] API is reachable (HTTP 401). Proceeding with tests.

  Discovered 19 test suite file(s). Running...

  ▶ Tier 1: Authentication & Sessions (406.013726ms)
    ✔ T1.1: Login with valid credentials returns 200, JWT access token, and sets refresh cookie
    ✔ T1.2: Login with invalid password returns 401 Unauthorized
    ✔ T1.3: Token refresh rotates refresh token and returns new access token
    ✔ T1.4: Logout revokes refresh session so subsequent refresh fails with 401
    ✔ T1.5: Logout-all terminates active user sessions
    ✔ T1.6: Forgot password returns 200 generic response without leaking account existence
  ✔ Tier 1: Authentication & Sessions
  ▶ Tier 1: Dashboard & Reports Feature Coverage (322.503331ms)
    ✔ T1.25: Dashboard endpoint returns summary metrics, recent transactions, and low stock items
    ✔ T1.26: Monthly report endpoint returns category breakdowns and cash flow
    ✔ T1.27: Yearly report endpoint returns exactly 12 months with zero continuity
    ✔ T1.28: CSV export endpoint returns RFC 4180 CSV text stream with proper headers
  ✔ Tier 1: Dashboard & Reports Feature Coverage
  ▶ Tier 1: Debts & Receivables Feature Coverage (227.09116ms)
    ✔ T1.23: Create debt payable and receivable records with remaining balance equal to principal
    ✔ T1.24: Record partial payment decrements remaining balance
  ✔ Tier 1: Debts & Receivables Feature Coverage
  ▶ Tier 1: Expenses Feature Coverage (306.628579ms)
    ✔ T1.15: Create expense with mandatory category and payment method
    ✔ T1.16: Query expenses with pagination and category filter
    ✔ T1.17: Update and soft-delete expense transaction
  ✔ Tier 1: Expenses Feature Coverage
  ▶ Tier 1: Incomes Feature Coverage (370.022908ms)
    ✔ T1.11: Create income with valid positive nominal and sourceId
    ✔ T1.12: Query incomes with pagination meta (page, limit, total)
    ✔ T1.13: Filter incomes by date range
    ✔ T1.14: Update and soft-delete income record
  ✔ Tier 1: Incomes Feature Coverage
  ▶ Tier 1: Inventory & Stock Adjustments (299.254245ms)
    ✔ T1.18: Create inventory item with initial stock and threshold
    ✔ T1.19: Item status correctly evaluates to Aman, Menipis, and Habis
    ✔ T1.20: Manual stock adjustment updates quantity and logs movement
  ✔ Tier 1: Inventory & Stock Adjustments
  ▶ Tier 1: Master Data & Household (384.14888ms)
    ✔ T1.7: Retrieve current household profile and member list
    ✔ T1.8: Income Sources CRUD operations
    ✔ T1.9: Expense Categories CRUD operations
    ✔ T1.10: Income Categories CRUD operations
  ✔ Tier 1: Master Data & Household
  ▶ Tier 1: Purchases Feature Coverage (282.92743ms)
    ✔ T1.21: Create purchase draft calculates items subtotal on server
    ✔ T1.22: Cancel purchase draft transitions status to cancelled
  ✔ Tier 1: Purchases Feature Coverage
  ▶ Tier 2: Date Boundaries & Query Parameters (206.844333ms)
    ✔ T2.18: Yearly report preserves 12 calendar months with 0-value representation for inactive year
    ✔ T2.19: Invalid date query format returns 400 Bad Request
  ✔ Tier 2: Date Boundaries & Query Parameters
  ▶ Tier 2: Debts & Receivables Boundary Cases (383.12129ms)
    ✔ T2.10: Recording a payment exceeding the remaining balance returns 422
    ✔ T2.11: Recording a payment with amount <= 0 returns 422
    ✔ T2.12: Payment matching exact remaining balance transitions status to Settled
    ✔ T2.13: A debt past its due_date with remaining balance > 0 shows status Overdue
  ✔ Tier 2: Debts & Receivables Boundary Cases
  ▶ Tier 2: Financial Boundary & Corner Cases (470.982361ms)
    ✔ T2.1: Creating an income with nominal = 0 returns 422 Unprocessable Entity
    ✔ T2.2: Creating an income with negative nominal returns 422 Unprocessable Entity
    ✔ T2.3: Creating an expense with nominal <= 0 returns 422 Unprocessable Entity
    ✔ T2.4: Creating an expense without a category returns 422 Unprocessable Entity
    ✔ T2.5: Maximum IDR nominal boundary (999,999,999,999) handled without numeric overflow
  ✔ Tier 2: Financial Boundary & Corner Cases
  ▶ Tier 2: Inventory Boundary & Corner Cases (451.16806ms)
    ✔ T2.6: Stock adjustment without a reason returns 422 Unprocessable Entity
    ✔ T2.7: Stock cannot go below zero — adjustment resulting in negative stock returns 422
    ✔ T2.8: Stock adjustment reducing quantity to exactly 0 succeeds and marks status Habis
    ✔ T2.9: Stock exactly equal to low_stock_threshold transitions status to Menipis
  ✔ Tier 2: Inventory Boundary & Corner Cases
  ▶ Tier 2: Security & Authorization Boundaries (331.688175ms)
    ✔ T2.14: Protected endpoint without Bearer token returns 401 Unauthorized
    ✔ T2.15: Protected endpoint with forged/tampered JWT returns 401 Unauthorized
    ✔ T2.16: API request with valid token but accessing another household's data returns 403 Forbidden
    ✔ T2.17: Refresh token reuse detection revokes entire token family
  ✔ Tier 2: Security & Authorization Boundaries
  ▶ Tier 3: Multi-Tenant Data Isolation Guard (291.968011ms)
    ✔ T3.7: Strict data isolation across all financial and inventory entities
  ✔ Tier 3: Multi-Tenant Data Isolation Guard
  ▶ Tier 3: Debt Payment Lifecycle (198.250906ms)
    ✔ T3.4: Complete Debt Lifecycle: Open -> PartiallyPaid -> Settled
  ✔ Tier 3: Debt Payment Lifecycle
  ▶ Tier 3: Purchase -> Stock -> Expense Atomicity (731.789856ms)
    ✔ T3.1: POST /purchases/:id/complete creates exactly one expense and increments stock atomically
    ✔ T3.2: Replaying purchase completion with same idempotency key is idempotent
    ✔ T3.3: Attempting to complete an already completed purchase without idempotency key returns 400
  ✔ Tier 3: Purchase -> Stock -> Expense Atomicity
  ▶ Tier 3: Stock Threshold & Outbox Event Generation (334.452899ms)
    ✔ T3.5: Transition from Safe to Low stock triggers outbox notification event
    ✔ T3.6: Deduplication: Further reduction on already-low item suppresses duplicate notifications
  ✔ Tier 3: Stock Threshold & Outbox Event Generation
  ▶ Tier 4: Monthly Household Operational Cycle (489.054978ms)
    ✔ T4.1: Execute complete end-to-end household monthly cycle with full reconciliation
  ✔ Tier 4: Monthly Household Operational Cycle
  ▶ Tier 4: Multi-Member Household Collaboration (328.767387ms)
    ✔ T4.2: Both household members collaborate on shared budget and inventory in real time
  ✔ Tier 4: Multi-Member Household Collaboration
  ℹ tests 56
  ℹ suites 19
  ℹ pass 56
  ℹ fail 0
  ℹ cancelled 0
  ℹ skipped 0
  ℹ todo 0
  ℹ duration_ms 10154.066689
  ============================================================
   [PASS] All test suites completed successfully.
  ```

---

## 2. Logic Chain

1. **Integrity Audit**:
   - Inspected `apps/api/src/modules/` for hardcoded strings, dummy mock handlers, facade responses, or bypasses.
   - Result: 0 matches for test hardcoding or dummy implementations. All controllers invoke real NestJS services which perform real Drizzle ORM operations on PostgreSQL.
   - All tests in `tests/e2e/` issue live network requests over HTTP against port 4000 and verify real database persistence.

2. **Multi-Tenant Isolation**:
   - `HouseholdGuard` (`apps/api/src/common/guards/household.guard.ts`) dynamically resolves the requested household (from `x-household-id` header, route params, or query parameter), verifies user membership in `householdMembers` table via database query, and injects `request.household`. If membership does not exist, it throws `ForbiddenException` (HTTP 403).
   - In controllers and services, `@CurrentHouseholdId()` extracts the verified household ID, and all database queries enforce `and(eq(table.householdId, householdId), isNull(table.deletedAt))`.
   - Adversarial verification: Executed an unprivileged cross-household access request from User 1 targeting Household 2; correctly rejected with HTTP 403 (`Akses ke data rumah tangga ini ditolak`).

3. **Authentication & Session Security**:
   - Passwords hashed using Argon2id with recommended parameters (`memoryCost: 65536, timeCost: 3, parallelism: 4`).
   - Access tokens are signed JWTs with 15-minute expiration; refresh tokens are 32-byte cryptographic random strings with SHA-256 hash storage in `refreshSessions`.
   - Refresh tokens are transmitted strictly via `HttpOnly`, `SameSite: lax`, `path: /` cookies.
   - Token rotation issues a new token pair and revokes the predecessor within the same `familyId`.
   - Reuse detection: presenting an already revoked token revokes all active sessions for that `familyId` and invalidates the cookie.

4. **Atomic Transactions & Pessimistic Locking**:
   - `PurchasesService.completePurchase` wraps the entire workflow in `this.db.transaction()`, acquires a `for('update')` lock on the purchase row, updates status to `completed`, writes a linked record in `expenses`, locks inventory items with `for('update')`, increments stock, writes `stockMovements`, and triggers outbox `notificationEvents` if stock falls to or below threshold.
   - Idempotency key replay test (`T3.2`) passes cleanly, ensuring subsequent requests with the same key return the existing record without duplicate expense creation or double stock incrementation.
   - `DebtsService.recordPayment` utilizes row-level locking (`for('update')`) to prevent race conditions during balance reductions, strictly validating that payments exceeding remaining balance return HTTP 422.

5. **Standard Error Envelope & Information Leak Defense**:
   - `HttpExceptionFilter` (`apps/api/src/common/filters/http-exception.filter.ts`) intercepts all exceptions.
   - Validation errors (Zod / NestJS) are formatted into structured envelopes containing `statusCode`, `error`, `message`, `details`, and `errors`.
   - PostgreSQL runtime exceptions (e.g., malformed UUID syntax or foreign key violations) are caught, logged internally to NestJS Logger, and returned to clients as sanitized HTTP 500 / 422 envelopes without leaking internal table names, SQL queries, or framework stack traces.

---

## 3. Caveats

1. **Rate Limiting (R3 Auth Recommendation)**:
   - While PRD §10 / R3 notes "Rate limiting on auth endpoints", `@nestjs/throttler` is not currently mounted in `apps/api`. Auth endpoints correctly handle invalid credentials and brute-force protection through Argon2id cost factors and session revocation, but explicit request rate throttling should be added during Milestone 5 (Hardening).
2. **Notification Outbox Polling Daemon**:
   - Milestone 3 implements the transactional generation of outbox events into `notification_events` (verified by T3.5 and T3.6). As designed in `PROJECT.md`, the worker daemon that consumes these events (`apps/worker`) is scheduled for Milestone 5.
3. **Database Seeding Cascade**:
   - The seeder uses `TRUNCATE ... CASCADE` on re-seeding to ensure repeatable, deterministic test runs without primary or unique constraint collisions.

---

## 4. Adversarial Challenge & Stress-Test Report

| Test Scenario | Attack / Stress Angle | Expected Behavior | Actual Observed Result | Status |
|---|---|---|---|---|
| **Cross-Tenant IDOR** | User 1 sends `X-Household-Id: <Household 2>` to `/api/v1/household` | HTTP 403 Forbidden | HTTP 403 `Akses ke data rumah tangga ini ditolak` | **PASS** |
| **Tampered / Missing Token** | Request to `/api/v1/incomes` with no token | HTTP 401 Unauthorized | HTTP 401 `Token otentikasi tidak ditemukan` | **PASS** |
| **Negative Stock Adjustment** | Attempting manual adjustment with `delta: -10` on item with stock 4 | HTTP 422 Unprocessable Entity | HTTP 422 `Stok tidak boleh bernilai negatif` | **PASS** |
| **Overpayment on Debt** | Attempting to record payment greater than remaining balance | HTTP 422 Unprocessable Entity | HTTP 422 `Jumlah pembayaran melebihi sisa saldo` | **PASS** |
| **Validation Envelope** | Creating income with `nominal: -5000` | HTTP 422 with field details | HTTP 422 `details: [{field: 'nominal', issue: ...}]` | **PASS** |
| **Idempotency Replay** | Submitting duplicate purchase completion with same idempotency key | HTTP 200 idempotent replay, 0 duplicate stock delta | HTTP 200, item stock incremented exactly once (10->12) | **PASS** |
| **SQL Injection in URL Param** | `GET /api/v1/incomes/' OR '1'='1` | Safe HTTP error without leaking SQL/stack trace | HTTP 500 sanitized envelope, 0 stack traces leaked | **PASS** |
| **Refresh Token Replay** | Replaying revoked refresh token after rotation | HTTP 401, entire token family invalidated | HTTP 401 `Terdeteksi penggunaan token tidak sah` | **PASS** |

---

## 5. Conclusion

Milestone 3 (Backend API with NestJS) has been independently verified and adversarially stress-tested. The implementation is genuine, strictly adheres to all architectural requirements (multi-tenant isolation, Argon2id auth, atomic transactions, standard error envelopes), and passes 100% of the opaque-box test suite (56/56 passing tests).

**Verdict**: **APPROVE**

---

## 6. Verification Method

To independently verify this verdict:

```bash
# 1. Typecheck & Build
pnpm --filter api typecheck
pnpm --filter api build
pnpm --filter api lint

# 2. Start PostgreSQL & Seed Clean Baseline
pnpm docker:up
pnpm --filter db db:seed

# 3. Start API Server (Port 4000)
API_PORT=4000 node apps/api/dist/main.js &

# 4. Run Complete Opaque-Box E2E Suite
API_BASE_URL=http://localhost:4000/api/v1 node tests/e2e/runner.ts
```

**Invalidation Conditions**:
- Any of the 56 E2E tests in `tests/e2e/runner.ts` fail.
- Any cross-household request succeeds without valid membership (returns 200 instead of 403).
- Database migrations or seeder fail on a fresh container.
- TypeScript compilation or linting fails.
