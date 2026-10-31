# Milestone 2: Database Schema with Drizzle ORM — Review & Adversarial Report

**Reviewer:** Reviewer 1 (`reviewer_m2_1`)  
**Roles:** Reviewer, Adversarial Critic  
**Scope:** Milestone 2 Database Schema, Migrations, Idempotent Seeder, and Integrity Attestation (`packages/db/`)  
**Verdict:** **APPROVE**  
**Date:** 2026-10-27  

---

## 1. Observation

### 1.1 Direct File Inspections
The following source, configuration, and migration files in `packages/db/` were independently inspected line-by-line:
1. `packages/db/src/schema/common.ts`: Declares `auditColumns` (`createdAt`, `updatedAt`, `createdBy`, `updatedBy`), `softDeleteColumn` (`deletedAt: timestamp with time zone`), `idrNumeric` helper (`numeric(name, { precision: 14, scale: 0 })`), and `paymentMethodEnum` (`'cash' | 'transfer' | 'ewallet' | 'other'`).
2. `packages/db/src/schema/auth.ts`: `users` (UUID PK, `email`, `password_hash`, `full_name`, `phone_number`, `is_active`) and `refresh_sessions` (UUID PK, `user_id` FK cascading to `users.id`, `token_hash`, `family_id`, `is_revoked`, `expires_at`, `user_agent`, `ip_address`).
3. `packages/db/src/schema/household.ts`: `households` (UUID PK, `name`, `currency` default 'IDR', `timezone` default 'Asia/Jakarta') and `household_members` (UUID PK, `household_id` cascading FK, `user_id` cascading FK, `role` enum `'owner' | 'member'`, unique index on `(household_id, user_id)`).
4. `packages/db/src/schema/finance.ts`: `income_sources`, `income_categories`, `expense_categories`, `incomes`, and `expenses`. Enforces non-nullable `household_id` cascading FKs, check constraints `nominal > 0`, and partial unique indexes `WHERE deleted_at IS NULL`.
5. `packages/db/src/schema/inventory.ts`: `items` and `stock_movements`. Enforces non-nullable `household_id`, check constraints `quantity_on_hand >= 0`, `low_stock_threshold >= 0`, `quantity_delta != 0`, `resulting_quantity >= 0`, and partial unique index on `(household_id, name) WHERE deleted_at IS NULL`.
6. `packages/db/src/schema/purchase.ts`: `purchases` and `purchase_items`. Enforces non-nullable `household_id` on purchases, unique index on `idempotency_key`, check constraint `total_amount >= 0`, and non-negative line item constraints (`quantity > 0`, `unit_price >= 0`, `subtotal >= 0`).
7. `packages/db/src/schema/debt.ts`: `debts_receivables` and `debt_receivable_payments`. Enforces `type` (`payable | receivable`), `status` (`open | partially_paid | settled | overdue | cancelled`), check constraints `principal_amount > 0`, `remaining_balance >= 0`, `amount > 0`, and explicit tenant indexing.
8. `packages/db/src/schema/notification.ts`: `notification_preferences` (composite unique index on `household_id, user_id`) and `notification_events` (transactional outbox with `(status, next_retry_at, created_at)` polling index, `attempts`, `max_attempts`, JSONB payload).
9. `packages/db/src/schema/audit.ts`: `audit_logs` (non-nullable `household_id`, JSONB changes diff, client metadata, tenant indexing).
10. `packages/db/src/schema/relations.ts`: Bidirectional Drizzle ORM relations across all 18 tables.
11. `packages/db/src/migrate.ts`: Programmatic runner using `drizzle-orm/postgres-js/migrator` with dedicated `max: 1` DDL connection and guaranteed `migrationClient.end()` in `finally`.
12. `packages/db/src/seed.ts`: 100% idempotent seeder populating 2 households, 3 users (Argon2id `Password123!`), 4 income sources, 3 income categories, 8 expense categories with IDR budgets, 5 inventory items (covering Aman, Menipis, Habis), 4 stock movements, 4 debts/receivables with 2 payments, and 8 transaction records.
13. `packages/db/drizzle/0000_sad_thaddeus_ross.sql`: Deterministic PostgreSQL DDL script creating all 8 enums, 18 tables, 13 check constraints, 45 foreign keys, and 33 indexes.

---

### 1.2 Command Verifications (Executed Independently)

