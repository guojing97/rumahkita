# Original User Request

## 2026-10-27T12:30:32Z

Build a private household finance & inventory web application (MVP) for two household members to track income, expenses, purchases, inventory/stock, debts/receivables, and generate monthly/yearly reports with CSV export. Indonesian locale (`id-ID`, IDR, `Asia/Jakarta`). Neo-brutalism visual design.

Working directory: /Users/mac/Projects/03-Labs/RumahKita
Integrity mode: development

Reference material:
- PRD: `/Users/mac/Projects/03-Labs/RumahKita/doc/prd.md` (584 lines — full product requirements, entities, API spec, business rules, security requirements)
- Design spec: `/Users/mac/Projects/03-Labs/RumahKita/doc/design.md` (359 lines — neo-brutalism tokens, layout, page specs, component specs, responsive rules, copywriting)
- Implementation plan: `/Users/mac/.gemini/antigravity-cli/brain/13245091-e296-474c-b5a5-5860f1bb35db/plan.md` (detailed phase breakdown, Drizzle schema patterns, migration strategy, execution order)

Read all three reference files thoroughly before starting — they contain the complete specification.

## Requirements

### R1. Monorepo Foundation
Set up a Turborepo + pnpm workspace monorepo with three apps (`web` — Next.js App Router, `api` — NestJS, `worker` — notification outbox consumer) and shared packages (`db` — Drizzle ORM schema/migrations, `contracts` — shared Zod schemas & types, `ui` — shadcn/ui neo-brutalism components, `eslint-config`, `typescript-config`). Include Docker Compose for PostgreSQL dev environment. `pnpm install && pnpm dev` should boot all apps.

### R2. Database Schema with Drizzle ORM
Design and implement all PostgreSQL tables via Drizzle ORM in `packages/db` as specified in the PRD §9 entity list (18 tables: `users`, `refresh_sessions`, `households`, `household_members`, `income_sources`, `income_categories`, `expense_categories`, `incomes`, `expenses`, `items`, `stock_movements`, `purchases`, `purchase_items`, `debts_receivables`, `debt_receivable_payments`, `notification_preferences`, `notification_events`, `audit_logs`). All PKs use UUID. Monetary columns use `numeric(14,0)` (integer Rupiah, never float). Audit columns (`created_at`, `updated_at`, `created_by`, `updated_by`) on all business tables. Soft delete via `deleted_at` on master data. Enums via `pgEnum`. Generate initial migration via `drizzle-kit generate` and apply via `drizzle-kit migrate`. Include seed script with a household, 2 users, default categories, and sample items.

### R3. Backend API (NestJS)
Implement a RESTful API at `/api/v1` covering all endpoints in PRD §10:
- JWT auth with 15-min access token, 7-day refresh token in HttpOnly/Secure/SameSite cookie, rotation on use, reuse detection, Argon2id password hashing
- Household membership guard on every business query
- CRUD for income sources, categories, incomes, expenses, items, purchases, debts/receivables
- Atomic purchase completion: expense + stock movements + stock update in one PostgreSQL transaction with idempotency key
- Stock adjustments with mandatory reason
- Debt/receivable payment recording with balance validation
- Dashboard aggregation and monthly/yearly report endpoints
- CSV export
- Notification preferences CRUD
- Rate limiting on auth endpoints
- Swagger/OpenAPI docs
- Structured error responses — never leak stack traces or DB schema

### R4. Frontend (Next.js App Router)
Build all UI pages per design spec (`design.md`):
- Login, dashboard (4 stat cards, income vs expense chart via Recharts, recent transactions, low stock items, period selector), income/expense list pages (TanStack Table on desktop, card list on mobile), purchase creation flow (item combobox, confirmation dialog with stock impact preview), inventory list with status badges (Aman ✓ / Menipis ⚠ / Habis ✕), hutang & piutang tabs with payment recording, reports with charts and CSV export, settings page
- Neo-brutalism design tokens from design spec §2: `--bg: #FFFDF7`, `--ink: #171717`, `--primary: #C8F169`, hard shadows `4px 4px 0`, 2px ink borders, 8-12px radius
- Space Grotesk headings, Inter body, `tabular-nums` for financial figures
- IDR formatting via `Intl.NumberFormat('id-ID', ...)`
- All forms: React Hook Form + Zod validation, visible labels, error messages near fields
- Responsive: mobile-first, tables → card lists, sticky submit buttons, bottom nav on mobile
- Loading, empty, error, and success states for all pages
- BFF proxy pattern: Next.js proxies to NestJS API

### R5. Notification Worker
Implement outbox-based notification worker in `apps/worker` that polls `notification_events`, sends email (Resend/SMTP — can be stubbed for MVP) and WhatsApp (Cloud API — stub with logging), with deduplication (notify only on safe→low/out transition), retry with exponential backoff, and delivery status tracking in the database.

## Acceptance Criteria

### Auth & Security
- [ ] Two seeded users can log in and access the same household's data
- [ ] API request with a valid token but for another household's data returns 403
- [ ] Access token expires after 15 minutes; refresh endpoint issues new token pair with rotated refresh token
- [ ] Logout invalidates the refresh session so the old refresh token fails
- [ ] Passwords in the database are Argon2id hashes, not plaintext

### Financial Transactions
- [ ] Creating an income with nominal ≤ 0 returns 422 validation error
- [ ] Creating an expense without a category returns 422 validation error
- [ ] `GET /dashboard` total income for a period equals the sum of individual income records in that period
- [ ] `GET /reports/monthly` figures match the aggregation of stored transactions

### Purchase → Stock Atomicity
- [ ] `POST /purchases/:id/complete` creates exactly one expense record and increments item stock by the purchase quantity
- [ ] If the purchase completion transaction is interrupted (simulated error), no expense or stock change persists
- [ ] `POST /items/:id/stock-adjustments` without a `reason` field returns 422
- [ ] Stock cannot go below zero — attempting to adjust below zero returns a validation error

### Debts & Receivables
- [ ] After creating a debt of 1,000,000 and recording a payment of 300,000, remaining balance is 700,000
- [ ] Recording a payment exceeding the remaining balance returns 422
- [ ] A debt past its due_date with remaining balance > 0 shows status `Overdue`

### Notifications
- [ ] Completing a purchase that brings stock from above threshold to at/below threshold creates a notification event
- [ ] A second stock check on an already-low item does not create a duplicate notification event
- [ ] Worker processes the event and updates `notification_events.status`

### Database & Migrations
- [ ] `pnpm --filter db db:migrate` applies all migrations cleanly on a fresh PostgreSQL database
- [ ] `pnpm --filter db db:seed` populates the database with sample data without errors
- [ ] Every business table has a `household_id` column with a foreign key and an index

### UI Responsiveness
- [ ] The "add expense" flow completes successfully on a 390px viewport (mobile)
- [ ] The "add expense" flow completes successfully on a 1280px viewport (desktop)
- [ ] Expense list renders as a table on desktop and card list on mobile
- [ ] All form inputs have visible labels (not just placeholders) and error messages appear near the field

### Build & Dev Experience
- [ ] `pnpm install` succeeds without errors
- [ ] `pnpm dev` starts all three apps (web, api, worker) concurrently
- [ ] `pnpm build` compiles all apps and packages without TypeScript errors
- [ ] Swagger UI is accessible at the API's `/api/docs` endpoint
