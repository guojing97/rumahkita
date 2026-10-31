## 2026-10-27T18:00:50Z
You are explorer_m4_pages_3 for Milestone 4 (Frontend Web with Next.js App Router) for the RumahKita household finance & inventory application MVP.

Your working directory is:
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m4_pages_3

Authoritative user request (MUST READ FIRST):
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/ORIGINAL_REQUEST.md

Master Project Index:
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/PROJECT.md

Design Spec & PRD:
- /Users/mac/Projects/03-Labs/RumahKita/doc/design.md
- /Users/mac/Projects/03-Labs/RumahKita/doc/prd.md

Backend API Reference & Endpoints:
- /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/worker_m3_api_2/handoff.md

Contracts:
- /Users/mac/Projects/03-Labs/RumahKita/packages/contracts

Mission:
Explore and produce a comprehensive technical specification (`pages_spec.md`) covering all 7 core pages and forms:
1. `/dashboard`:
   - Summary cards: Total Income (Pemasukan), Total Expense (Pengeluaran), Net Savings (Sisa Bersih), Low Stock Alert Count.
   - Recharts Bar Chart: Monthly cash flow comparison (Pemasukan vs Pengeluaran).
   - Recent Transactions widget (last 5 entries).
   - Low Stock Alert widget (quick link to Belanja/Inventori).
2. `/transaksi` (Incomes & Expenses):
   - Incomes & Expenses unified page with tabs/filters, pagination, category filter.
   - Modals: "Catat Pemasukan" and "Catat Pengeluaran" with React Hook Form + Zod contracts (`createIncomeSchema`, `createExpenseSchema`).
3. `/belanja` (Purchases & Procurement):
   - Draft purchases list + Create Draft button.
   - Draft Editor: item selector combobox, dynamic items table/card list, quantity and unit price inputs, line subtotal calculation.
   - "Selesaikan Pembelian" modal: displays total nominal and stock increment preview; triggers `POST /purchases/:id/complete` with idempotency key.
4. `/inventori` (Items & Stock):
   - Items list with status badges (`Aman`, `Menipis`, `Habis`), min_stock indicator.
   - "Tambah Barang" modal (`createItemSchema`).
   - "Sesuaikan Stok" modal (`stockAdjustmentSchema`): delta input, mandatory reason dropdown/text, validation preventing negative stock.
5. `/hutang` (Debts & Receivables):
   - Hutang (Payables) & Piutang (Receivables) dual tabs.
   - Repayment progress bar (`(principal - remaining) / principal * 100%`).
   - "Catat Pembayaran" modal (`recordPaymentSchema`): real-time balance validation (disallow payment > remaining balance).
6. `/laporan` (Reports & Analytics):
   - Monthly and Yearly cash flow breakdown, zero-month continuity chart.
   - Category breakdown table (Nominal, Percentage, Budget comparison).
   - "Unduh CSV" button triggering `GET /reports/export/csv` download with RFC 4180 formatting.
7. `/pengaturan` (Settings & Preferences):
   - Household profile details and members list.
   - Notification channel preferences (Email, WhatsApp) toggle switches.
8. Output your detailed specification in `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m4_pages_3/pages_spec.md` and send a completion message to orchestrator (`b7285ab7-91ac-41dd-b752-01f7c3a3dbb1`).
