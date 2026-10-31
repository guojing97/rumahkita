# RumahKita — End-to-End (E2E) Test Architecture & Infrastructure

**Document Version:** 1.0.0  
**Domain:** Opaque-Box Testing Architecture, Test Runners, Quality Tiers & Harness Specification  
**Date:** 2026-10-27  
**Author:** Test Writer (Dual Track: E2E Testing Track)  
**Status:** Approved Specification Baseline  

---

## 1. Executive Summary & Dual-Track Philosophy

RumahKita is engineered under a **Dual-Track Testing Architecture**. In this architecture, the End-to-End (E2E) Testing Track runs autonomously and independently from internal backend and frontend implementation details.

### Opaque-Box Guarantees
1. **Zero Coupling to Code Internals:** Tests interact with the application exclusively over HTTP REST endpoints (`/api/v1`) using standard JSON payloads and HTTP semantics. Tests have no imports from `apps/api/src`, `packages/db`, or internal database models.
2. **Deterministic Authoritative Source:** Expected status codes, envelopes, error structures, and domain computations are derived strictly from `ORIGINAL_REQUEST.md`, `doc/prd.md`, `explorer_survey_arch_3/survey_report.md`, and `spec_miner_survey_backend_1/survey_report.md`.
3. **Self-Contained & Order-Independent:** Every test suite provisions its own test entities (or relies on predictable seeded baseline fixtures), avoiding hard dependencies on the execution sequence of other test suites.
4. **Binary Exit Status:** The test harness adheres strictly to POSIX process exit conventions: exit code `0` indicates 100% pass, and any non-zero exit code indicates a failure.

---

## 2. Test Architecture & Harness Design

```
+-----------------------------------------------------------------------------------+
|                            E2E Test Runner Harness                                |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | Config & Environment (API_BASE_URL: http://localhost:3001/api/v1)          |  |
|  +-----------------------------------------------------------------------------+  |
|                                       |                                           |
|  +-----------------------------------------------------------------------------+  |
|  | ApiClient (Native Fetch + Cookie Jar + Bearer Auth Session)                 |  |
|  +-----------------------------------------------------------------------------+  |
|                                       |                                           |
|  +------------------------------------+----------------------------------------+  |
|  |                                    |                                        |  |
|  v                                    v                                        v  |
| [Tier 1: Feature Coverage]   [Tier 2: Boundary & Corner]   [Tier 3: Cross-Feature]|  |
| - Auth & Household           - Negative / Zero Nominals    - Atomic Purchases     |  |
| - Incomes & Expenses         - Stock Floor Checks (>= 0)   - Debt Lifecycles      |  |
| - Inventory & Stock Adj      - Missing Required Fields     - Outbox Deduplication |  |
| - Purchases & Line Items     - Cross-Household 403         - Isolation Guards     |  |
| - Debts & Receivables        - Token Replay Attack 401                            |  |
| - Dashboard & Reports        - Boundary Max Nominal                               |  |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | [Tier 4: Real-World Scenarios]                                              |  |
|  | - Complete Household Monthly Cycle (Income -> Expense -> Purchase -> Stock   |  |
|  |   Consumption -> Debt Payment -> Monthly Cash Flow & CSV Reconciliation)    |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
                                        |
                             HTTP / JSON (REST API)
                                        v
+-----------------------------------------------------------------------------------+
|                        Target Under Test (Backend API)                            |
|                            http://localhost:3001/api/v1                           |
+-----------------------------------------------------------------------------------+
```

### 2.1 Technology Stack Selection
- **Runtime:** Node.js 20+ / 22+ / 26+ (utilizing native ES module imports and native TypeScript support).
- **Test Runner:** Native Node Test Framework (`node:test`) paired with strict assertions (`node:assert/strict`).
- **HTTP Transport:** Native global `fetch` API augmented with an in-memory RFC 6265 compliant `CookieJar` to handle HttpOnly session cookies (such as `refreshToken`).
- **Zero Third-Party Test Dependencies:** Tests run natively without requiring external heavy test framework installations, guaranteeing zero supply chain vulnerabilities and rapid CI execution.

---

## 3. Test Tier Taxonomy

The test suite is structured into four distinct verification tiers:

### Tier 1: Feature Coverage (Core API Contracts)
Focuses on individual feature happy paths, standard querying, pagination, and response schema compliance:
1. **Authentication (`auth.test.ts`):**
   - User login with seeded credentials (`POST /auth/login`).
   - Token rotation via HttpOnly refresh cookie (`POST /auth/refresh`).
   - Single session termination (`POST /auth/logout`).
   - Global session termination (`POST /auth/logout-all`).
   - Password reset flow initiation (`POST /auth/password/forgot`).
2. **Household Management (`household.test.ts`):**
   - Retrieve household profile and membership list (`GET /household`).
   - Member invitation generation (`POST /household/invitations`).
3. **Master Data (`master-data.test.ts`):**
   - Income sources CRUD (`/income-sources`).
   - Income categories CRUD (`/income-categories`).
   - Expense categories CRUD (`/expense-categories`).
