# RumahKita — E2E Test Suite Readiness Report (`TEST_READY.md`)

**Date:** 2026-10-27  
**Track:** Dual-Track Independent Opaque-Box E2E Testing Track  
**Status:** READY FOR VERIFICATION  
**Author:** Test Writer (`test_writer_e2e_1`)  

---

## 1. Executive Summary

The comprehensive, opaque-box End-to-End (E2E) test suite for the RumahKita project has been scaffolded and authored in `tests/e2e/`. The suite derives strictly from user requirements in `ORIGINAL_REQUEST.md`, `doc/prd.md`, and authoritative architecture surveys, verifying all API endpoints under `/api/v1` without coupling to internal database or application code.

The test harness uses Node.js native testing (`node:test`) and native `fetch` with an in-memory RFC 6265 `CookieJar` and Bearer token session manager. It supports standalone execution, tier-filtered runs, and custom regex pattern execution with POSIX exit codes (0 for pass, non-zero for fail).

---

## 2. Test Suite Inventory & Test Counts by Tier

| Tier | Directory | Test Files | Total Test Cases | Scope & Invariants Verified |
|---|---|---|---|---|
| **Tier 1: Feature Coverage** | `tests/e2e/tier1-feature-coverage/` | 8 files | **28 tests** | Happy path CRUD for Auth, Household, Master Data, Incomes, Expenses, Inventory, Purchases, Debts/Receivables, Dashboard, and Reports |
| **Tier 2: Boundary & Corner Cases** | `tests/e2e/tier2-boundary-corner/` | 5 files | **19 tests** | Zero/negative nominals, missing required fields, negative stock prevention, balance overpayment, token reuse detection, cross-household 403, boundary limits |
| **Tier 3: Cross-Feature Combinations** | `tests/e2e/tier3-cross-feature/` | 4 files | **7 tests** | ACID Purchase completion atomicity (expense + stock increment + idempotency), Debt payment lifecycle (Open -> PartiallyPaid -> Settled), Safe -> Low stock transition & outbox deduplication, cross-household isolation |
| **Tier 4: Real-World Scenarios** | `tests/e2e/tier4-scenarios/` | 2 files | **2 scenario suites** | Full household monthly operational cycle (Salary -> Utilities -> Purchase -> Stock Consumption -> Debt Payment -> Monthly Report & CSV Reconciliation); Multi-member household collaboration (Owner & Member) |
| **TOTAL** | `tests/e2e/**` | **19 files** | **56 test cases** | **Complete MVP Requirement Coverage** |

---

## 3. Detailed Feature Coverage Checklist

### Auth & Multi-Tenancy Security
- [x] **AC-BE-01**: Seeded users can log in, receive 15-min JWT access token and 7-day `HttpOnly` refresh cookie (`T1.1`).
- [x] **AC-BE-02**: Invalid credentials return HTTP 401 Unauthorized (`T1.2`).
- [x] **AC-BE-03**: Token refresh rotates refresh token and issues new access token (`T1.3`).
- [x] **AC-BE-04**: Logout revokes refresh session so old token cannot be refreshed (`T1.4`).
- [x] **AC-BE-05**: Logout-all terminates all active sessions for the user (`T1.5`).
- [x] **AC-BE-06**: Forgot password returns generic HTTP 200 without leaking email presence (`T1.6`).
- [x] **AC-BE-07**: Unauthenticated requests to protected endpoints return HTTP 401 (`T2.14`).
- [x] **AC-BE-08**: Forged or tampered JWT access tokens return HTTP 401 (`T2.15`).
- [x] **AC-BE-09**: Cross-household access attempt to another household's data returns HTTP 403 / 404 (`T2.16`, `T3.7`).
- [x] **AC-BE-10**: Refresh token replay attack detection immediately revokes the entire token family (`T2.17`).

### Master Data & Household
- [x] **AC-BE-11**: Retrieve household profile with current members list (`T1.7`).
- [x] **AC-BE-12**: Income sources CRUD with unique household name validation and soft-delete (`T1.8`).
- [x] **AC-BE-13**: Expense categories CRUD with budget limits and soft-delete (`T1.9`).
- [x] **AC-BE-14**: Income categories CRUD with icon/color attributes (`T1.10`).

### Incomes & Expenses
- [x] **AC-BE-15**: Record income with valid positive nominal and source reference (`T1.11`).
- [x] **AC-BE-16**: Incomes pagination metadata mathematically accurate (`T1.12`).
- [x] **AC-BE-17**: Filter incomes by date range (`T1.13`).
- [x] **AC-BE-18**: Update and soft-delete income records (`T1.14`).
- [x] **AC-BE-19**: Record expense with category and payment method (`T1.15`).
- [x] **AC-BE-20**: Expenses pagination and category filter (`T1.16`).
- [x] **AC-BE-21**: Update and soft-delete expense transactions (`T1.17`).
- [x] **AC-BE-22**: Income nominal $\le 0$ rejects with HTTP 422 (`T2.1`, `T2.2`).
- [x] **AC-BE-23**: Expense nominal $\le 0$ rejects with HTTP 422 (`T2.3`).
- [x] **AC-BE-24**: Expense missing mandatory `categoryId` rejects with HTTP 422 (`T2.4`).
- [x] **AC-BE-25**: Max IDR nominal boundary (`999,999,999,999`) handled without integer overflow (`T2.5`).

