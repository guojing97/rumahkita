# Milestone 4 Exploration Handoff Report: 7 Core Pages & Forms Specification

**Agent**: `explorer_m4_pages_3`  
**Working Directory**: `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m4_pages_3`  
**Date**: 2026-10-27  
**Status**: TASK COMPLETE (Hard Handoff)  

---

## 1. Observation

1. **Contracts Verification**:
   - Inspected `packages/contracts/src/` to confirm all validation schemas, enums, formatters, and response types are defined:
     - `packages/contracts/src/common/idr.ts`: `idrAmountSchema`, `formatIDR()`, `parseIDR()`.
     - `packages/contracts/src/reports/report.schema.ts`: `dashboardQuerySchema`, `dashboardSummaryResponseSchema`, `monthlyReportQuerySchema`, `monthlyReportResponseSchema`, `yearlyReportQuerySchema`, `yearlyReportResponseSchema`, `csvExportQuerySchema`.
     - `packages/contracts/src/finance/income.schema.ts` and `expense.schema.ts`: `createIncomeSchema`, `updateIncomeSchema`, `createExpenseSchema`, `updateExpenseSchema`.
     - `packages/contracts/src/purchases/purchase.schema.ts`: `createPurchaseSchema`, `completePurchaseSchema`, `cancelPurchaseSchema`.
     - `packages/contracts/src/inventory/item.schema.ts` and `stock-movement.schema.ts`: `createItemSchema`, `updateItemSchema`, `stockAdjustmentSchema`, `stockStatusEnum` (`SAFE`, `LOW`, `OUT`).
     - `packages/contracts/src/debts/debt.schema.ts`: `createDebtReceivableSchema`, `recordPaymentSchema`, `debtTypeEnum` (`payable`, `receivable`), `debtStatusEnum`.
     - `packages/contracts/src/notifications/notification.schema.ts`: `updateNotificationPreferenceSchema` (validating WhatsApp regex `^\+62[0-9]{8,15}$`).

2. **Backend API Endpoints Observation**:
   - `apps/api/src/modules/reports/dashboard.controller.ts:11`: `@Get(['', 'summary'])` returns summary cards, recent transactions, low stock items, and due soon debts.
   - `apps/api/src/modules/finance/incomes.controller.ts:32-105`: CRUD endpoints for incomes with pagination and filter support.
   - `apps/api/src/modules/finance/expenses.controller.ts:32-105`: CRUD endpoints for expenses with pagination and filter support.
   - `apps/api/src/modules/purchases/purchases.controller.ts:74-96`: `POST /purchases/:id/complete` accepts idempotency key either via header `idempotency-key` or JSON body `idempotencyKey`.
   - `apps/api/src/modules/inventory/items.controller.ts:108-123`: `POST /items/:id/stock-adjustments` enforces mandatory reason and blocks adjustments resulting in negative stock.
   - `apps/api/src/modules/debts/debts.controller.ts:108-123`: `POST /debts-receivables/:id/payments` enforces payment validation disallowing payment > remaining balance.
   - `apps/api/src/modules/reports/reports.controller.ts:21-69`: `GET /reports/monthly`, `GET /reports/yearly` (guaranteeing 12-month zero continuity), and `GET /reports/export/csv` (RFC 4180 streaming download).
   - `apps/api/src/modules/notifications/notification-preferences.controller.ts:17-49`: `GET|PUT /settings/notifications` for Email and WhatsApp channel toggles.

3. **Design System & Layout Compliance**:
   - Inspected `doc/design.md` lines 25–74 and `packages/ui/src/preset.ts`:
     - Tokens: `--bg: #FFFDF7`, `--surface: #FFFFFF`, `--ink: #171717`, `--primary: #C8F169`, `--secondary: #B9D9FF`, `--accent: #FF8A65`.
     - Hard shadow: `4px 4px 0 var(--ink)` (cards, buttons), `6px 6px 0 var(--ink)` (dialogs/modals), `2px 2px 0 var(--ink)` (active).
     - Radius: `8px` (buttons, inputs), `10px` (cards), `12px` (modals).
     - Tabular numbers: `tabular-nums` class on all currency values.
     - Responsive reflow: desktop TanStack table -> mobile card list.

---

## 2. Logic Chain

1. **Mapping Business Rules to Frontend Pages**:
   - The user request (§R4) and PRD (§6.1 to §6.11) specify 7 primary pages for household management:
     1. `/dashboard`: 4 summary cards, Recharts cashflow bar chart, recent transactions (5 items), low stock widget, due soon debts panel.
     2. `/transaksi`: Incomes and expenses unified page with tab filter, date/category filters, TanStack table on desktop, cards on mobile, and create/edit modals powered by React Hook Form + Zod.
     3. `/belanja`: Draft purchases list, dynamic item rows with quantity/unit price and live line subtotal, confirmation modal with atomic stock increment preview, and client-generated UUID idempotency key.
     4. `/inventori`: Items list with status badges (`Aman ✓`, `Menipis ⚠`, `Habis ✕`), min_stock indicator, "Tambah Barang" modal, and "Sesuaikan Stok" modal with client pre-check preventing negative stock.
     5. `/hutang`: Hutang/Piutang dual tabs, repayment progress bar `((principal - remaining) / principal) * 100%`, and "Catat Pembayaran" modal with real-time balance validation.
     6. `/laporan`: Monthly/Yearly cashflow views with 12-month continuity chart, category breakdown with budget comparison, and direct RFC 4180 CSV export download button.
     7. `/pengaturan`: Household profile, member list & invite modal, income source / expense category master data, and notification preferences (Email & WhatsApp toggles with `+62` regex).

2. **Ensuring Implementation Readiness**:
   - Writing `pages_spec.md` with explicit data flow, exact endpoint bindings, DTO schemas, form input masking, error envelope translation, and responsive breakpoint rules enables the implementer agents to build the frontend without ambiguity or missing requirements.

---

## 3. Caveats

- **Mock vs Live Backend**: The NestJS API is fully implemented and tested (M3 passed 56/56 E2E tests). In M4, Next.js can communicate with the backend either directly or through the Next.js Route Handler BFF proxy (`/api/[...path]/route.ts`).
- **Playwright Test Runner**: Playwright responsive tests will execute in Milestone 4 / Milestone 5 to verify viewports 390px and 1280px.

---

## 4. Conclusion

The comprehensive technical specification for all 7 core pages and forms has been fully drafted and saved to:
`/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m4_pages_3/pages_spec.md`

The specification details:
- Complete component architecture, props, and state management for each page.
- Exact React Hook Form + Zod schema integrations.
- Table-to-card responsive reflow specifications (390px mobile to 1280px desktop).
- Safety validations (real-time IDR masking, non-negative stock prevention, payment balance limits, UUID idempotency keys).
- Full file structure and code layout for `apps/web/src/`.

---

## 5. Verification Method

To verify the specification:
1. Inspect `pages_spec.md`:
   ```bash
   cat /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m4_pages_3/pages_spec.md
   ```
2. Verify contracts alignment:
   ```bash
   pnpm --filter contracts typecheck
   pnpm --filter contracts test
   ```
3. Verify backend endpoint alignment:
   ```bash
   API_BASE_URL=http://localhost:4000/api/v1 node tests/e2e/runner.ts
   ```

### Invalidation Conditions
- Any of the 7 core pages is missing form validation rules or contract mappings.
- Purchase completion flow fails to specify idempotency key handling or stock preview.
- Debt payment flow fails to enforce balance limit validation.
- Inventory adjustment allows negative stock or omits mandatory reason.