4. **Incomes (`incomes.test.ts`):**
   - Record income (`POST /incomes`).
   - Query incomes with pagination and date range filters (`GET /incomes`).
   - Update income notes/amount (`PUT /incomes/:id`).
   - Soft-delete income (`DELETE /incomes/:id`).
5. **Expenses (`expenses.test.ts`):**
   - Record standalone expense (`POST /expenses`).
   - Filter expenses by category and payment method (`GET /expenses`).
   - Update expense notes/amount (`PUT /expenses/:id`).
   - Soft-delete expense (`DELETE /expenses/:id`).
6. **Inventory (`inventory.test.ts`):**
   - Create catalog item with low stock threshold (`POST /items`).
   - Query items list with computed stock status `Aman`, `Menipis`, `Habis` (`GET /items`).
   - Record stock adjustment with mandatory reason (`POST /items/:id/stock-adjustments`).
   - Query item stock movement history (`GET /items/:id/stock-adjustments`).
7. **Purchases (`purchases.test.ts`):**
   - Create purchase draft with line items (`POST /purchases`).
   - Server-side recalculation of line item subtotals and purchase total (`GET /purchases/:id`).
   - Purchase completion endpoint (`POST /purchases/:id/complete`).
   - Purchase cancellation endpoint (`POST /purchases/:id/cancel`).
8. **Debts & Receivables (`debts-receivables.test.ts`):**
   - Create payable and receivable records (`POST /debts-receivables`).
   - Record partial payment against debt (`POST /debts-receivables/:id/payments`).
   - Verify remaining balance decrement.
9. **Dashboard & Reports (`dashboard-reports.test.ts`):**
   - Dashboard summary cards aggregation (`GET /dashboard`).
   - Monthly report category breakdown and net cash flow (`GET /reports/monthly`).
   - Yearly report 12-month array continuity (`GET /reports/yearly`).
   - CSV export headers and RFC 4180 streaming (`GET /reports/export/csv`).

---

### Tier 2: Boundary & Corner Cases
Tests system resilience against malformed inputs, malicious requests, boundary values, and constraint enforcement:
1. **Financial Nominal Validation (`financial-boundaries.test.ts`):**
   - Income with `nominal = 0` rejects with HTTP 422.
   - Income with `nominal < 0` rejects with HTTP 422.
   - Expense with `nominal = 0` rejects with HTTP 422.
   - Expense with `nominal < 0` rejects with HTTP 422.
   - Expense missing mandatory `categoryId` rejects with HTTP 422.
   - Max IDR nominal boundary (`999_999_999_999`) stored and retrieved without integer overflow.
2. **Inventory Stock Invariants (`inventory-boundaries.test.ts`):**
   - Stock adjustment without mandatory `reason` rejects with HTTP 422.
   - Stock adjustment resulting in negative inventory (e.g., current stock 2, delta -5) rejects with HTTP 422.
   - Stock adjustment reducing quantity to exactly 0 succeeds and marks status `Habis`.
   - Item stock exactly equal to `low_stock_threshold` transitions status to `Menipis`.
3. **Debt Balance Constraints (`debt-boundaries.test.ts`):**
   - Payment exceeding remaining balance (e.g., balance 500,000, payment 600,000) rejects with HTTP 422.
   - Payment with `amount <= 0` rejects with HTTP 422.
   - Payment matching exact remaining balance transitions status to `settled`.
   - Debt past `due_date` with balance > 0 is flagged as `overdue`.