| Command | Result | Notes |
|---|---|---|
| `pnpm --filter db test` | **PASS** (17/17 tests pass, 234ms) | Tested schema exports, enums, helpers, DB client factory, seeder identities |
| `pnpm --filter db db:generate` | **PASS** (0 schema changes) | Confirmed `0000_sad_thaddeus_ross.sql` is 100% in sync with TypeScript schemas |
| `pnpm build --force` | **PASS** (6/6 targets successful) | Compiled all apps and packages cleanly |
| `pnpm typecheck --force` | **PASS** (9/9 targets successful) | No TypeScript type errors across monorepo |
| `pnpm lint --force` | **PASS** (3/3 targets successful) | No ESLint errors or warnings |
| `pnpm test --force` | **PASS** (38/38 tests pass) | 21 `@rumahkita/contracts` tests + 17 `@rumahkita/db` tests pass |
| `pnpm --filter db db:migrate` | **PASS** (completed in 39ms) | Applied all migrations cleanly to PostgreSQL 16 Alpine container |
| `pnpm --filter db db:seed` (Run 1) | **PASS** | Provisioned 2 households, 3 users, master data, items, transactions |
| `pnpm --filter db db:seed` (Run 2) | **PASS** (Idempotent) | Zero duplicate key errors, in-place updates executed cleanly |

---

### 1.3 Database Direct Query Verifications (PostgreSQL 16 Alpine)
- **Table Count**: 18 tables in `public` schema (`information_schema.tables`).
- **Check Constraints**: 13 active check constraints (`chk_expenses_nominal_positive`, `chk_incomes_nominal_positive`, `chk_items_quantity_on_hand_non_negative`, `chk_items_low_stock_threshold_non_negative`, `chk_stock_movements_delta_non_zero`, `chk_stock_movements_resulting_non_negative`, `chk_purchase_items_quantity_positive`, `chk_purchase_items_unit_price_non_negative`, `chk_purchase_items_subtotal_non_negative`, `chk_purchases_total_non_negative`, `chk_debt_payments_amount_positive`, `chk_debts_principal_positive`, `chk_debts_balance_non_negative`).
- **Monetary Precision**: All 9 currency columns strictly use `numeric(14,0)` (scale 0, precision 14), with zero floating point or inexact types.
- **Multi-Tenancy Nullability**: All 13 tenant entity tables define `household_id` as `is_nullable = NO` and `data_type = uuid`.
- **Tenant Indexes**: All 13 tenant tables have explicit B-Tree indexes indexed on or leading with `household_id`.
- **Partial Unique Indexes**: `items`, `income_sources`, `income_categories`, and `expense_categories` define unique indexes on `(household_id, name) WHERE (deleted_at IS NULL)`.
- **Foreign Key Actions**: `household_id` uses `ON DELETE CASCADE`. Financial creator IDs (`created_by`) use `ON DELETE RESTRICT` to protect against accidental financial audit orphan deletion.

---

## 2. Logic Chain

1. **Multi-Tenant Invariants (PRD §4, §9 & Task Criterion 2):**
   - Business entities (`households`, `household_members`, `income_sources`, `income_categories`, `expense_categories`, `incomes`, `expenses`, `items`, `stock_movements`, `purchases`, `debts_receivables`, `notification_preferences`, `notification_events`, `audit_logs`) have non-nullable `household_id` columns with cascading foreign keys to `households.id`.
   - Explicit indexes exist on `household_id` for every tenant table, ensuring performant tenant query partitioning.
   - Child line entities (`purchase_items`, `debt_receivable_payments`) cascade directly to their respective parent entity (`purchases`, `debts_receivables`), adhering to standard normalized relational design.

2. **Monetary Precision & Financial Integrity (PRD §8 & Task Criterion 3):**
   - All 9 monetary columns (`incomes.nominal`, `expenses.nominal`, `purchases.total_amount`, `purchase_items.unit_price`, `purchase_items.subtotal`, `debts_receivables.principal_amount`, `debts_receivables.remaining_balance`, `debt_receivable_payments.amount`, `expense_categories.budget_limit`) use `numeric(14,0)`.
   - Check constraints enforce positive monetary values (`> 0`) on creation and non-negative values (`>= 0`) on balances and totals.

3. **Soft Delete and Master Data Lifecycle (PRD §8 & Task Criterion 4):**
   - Master data tables (`income_sources`, `income_categories`, `expense_categories`, `items`) and transaction entities (`incomes`, `expenses`, `debts_receivables`) define `deleted_at: timestamp with time zone`.
   - Partial unique indexes with predicate `WHERE deleted_at IS NULL` prevent intra-tenant active name collisions while allowing reuse of previously soft-deleted names.

4. **Deterministic Seeding & Migration Safety (Task Criterion 5):**
   - `migrate.ts` connects with `max: 1` connection pooling, preventing DDL race conditions and ensuring deterministic execution.
   - `seed.ts` uses fixed RFC 4122 UUIDs (`SEED_IDS`) with `.onConflictDoUpdate()` / `.onConflictDoNothing()`. Repeated executions complete with exit code 0 and maintain identical row counts.

