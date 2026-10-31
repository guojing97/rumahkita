# Handoff Report: Business Domain & Transactions Specification (M3)

## 1. Observation

1. **Database Schema Inspection (`packages/db/src/schema/`)**:
   - `finance.ts:24-49`: `income_sources` table with soft delete `deleted_at`, unique index on `(household_id, name) WHERE deleted_at IS NULL`.
   - `finance.ts:80-106`: `expense_categories` table with `budget_limit numeric(14,0)`.
   - `finance.ts:109-140`: `incomes` table with check `nominal > 0`, FKs to `households`, `income_sources`, `income_categories`.
   - `finance.ts:143-175`: `expenses` table with check `nominal > 0`, FK to `expense_categories`, nullable FK to `purchases`.
   - `inventory.ts:27-61`: `items` table with `quantity_on_hand` (non-negative check), `low_stock_threshold` (non-negative check), soft delete `deleted_at`.
   - `inventory.ts:64-91`: `stock_movements` table with `quantity_delta != 0`, `resulting_quantity >= 0`, `reason` enum (`purchase`, `manual_correction`, `waste`, `initial`, `reversal`), `reference_id` UUID.
   - `purchase.ts:25-60`: `purchases` table with `status` enum (`draft`, `completed`, `cancelled`), `idempotency_key` (unique index), `total_amount numeric(14,0)`.
   - `purchase.ts:63-84`: `purchase_items` table with `quantity > 0`, `unit_price >= 0`, `subtotal >= 0`.
   - `debt.ts:22-60`: `debts_receivables` table with `type` enum (`payable`, `receivable`), `principal_amount > 0`, `remaining_balance >= 0`, `status` enum (`open`, `partially_paid`, `settled`, `overdue`, `cancelled`).
   - `debt.ts:63-84`: `debt_receivable_payments` table with `amount > 0`, `payment_date`.
   - `notification.ts:28-55`: `notification_preferences` table with `household_id`, `user_id`, `email_enabled`, `whatsapp_enabled`.
   - `notification.ts:58-87`: `notification_events` table (transactional outbox) with `status` enum (`PENDING`, `PROCESSING`, `SENT`, `FAILED`, `CANCELLED`).

2. **Shared Contracts Inspection (`packages/contracts/src/`)**:
   - `common/idr.ts:3-10`: `idrAmountSchema` enforces integer, positive, max 999,999,999,999.
   - `inventory/item.schema.ts:13-17`: `calculateStockStatus(quantity, threshold)` calculates `'SAFE' | 'LOW' | 'OUT'`.
   - `inventory/transition.ts:6-24`: `evaluateStockThresholdTransition(prev, new, threshold)` returns `{ shouldNotify: boolean, eventType: 'STOCK_LOW' | 'STOCK_OUT' | null }`. Deduplication suppresses notifications when already low/out.
   - `purchases/purchase.schema.ts:59-63`: `completePurchaseSchema` supports `idempotencyKey: z.string().uuid().optional()`.
   - `debts/debt.schema.ts:45-52`: `recordPaymentSchema` with `amount`, `paymentDate`, `paymentMethod`.
   - `reports/report.schema.ts:14-58`: `dashboardSummaryResponseSchema` contains `summaryCards`, `recentTransactions`, `lowStockItems`.
   - `reports/report.schema.ts:107-123`: `yearlyReportResponseSchema` contains `monthlyTrend` (12 months).

3. **E2E Test Invariants Inspection (`tests/e2e/`)**:
   - `tests/e2e/tier1-feature-coverage/inventory.test.ts:42,51,60`:
     Direct assertions expect Indonesian string labels:
     `assert.strictEqual(itemAman.body.data.status, 'Aman')`
     `assert.strictEqual(itemMenipis.body.data.status, 'Menipis')`
     `assert.strictEqual(itemHabis.body.data.status, 'Habis')`
   - `tests/e2e/tier1-feature-coverage/inventory.test.ts:76`: Manual adjustment endpoint is `POST /items/:id/stock-adjustments` with body `{ delta, reason }`, and history is `GET /items/:id/stock-adjustments`.
   - `tests/e2e/tier1-feature-coverage/dashboard-reports.test.ts:20-26`: `GET /dashboard?period=this_month` returns `summaryCards` containing `totalIncome`, `totalExpense`, `netCashFlow`.
   - `tests/e2e/tier1-feature-coverage/dashboard-reports.test.ts:56`: `GET /reports/yearly` must return `monthlyTrends` with `length === 12`.
   - `tests/e2e/tier1-feature-coverage/dashboard-reports.test.ts:66-76`: `GET /reports/export/csv` returns `text/csv` with `attachment` header.
   - `tests/e2e/tier2-boundary-corner/financial-boundaries.test.ts:22,49,70`: Missing categories or nominal <= 0 return `422 Unprocessable Entity`.
   - `tests/e2e/tier2-boundary-corner/inventory-boundaries.test.ts:20,35`: Adjustment without reason or resulting in negative stock returns `422 Unprocessable Entity`.
   - `tests/e2e/tier2-boundary-corner/debt-boundaries.test.ts:25,81`: Payment exceeding remaining balance returns `422`. Debt past due date with balance > 0 evaluates to status `'overdue'`.
   - `tests/e2e/tier3-cross-feature/purchase-inventory-expense-atomicity.test.ts:39-73`: `POST /purchases/:id/complete` creates an expense record, increments item stock, and logs stock movement with delta > 0. Replay with identical `Idempotency-Key` header returns `200 OK` without duplicating actions. Completing an already completed purchase without matching key returns `400 Bad Request`.
   - `tests/e2e/tier3-cross-feature/stock-threshold-outbox-events.test.ts:20-34`: Crossing threshold triggers outbox event and item appears in dashboard low stock alerts; subsequent reduction suppresses duplicate event (deduplication).

