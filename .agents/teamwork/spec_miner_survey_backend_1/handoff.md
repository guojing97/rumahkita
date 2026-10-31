# Handoff Report: Spec Miner 1 (Backend & Database Domain)

**Agent:** Spec Miner 1 (`spec_miner_survey_backend_1`)  
**Recipient:** Orchestrator (`c4aff318-95ce-46a6-8cfa-3b57f0b6f8fb`)  
**Date:** 2026-10-27  
**Artifact Generated:** `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/spec_miner_survey_backend_1/survey_report.md`  

---

## 1. Observation

Direct observations extracted from authoritative reference documents:

1. **Monorepo Architecture & Technology Stack:**
   - From `ORIGINAL_REQUEST.md:19-20`: "Turborepo + pnpm workspace monorepo with three apps (`web` — Next.js App Router, `api` — NestJS, `worker` — notification outbox consumer) and shared packages (`db` — Drizzle ORM schema/migrations, `contracts` — shared Zod schemas & types, `ui` — shadcn/ui neo-brutalism components...)".
   - From `Doc/prd.md:436-466`: Stack explicitly defined as Turborepo, Next.js App Router, NestJS, PostgreSQL, Drizzle ORM, Zod, and PostgreSQL outbox worker.

2. **Database Entities and Rules:**
   - From `ORIGINAL_REQUEST.md:22-23`: "Design and implement all PostgreSQL tables via Drizzle ORM in `packages/db` as specified in the PRD §9 entity list (18 tables: `users`, `refresh_sessions`, `households`, `household_members`, `income_sources`, `income_categories`, `expense_categories`, `incomes`, `expenses`, `items`, `stock_movements`, `purchases`, `purchase_items`, `debts_receivables`, `debt_receivable_payments`, `notification_preferences`, `notification_events`, `audit_logs`). All PKs use UUID. Monetary columns use `numeric(14,0)` (integer Rupiah, never float). Audit columns (`created_at`, `updated_at`, `created_by`, `updated_by`) on all business tables. Soft delete via `deleted_at` on master data. Enums via `pgEnum`."
   - From `plan.md:79-99`: Schemas partitioned into `auth.ts`, `household.ts`, `finance.ts`, `inventory.ts`, `purchase.ts`, `debt.ts`, `notification.ts`, and `audit.ts`.

3. **REST API Endpoints & Auth / Security:**
   - From `Doc/prd.md:360-388` (§10) and `ORIGINAL_REQUEST.md:26-39`: Base path `/api/v1`.
   - From `Doc/prd.md:115-129` (§6.1) & `391-416` (§11): Argon2id password hashing, JWT 15-minute access token, 7-day refresh token stored in `HttpOnly`, `Secure`, `SameSite` cookie, refresh token rotation with reuse detection, and session invalidation.
   - Every business query and mutation must enforce `household_id` filtering; cross-household requests must return `403 Forbidden` (`ORIGINAL_REQUEST.md:58`, `Doc/prd.md:72-74`).

4. **Transactional Invariants & Outbox Model:**
   - From `ORIGINAL_REQUEST.md:30, 70-71` & `Doc/prd.md:205-207`: `POST /purchases/:id/complete` creates exactly 1 expense record and increments item stock atomically within a single PostgreSQL transaction (`db.transaction`). If interrupted, no partial changes persist.
   - From `ORIGINAL_REQUEST.md:31, 72-73`: Stock adjustments require a mandatory `reason` (HTTP 422 if missing) and cannot result in negative stock.
   - From `ORIGINAL_REQUEST.md:32, 76-78`: Debt payments cannot exceed remaining balance (HTTP 422), and remaining balance updates monotonically (`remaining_balance = principal - payments`).
   - From `Doc/prd.md:255-263, 303-311` & `ORIGINAL_REQUEST.md:80-84`: Outbox events are written to `notification_events` only upon stock transition (`Aman` -> `Menipis`/`Habis`), avoiding duplicate alerts on subsequent checks.

---

## 2. Logic Chain

1. **Entity Modeling Logic:**
   - Observation #2 establishes that there are exactly 18 tables spread across 8 domain files.
   - Because Indonesian currency is non-fractional Rupiah and values can scale into tens of millions or billions, `NUMERIC(14,0)` prevents floating point arithmetic rounding issues while comfortably handling up to Rp99,999,999,999,999.
   - Because B-Tree index locality is critical for performance on UUID primary keys, UUIDv7 (or `defaultRandom()`) is specified.
   - To prevent orphaned records in historical reports when categories or sources are renamed/archived, `deleted_at` soft deletion is applied to all master data entities (`income_sources`, `income_categories`, `expense_categories`, `items`).