### Inventory & Stock Invariants
- [x] **AC-BE-26**: Create item with unit, initial stock, and low stock threshold (`T1.18`).
- [x] **AC-BE-27**: Dynamic stock status evaluation: `Aman` ($> \text{threshold}$), `Menipis` ($\le \text{threshold}$), `Habis` ($= 0$) (`T1.19`).
- [x] **AC-BE-28**: Manual stock adjustment with mandatory reason updates quantity and logs movement (`T1.20`).
- [x] **AC-BE-29**: Stock adjustment without reason rejects with HTTP 422 (`T2.6`).
- [x] **AC-BE-30**: Negative stock prevention: adjustment reducing stock below 0 rejects with HTTP 422 (`T2.7`).
- [x] **AC-BE-31**: Stock adjustment reducing quantity to exactly 0 marks status `Habis` (`T2.8`).
- [x] **AC-BE-32**: Stock reaching exact threshold value transitions to `Menipis` (`T2.9`).

### Purchases & Transactional Atomicity
- [x] **AC-BE-33**: Create purchase draft with line items; server calculates subtotals and total (`T1.21`).
- [x] **AC-BE-34**: Cancel purchase draft transitions status to `cancelled` (`T1.22`).
- [x] **AC-BE-35**: Atomic purchase completion: creates exactly 1 expense and increments item stock (`T3.1`).
- [x] **AC-BE-36**: Idempotency key replay on purchase completion prevents duplicate expenses/stock (`T3.2`).
- [x] **AC-BE-37**: Attempt to complete an already completed purchase rejects with HTTP 400 (`T3.3`).

### Debts & Receivables
- [x] **AC-BE-38**: Create payable and receivable records with remaining balance equal to principal (`T1.23`).
- [x] **AC-BE-39**: Record partial payment decrements remaining balance (`T1.24`).
- [x] **AC-BE-40**: Payment exceeding remaining balance rejects with HTTP 422 (`T2.10`).
- [x] **AC-BE-41**: Payment with amount $\le 0$ rejects with HTTP 422 (`T2.11`).
- [x] **AC-BE-42**: Exact balance payment transitions debt status to `settled` (`T2.12`).
- [x] **AC-BE-43**: Debt past due date with remaining balance $> 0$ marked `overdue` (`T2.13`).
- [x] **AC-BE-44**: Multi-stage debt payment lifecycle: `open` $\to$ `partially_paid` $\to$ `settled` (`T3.4`).

### Dashboard, Reports & CSV
- [x] **AC-BE-45**: Dashboard returns summary cards, recent transactions, and low stock items (`T1.25`).
- [x] **AC-BE-46**: Monthly report calculates net cash flow and category breakdown (`T1.26`).
- [x] **AC-BE-47**: Yearly report returns 12 months with zero-value continuity for inactive months (`T1.27`, `T2.18`).
- [x] **AC-BE-48**: CSV export streams valid RFC 4180 format with `Content-Disposition: attachment` (`T1.28`).

### Outbox Notifications & Deduplication
- [x] **AC-BE-49**: Transition from Safe to Low stock creates notification outbox event (`T3.5`).
- [x] **AC-BE-50**: Further stock decrements while already in Low state suppress duplicate alerts (`T3.6`).

### Real-World Personas & Scenarios
- [x] **AC-BE-51**: Complete monthly household cycle: income $\to$ utilities $\to$ purchase $\to$ stock consumption $\to$ debt payment $\to$ monthly report reconciliation $\to$ CSV export (`T4.1`).
- [x] **AC-BE-52**: Two-member household collaboration: Owner and Member view shared finances, add transactions, and track shared inventory in real-time (`T4.2`).

---

## 4. Test Execution Guide

### How to Run the Entire Suite
```bash
# Using the test orchestrator runner
API_BASE_URL=http://localhost:3001/api/v1 node tests/e2e/runner.ts

# Or using Node test runner directly
API_BASE_URL=http://localhost:3001/api/v1 node --test 'tests/e2e/**/*.test.ts'
```

### Running by Tier
```bash
# Tier 1: Feature Coverage (Core Happy Paths)
node tests/e2e/runner.ts --tier 1

# Tier 2: Boundary & Corner Cases (Error Validation & Edge Constraints)
node tests/e2e/runner.ts --tier 2

# Tier 3: Cross-Feature Interactions (Atomicity & State Transitions)
node tests/e2e/runner.ts --tier 3

# Tier 4: Real-World Scenarios (Monthly Cycle & Multi-Member Journey)
node tests/e2e/runner.ts --tier 4
```

### Running a Specific Test File
```bash
node --test tests/e2e/tier1-feature-coverage/auth.test.ts
node --test tests/e2e/tier3-cross-feature/purchase-inventory-expense-atomicity.test.ts
node --test tests/e2e/tier4-scenarios/monthly-household-cycle.test.ts
```

### Exit Codes
- Exit code `0`: All tests passed.
- Exit code `1`: One or more tests failed, or API server connection error.