4. **Security & Session Invariants (`security-boundaries.test.ts`):**
   - Cross-household data access (User A attempting to read/update User B's record) rejects with HTTP 403 (or 404).
   - Missing Bearer token on protected endpoints rejects with HTTP 401.
   - Malformed / forged JWT token rejects with HTTP 401.
   - Refresh token reuse attack: replaying an already-consumed refresh token immediately revokes the session family and rejects with HTTP 401.
5. **Date & Report Boundaries (`date-and-limits.test.ts`):**
   - Yearly report requested for year with no transactions returns 12 months with zeros.
   - Invalid date format (e.g. `2026-02-31`) in filters returns validation error.

---

### Tier 3: Cross-Feature Interactions & ACID Atomicity
Exercises complex transactions spanning multiple modules:
1. **Purchase Completion Atomicity (`purchase-inventory-expense-atomicity.test.ts`):**
   - Verifies `POST /purchases/:id/complete`:
     - Creates exactly one linked expense record with nominal = purchase total.
     - Increments inventory stock for each inventory line item.
     - Appends corresponding `stock_movements` records with reason `purchase`.
     - Marks purchase status as `completed`.
   - Tests idempotency: repeating the complete call with identical `Idempotency-Key` does not duplicate expenses or stock.
2. **Debt Payment Lifecycle (`debt-payment-lifecycle.test.ts`):**
   - Creates a debt with principal 1,000,000.
   - Payment 1 (400,000): remaining balance becomes 600,000, status becomes `partially_paid`.
   - Payment 2 (600,000): remaining balance becomes 0, status becomes `settled`.
   - Verifies debt payment does not leak as an unlinked operational expense.
3. **Inventory Transition & Notification Outbox (`stock-threshold-outbox-events.test.ts`):**
   - Item starts in `Aman` state (`stock > threshold`).
   - Stock reduction drops quantity to `stock <= threshold` (`Menipis`): triggers 1 notification event in outbox.
   - Subsequent stock reduction while already in `Menipis`: deduplication suppresses duplicate alert event.
4. **Multi-Tenant Data Isolation Guard (`cross-household-isolation.test.ts`):**
   - Verifies that two concurrent households operate in strict isolation. No income, expense, item, purchase, or debt created by Household 1 is readable or mutable by Household 2.

---

### Tier 4: Real-World Persona Scenarios
Simulates realistic, multi-step user workflows:
1. **Full Monthly Household Financial Cycle (`monthly-household-cycle.test.ts`):**
   - **Step 1:** User logs in at the beginning of the month.
   - **Step 2:** User logs monthly salary (`Gaji Bulanan`, Rp 15,000,000).
   - **Step 3:** User records direct fixed expenses (Electricity bill Rp 750,000, Internet Rp 450,000).
   - **Step 4:** User creates inventory items (`Beras 5kg`, `Minyak Goreng 2L`, `Gula Pasir 1kg`).
   - **Step 5:** User logs monthly grocery shopping at Supermarket as a Purchase order containing multiple items, then completes it.
   - **Step 6:** System updates inventory stock and generates linked grocery expense.
   - **Step 7:** Mid-month, user performs manual consumption adjustment on rice; status transitions to `Menipis`.
   - **Step 8:** User makes a partial payment against a home renovation loan.
   - **Step 9:** User reviews the Dashboard and verifies:
     - `totalIncome` matches Rp 15,000,000.
     - `totalExpense` equals sum of direct expenses + purchase expenses.
     - `netCashFlow` equals `totalIncome - totalExpense`.
     - `lowStockItems` correctly lists the depleted rice.
   - **Step 10:** User exports monthly CSV and reconciles CSV transaction lines against the dashboard summary.
2. **Multi-Member Collaboration (`multi-member-collaboration.test.ts`):**
   - Owner creates household and records transactions.
   - Partner member logs in, views shared dashboard, records additional expenses, and verifies shared real-time balance.

---

## 4. Test Infrastructure Code Layout

```text
RumahKita/
├── tests/
│   └── e2e/
│       ├── client/
│       │   ├── api-client.ts           # HTTP client with cookie jar & auth state
│       │   ├── auth-helper.ts          # Test user provisioning & session helper
│       │   └── test-context.ts         # Shared test context & fixture factories
│       ├── config.ts                   # Environment & base URL configuration
│       ├── runner.ts                   # Custom test runner & summary reporter
│       ├── tier1-feature-coverage/
│       │   ├── auth.test.ts
│       │   ├── master-data.test.ts
│       │   ├── incomes.test.ts
│       │   ├── expenses.test.ts
│       │   ├── inventory.test.ts
│       │   ├── purchases.test.ts
│       │   ├── debts-receivables.test.ts
│       │   └── dashboard-reports.test.ts
│       ├── tier2-boundary-corner/
│       │   ├── financial-boundaries.test.ts
│       │   ├── inventory-boundaries.test.ts
│       │   ├── debt-boundaries.test.ts
│       │   ├── security-boundaries.test.ts
│       │   └── date-and-limits.test.ts
│       ├── tier3-cross-feature/
│       │   ├── purchase-inventory-expense-atomicity.test.ts
│       │   ├── debt-payment-lifecycle.test.ts
│       │   ├── stock-threshold-outbox-events.test.ts
│       │   └── cross-household-isolation.test.ts
│       └── tier4-scenarios/
│           ├── monthly-household-cycle.test.ts
│           └── multi-member-collaboration.test.ts
```

---

## 5. Execution Guide & Commands

### Running the Entire Suite
To run all tiers against the default or configured API server:
```bash
# Using the test orchestrator runner
API_BASE_URL=http://localhost:3001/api/v1 node tests/e2e/runner.ts

# Or using native Node test runner
API_BASE_URL=http://localhost:3001/api/v1 node --test 'tests/e2e/**/*.test.ts'
```

### Running Specific Tiers
```bash
# Run Tier 1 only
node tests/e2e/runner.ts --tier 1

# Run Tier 2 only
node tests/e2e/runner.ts --tier 2

# Run Tier 3 only
node tests/e2e/runner.ts --tier 3

# Run Tier 4 only
node tests/e2e/runner.ts --tier 4
```

### Running a Specific Test Suite File
```bash
node --test tests/e2e/tier1-feature-coverage/auth.test.ts
node --test tests/e2e/tier3-cross-feature/purchase-inventory-expense-atomicity.test.ts
```

### Exit Codes
- `0`: All executed tests passed successfully.
- `1`: One or more tests failed, or connection to the API server could not be established.