---

## 2. Logic Chain

1. **From Schema + Contract Observations to Module Design**:
   - `income_sources`, `income_categories`, and `expense_categories` contain partial unique indexes conditioned on `deleted_at IS NULL` (Observation 1). Therefore, service layers must implement soft delete (`UPDATE ... SET deleted_at = NOW()`) rather than SQL `DELETE`, ensuring referential integrity for historical financial transactions.
   - The test assertions (Observation 3) strictly expect HTTP `422 Unprocessable Entity` on validation rejections (nominal <= 0, negative resulting stock, missing adjustment reasons, overpaying debt balances). Therefore, NestJS validation pipes and service exception handling must throw `UnprocessableEntityException` (422) instead of generic `BadRequestException` (400) for business domain validation failures.
2. **From Test Assertions to Stock Status Mapping**:
   - Contract schema `stockStatusEnum` defines `['SAFE', 'LOW', 'OUT']`, but E2E tests T1.19 directly assert `res.body.data.status === 'Aman'`, `'Menipis'`, `'Habis'` (Observation 3).
   - Therefore, the API item serializer must dynamically compute and output `'Aman'` (stock > threshold), `'Menipis'` (0 < stock <= threshold), and `'Habis'` (stock == 0) in the `status` field.
3. **From Purchases Atomicity Requirements to Transaction Implementation**:
   - Observation 3 (T3.1, T3.2, T3.3) requires: (a) status transition `draft` -> `completed`, (b) linked expense record creation, (c) item stock increment with pessimistic locking `FOR UPDATE`, (d) audit log entry insertion in `stock_movements`, (e) outbox notification event insertion, and (f) idempotency verification.
   - All five operations must execute within a single PostgreSQL transaction block (`db.transaction(async (tx) => { ... })`). If any step fails or an unexpected exception occurs, all changes roll back cleanly, satisfying the atomicity acceptance criteria (AC 70-71).
4. **From Debts Lifecycle to Monotonic Balance Deduction**:
   - Observation 1 and 3 (T1.23, T1.24, T2.10-T2.13, T3.4) demand that remaining balance starts equal to principal amount.
   - Recording repayments requires row-level locking (`FOR UPDATE`), validating `amount <= remaining_balance`, monotonic deduction `remaining_balance -= amount`, and transition to `'settled'` when balance reaches 0.
   - Dynamic query inspection must evaluate past due date debts as `'overdue'` when remaining balance > 0.
5. **From Reports Aggregation to Dashboard & Export Spec**:
   - Observation 2 & 3 demonstrate that `/dashboard` returns `summaryCards` (income, expense, net, debts, receivables), `lowStockItems` alert list, and `recentTransactions`.
   - `/reports/yearly` requires a deterministic 12-month array with Indonesian month names (`Januari` through `Desember`) and zero-value representation for inactive months.
   - `/reports/export/csv` requires RFC 4180 CSV with UTF-8 BOM (`\uFEFF`) and Indonesian headers.

---

## 3. Caveats

1. **Dual Endpoint Aliases**: E2E tests use `POST /api/v1/items/:id/stock-adjustments` while the prompt mentions `POST /api/v1/items/:id/adjust`. The specification defines both endpoints mapped to the exact same service handler to guarantee 100% interoperability.
2. **Dashboard Query Paths**: The prompt specifies `/api/v1/dashboard/summary`, while E2E tests call `/api/v1/dashboard`. The blueprint supports both `/api/v1/dashboard` and `/api/v1/dashboard/summary`.
3. **Stock Status Representation**: The internal contract enum has `['SAFE', 'LOW', 'OUT']`, but the external API JSON response expected by E2E tests uses Indonesian labels `'Aman' | 'Menipis' | 'Habis'`. The blueprint explicitly mandates serializing `'Aman'`, `'Menipis'`, `'Habis'`.

---

## 4. Conclusion

The domain specification is complete and published at `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m3_domain_3/domain_spec.md`. It provides the complete implementation blueprint for all business domain modules in `apps/api/src/modules/`:
- **Finance Module**: 5 sub-resources with soft delete, IDR integer constraints, and multi-tenant scoping.
- **Inventory Module**: Items, audit movements, dynamic `'Aman' | 'Menipis' | 'Habis'` status, manual adjustment transactions with pessimistic locking and non-negative guards.
- **Purchases Module**: Drafts, server-side subtotal computation, idempotency replay, and atomic multi-entity completion transaction.
- **Debts & Receivables Module**: Principal tracking, overpayment prevention, dynamic overdue calculation, and multi-stage payment lifecycle.
- **Dashboard & Reports Module**: Cash flow summary, zero-continuity 12-month yearly report, and RFC 4180 Indonesian CSV export.
- **Notification Preferences**: Settings CRUD and state-transition deduplicated outbox event emitter.

---

## 5. Verification Method

To independently verify the blueprint:
1. **Blueprint File Inspection**:
   Inspect `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m3_domain_3/domain_spec.md`.
2. **Schema & Contract Alignment**:
   Verify that all Drizzle tables in `packages/db/src/schema/` (`finance.ts`, `inventory.ts`, `purchase.ts`, `debt.ts`, `notification.ts`) and Zod schemas in `packages/contracts/src/` match the specifications in `domain_spec.md`.
3. **Test Invariant Traceability**:
   Cross-reference every test in `tests/e2e/tier1-feature-coverage/`, `tests/e2e/tier2-boundary-corner/`, `tests/e2e/tier3-cross-feature/`, and `tests/e2e/tier4-scenarios/` against the verification matrix in `domain_spec.md §10`.