---

## 3. Adversarial Review & Stress Test Results

### 3.1 Integrity Violation Assessment
- **Hardcoded test outputs in source code**: None detected. Unit tests inspect real Drizzle table configurations, client constructors, and helper outputs.
- **Dummy or facade implementations**: None detected. Database client connects to real PostgreSQL pool; migrator executes real DDL migrations; seeder executes real upsert queries.
- **Shortcuts bypassing the task**: None detected. All 18 tables, 8 enums, 13 check constraints, 45 foreign keys, and 33 indexes are fully implemented.
- **Fabricated verification outputs**: None detected. All row counts, migration durations, and test results reported by the worker were independently reproduced and verified against the running container.
- **Self-certifying work without genuine verification**: None detected. Tested independently via direct `psql` queries and negative adversarial stress test assertions.

### 3.2 Adversarial Scenarios Tested

| Scenario | Input / Action | Expected Behavior | Observed Behavior | Status |
|---|---|---|---|---|
| **Negative Nominal** | Insert `incomes.nominal = -500` | Rejection by PostgreSQL check constraint | `ERROR: new row violates check constraint "chk_incomes_nominal_positive"` | **PASS** |
| **Negative Stock** | Insert `items.quantity_on_hand = -1` | Rejection by check constraint | `ERROR: new row violates check constraint "chk_items_quantity_on_hand_non_negative"` | **PASS** |
| **Zero Delta Movement** | Insert `stock_movements.quantity_delta = 0` | Rejection by check constraint | `ERROR: new row violates check constraint "chk_stock_movements_delta_non_zero"` | **PASS** |
| **Duplicate Active Item Name (Same Tenant)** | Insert `Beras 5kg` into Household Cemara twice | Rejection by unique constraint | `ERROR: duplicate key value violates unique constraint "items_household_name_idx"` | **PASS** |
| **Duplicate Item Name (Cross Tenant)** | Insert `Beras 5kg` into Household Anwar | Allowed (tenant isolation) | `INSERT 0 1` succeeded without error | **PASS** |
| **Soft-Delete Name Re-use** | Insert soft-deleted `Beras Ketan`, then active `Beras Ketan` | Allowed by partial index `WHERE deleted_at IS NULL` | Both rows inserted without collision | **PASS** |
| **Tenant Cascade Deletion** | Delete Household | Clean cascade delete of all member and business records | `DELETE 1`, related items and members reduced to 0 | **PASS** |
| **Seeder Idempotency** | Execute `pnpm --filter db db:seed` back-to-back | No duplicate key exceptions, identical row counts | `seed.ts` completed successfully twice, zero errors | **PASS** |

---

## 4. Caveats & Recommendations for Downstream Milestones

1. **Child Entity Tenancy in API Queries (M3):**
   `purchase_items` and `debt_receivable_payments` do not store redundant `household_id` columns, cascading instead to `purchases(id)` and `debts_receivables(id)`. When developing M3 NestJS endpoints, queries for line items or payment records must join on their respective parent table to enforce household tenant boundaries.
2. **Transactional Outbox Polling Query (M5):**
   `notification_events` has index `outboxPollingIdx` on `(status, next_retry_at, created_at)`. Because newly created events have `next_retry_at = NULL`, the worker polling query in M5 should use `status = 'PENDING' AND (next_retry_at IS NULL OR next_retry_at <= now()) ORDER BY created_at ASC` with `FOR UPDATE SKIP LOCKED`.

---

## 5. Conclusion & Verdict

The database schema, migrations, seeder, and infrastructure implementation in `packages/db/` meet 100% of the requirements set forth in the Original User Request, PRD §8-§9, and Milestone 2 specification.

- All 18 tables and 8 enums are correctly declared and aligned with `@rumahkita/contracts`.
- Multi-tenancy, monetary precision (`numeric(14,0)`), soft-delete partial indexing, and relational integrity constraints are fully enforced at the PostgreSQL engine level.
- Migrations and idempotent seeds run cleanly with deterministic results.
- Unit tests, builds, typechecks, and linter pass with zero errors.
- No integrity violations found.

**Verdict: APPROVE**

---

## 6. Verification Method

To independently reproduce this verification:
```bash
# 1. Run unit test suite
pnpm --filter db test

# 2. Verify migration file synchronization with Drizzle schemas
pnpm --filter db db:generate

# 3. Verify programmatic migration runner
pnpm --filter db db:migrate

# 4. Verify idempotent database seeder
pnpm --filter db db:seed
pnpm --filter db db:seed

# 5. Verify monorepo pipeline integrity
pnpm build --force
pnpm typecheck --force
pnpm lint --force
pnpm test --force
```
