# Dispatch: Reviewer 2 for Milestone 4 (Frontend Web with Next.js)

Role: teamwork_preview_reviewer
Working Directory: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/reviewer_m4_2
Scope: Verify BFF proxy integration, auth state management, form validation (Zod schemas), and atomic modals across all 7 pages.
Authoritative Request: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/ORIGINAL_REQUEST.md
Project Index: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/PROJECT.md
Design Spec: /Users/mac/Projects/03-Labs/RumahKita/doc/design.md
Worker Handoff: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/worker_m4_web_1/handoff.md
## 2026-10-27T18:39:59Z

You are reviewer_m4_2 for Milestone 4 (Frontend Web with Next.js App Router) for the RumahKita household finance & inventory application MVP.

Your working directory is:
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/reviewer_m4_2

Authoritative user request (MUST READ BEFORE STARTING):
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/ORIGINAL_REQUEST.md

Master Project Index & Feature Inventory:
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/PROJECT.md

Design Spec & PRD:
- /Users/mac/Projects/03-Labs/RumahKita/doc/design.md
- /Users/mac/Projects/03-Labs/RumahKita/doc/prd.md

Worker Handoff Report:
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/worker_m4_web_1/handoff.md

Review Instructions:
1. Read ORIGINAL_REQUEST.md, PROJECT.md, and doc/design.md.
2. Review functionality, state, and API integration in `apps/web/`:
   - BFF Proxy Route Handler (`apps/web/src/app/api/[...path]/route.ts`): cookie forwarding, auth/tenant/idempotency headers, streaming RFC 4180 CSV export.
   - Auth & Session Context: in-memory token, silent refresh queue, multi-tenant HouseholdProvider.
   - Core page features and forms:
     - `/dashboard`: 4 stat cards, Recharts cash flow bar chart, recent transactions, low stock widget.
     - `/transaksi`: Incomes & Expenses unified page, Add Income / Add Expense modals with Zod validation.
     - `/belanja`: Draft purchases list, item combobox selector, dynamic rows with line subtotal, Complete Purchase modal with stock increment preview and UUID idempotency key.
     - `/inventori`: Items catalog with status badges, Add Item modal, Manual Stock Adjustment modal (mandatory reason, negative stock prevention).
     - `/hutang`: Hutang & Piutang tabs, repayment progress bar, Record Payment modal (payment <= remaining balance).
     - `/laporan`: Monthly/Yearly cashflow views, 12-month zero continuity Recharts bar chart, category breakdown tables, and 1-click Indonesian CSV export button.
     - `/pengaturan`: Household profile, members list, and notification preferences toggles.
3. Verify compilation and builds:
   - Run `pnpm --filter @rumahkita/web typecheck`
   - Run `pnpm --filter @rumahkita/web lint`
   - Run `pnpm --filter @rumahkita/web test`
   - Run `pnpm --filter @rumahkita/web build`
4. Write your review report in `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/reviewer_m4_2/handoff.md` with an explicit verdict: **APPROVE** or **REQUEST_CHANGES**.
5. Send a completion message to the orchestrator (`b7285ab7-91ac-41dd-b752-01f7c3a3dbb1`).