2. **API & Security Boundary Logic:**
   - Observation #3 establishes multi-tenant isolation within a shared database.
   - Relying solely on client filtering or route hiding is explicitly disallowed by PRD §4.
   - Therefore, a NestJS `HouseholdGuard` and JWT decorator must inject `req.householdId` into all controller contexts, and service repository layers must append `eq(table.householdId, req.householdId)` to all queries and writes.
   - Using SHA-256 hashes of refresh tokens in `refresh_sessions` ensures that even a database dump cannot be exploited to forge active sessions.
   - Token reuse detection revokes the entire `family_id` token lineage, mitigating token theft risks.

3. **Transactional Business Logic:**
   - Observation #4 dictates that a purchase represents both an inventory arrival and an operational expenditure.
   - If stock movement succeeded but expense creation failed, accounting reports would diverge from physical stock.
   - Therefore, atomic database transactions (`db.transaction`) wrapping expense creation, stock movement logging, item quantity updates, and idempotency key checks are strictly required.
   - Similarly, debt payment integrity requires locking the target debt row (`FOR UPDATE`), verifying `amount <= remaining_balance`, and transitioning status to `Settled` or `PartiallyPaid` in the same transaction.

4. **Background Worker & Deduplication Logic:**
   - Asynchronous notification processing avoids latency spikes and external network timeouts during user HTTP requests.
   - Storing events in `notification_events` during the stock update transaction guarantees at-least-once persistence.
   - Deduplication by state transition (`previousStock > threshold` AND `newStock <= threshold`) guarantees that repeated reads or minor adjustments while already low do not spam users via WhatsApp or email.

---

## 3. Caveats

1. **OpenAPI / Swagger Generation:** The exact list of DTO decorators is documented conceptually based on `class-validator` / `class-transformer` or `@anatine/zod-nestjs` based on monorepo shared Zod contracts.
2. **External Notification Providers:** Resend/SMTP and WhatsApp Cloud API are specified to run with MVP stubs / mock loggers during initial implementation phases per `ORIGINAL_REQUEST.md:52` and `plan.md:330-335`.
3. **Multi-Household Architecture:** Although the MVP data model supports multiple households, the product persona is scoped to a single household with two members (owner and member).

---

## 4. Conclusion

The backend and database domain specification has been completely mined, cross-referenced, and exhaustively documented in `survey_report.md`. The specification provides:
- Exact schema definitions, types, constraints, and indexes for all 18 PostgreSQL tables in Drizzle ORM.
- Detailed contracts for 30 API features covering authentication, household management, master data, incomes, expenses, items, purchases, debts, dashboard, reports, CSV export, and notification settings.
- Rigid transactional invariants for purchase completion, stock adjustments, and debt payments.
- Robust outbox architecture with transition-based deduplication rules.
- Test assertion mapping for all 20 backend acceptance criteria.

The survey report is ready for consumption by Phase 0B (`packages/db`), Phase 0C (`apps/api`), Phase 2 (`apps/worker`), and downstream test authoring agents.

---

## 5. Verification Method

To independently verify the completeness and accuracy of this survey report:

1. **Verify Entity Count & Columns:**
   - Inspect `survey_report.md §4` against `Doc/prd.md §9` and `ORIGINAL_REQUEST.md §R2`.
   - Confirm all 18 tables (`users`, `refresh_sessions`, `households`, `household_members`, `income_sources`, `income_categories`, `expense_categories`, `incomes`, `expenses`, `items`, `stock_movements`, `purchases`, `purchase_items`, `debts_receivables`, `debt_receivable_payments`, `notification_preferences`, `notification_events`, `audit_logs`) are defined with primary keys, foreign keys, `numeric(14,0)` monetary types, and audit columns.

2. **Verify API Endpoints:**
   - Inspect `survey_report.md §5` against `Doc/prd.md §10`.
   - Confirm all endpoints (`/auth/*`, `/household/*`, `/income-sources/*`, `/incomes/*`, `/expenses/*`, `/items/*`, `/purchases/*`, `/debts-receivables/*`, `/dashboard`, `/reports/*`, `/settings/notifications/*`) have defined request payloads, query params, response shapes, and HTTP status codes (200, 201, 400, 401, 403, 422).

3. **Verify Business Logic & Edge Cases:**
   - Inspect `survey_report.md §3` (Edge Cases table) and `survey_report.md §7` (Invariants).
   - Confirm purchase completion atomicity, stock non-negative constraint, debt balance deduction, and outbox transition deduplication match the acceptance criteria in `ORIGINAL_REQUEST.md:54-89`.
