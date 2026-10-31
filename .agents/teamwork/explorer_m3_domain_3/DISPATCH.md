## 2026-10-27T14:30:52Z
You are Explorer 3 (Business Domain & Transactions Explorer) for Milestone 3: Backend API (NestJS REST API /api/v1).
Your working directory is `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m3_domain_3`.

MANDATORY FIRST STEP:
Read `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/ORIGINAL_REQUEST.md` and `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/PROJECT.md`.
Read the backend developer skill at `/Users/mac/.gemini/config/skills/backend-developer/SKILL.md`.
Inspect `packages/db/src/schema/` (especially `finance.ts`, `inventory.ts`, `purchase.ts`, `debt.ts`, `notification.ts`).
Inspect `packages/contracts/src/schemas/` and `tests/e2e/cases/` (tier 1 through tier 4 tests).

TASK:
Produce an exhaustive blueprint for all business domain modules in `apps/api/src/modules/`:
1. Finance Module:
   - `income-sources` and `income-categories`: CRUD with soft-delete (`deleted_at`).
   - `expense-categories`: CRUD with IDR budget limits (`budget_limit`), soft-delete.
   - `incomes`: CRUD, query filtering (startDate, endDate, sourceId, categoryId).
   - `expenses`: CRUD, query filtering (startDate, endDate, categoryId).
2. Inventory Module:
   - `items`: CRUD with soft-delete, unit (`kg`, `pcs`, `liter`, etc.), `quantity_on_hand`, `low_stock_threshold`.
   - Dynamic status helper: `Aman` (stock > threshold), `Menipis` (0 < stock <= threshold), `Habis` (stock == 0).
   - `stock-movements`: audit log of stock changes (`adjustment_in`, `adjustment_out`, `purchase`, `waste`, `correction`). Manual adjustment endpoint `POST /api/v1/items/:id/adjust` requiring reason.
3. Purchases Module & Atomic Completion:
   - `purchases` drafts: create purchase with items list and total amount, calculate subtotal per item.
   - Idempotency key handling (`idempotency_key` unique index).
   - Atomic Completion Endpoint `POST /api/v1/purchases/:id/complete`:
     Executed inside a database transaction (`db.transaction`):
     a. Transition purchase status: `DRAFT` -> `COMPLETED`.
     b. Automatically create an expense record in `expenses` (`nominal = purchase.totalAmount`, `paymentMethod = purchase.paymentMethod`, `categoryId = purchase.expenseCategoryId`, `purchaseId = purchase.id`).
     c. For each line item in `purchase_items`: increment `items.quantity_on_hand += item.quantity`, insert `stock_movements` record (`reason = 'purchase'`, `quantity_delta = +item.quantity`, `resulting_quantity`).
     d. Stock threshold transition check: if item transitioned status, emit outbox event if applicable.
4. Debts & Receivables Module:
   - `debts-receivables`: create/update debt (`type: 'payable' | 'receivable'`, `principal_amount`, `remaining_balance`, `due_date`, `status`).
   - Repayments endpoint `POST /api/v1/debts-receivables/:id/payments`:
     Executed in transaction: inserts `debt_receivable_payments`, decrements `remaining_balance -= payment.amount`, updates status (`settled` if remaining_balance == 0, else `partially_paid`).
5. Dashboard & Reports Module:
   - `/api/v1/dashboard/summary`: monthly cash flow (total income, total expense, net balance, expense category breakdown, budget utilization, count of items Menipis/Habis, pending debts/receivables).
   - `/api/v1/reports/monthly` and `/api/v1/reports/yearly`: aggregations.
   - `/api/v1/reports/export/csv`: Indonesian CSV export (`id-ID` locale, semicolon/comma delimiter, IDR currency formatting, Asia/Jakarta timestamp).
6. Notification Preferences:
   - `/api/v1/notifications/preferences`: get/update threshold notification settings.

Write your complete domain specification to `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m3_domain_3/domain_spec.md`.
Communicate your completion back to the parent orchestrator via send_message. Do NOT implement application source code.
