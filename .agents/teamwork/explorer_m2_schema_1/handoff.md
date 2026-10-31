# Handoff Report — Explorer 1 (Database Schema Domain)

**Milestone:** Milestone 2: Database Schema with Drizzle ORM  
**Date:** 2026-10-27  
**Working Directory:** `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m2_schema_1`  
**Target Specification:** `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m2_schema_1/schema_spec.md`  

---

## 1. Observation

1. **Monorepo & Package Architecture:**
   - In `/Users/mac/Projects/03-Labs/RumahKita/packages/db/package.json` (lines 15-25): Drizzle dependencies are `"drizzle-orm": "^0.35.3"` and `"drizzle-kit": "^0.26.2"` with `"postgres": "^3.4.4"`.
   - In `/Users/mac/Projects/03-Labs/RumahKita/packages/db/src/index.ts` (lines 1-31): Current implementation provides only a basic `createDatabaseClient` factory with default connection string `'postgresql://rumahkita:rumahkita_dev_password@localhost:5432/rumahkita'`. No schema files exist yet under `packages/db/src/schema/`.
2. **Authoritative Entity Requirements:**
   - In `/Users/mac/Projects/03-Labs/RumahKita/Doc/prd.md` (§9, lines 332-353): 18 core database entities are enumerated: `users`, `households`, `household_members`, `refresh_sessions` (or `refresh_tokens`), `income_sources`, `income_categories`, `expense_categories`, `incomes`, `expenses`, `items`, `stock_movements`, `purchases`, `purchase_items`, `debts_receivables`, `debt_receivable_payments`, `notification_preferences`, `notification_events`, `audit_logs`.
   - In `/Users/mac/Projects/03-Labs/RumahKita/Doc/prd.md` (§8, lines 314-328): Primary keys must be UUID, monetary values must use `NUMERIC(14,0)` (integer Rupiah), transaction dates must use `DATE`, audit timestamps must use `TIMESTAMPTZ`, audit columns `created_at`, `updated_at`, `created_by`, `updated_by` must exist on important records, and soft delete must be applied to referenced master data.
   - In `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/ORIGINAL_REQUEST.md` (§R2, lines 22-24): Confirms all 18 tables, UUID PKs with `defaultRandom()`, `numeric(14,0)` currency, audit columns, soft delete via `deleted_at`, `pgEnum` for enums, `drizzle-kit generate`/`migrate`, and seed script with 1 household, 2 users, default categories, and sample items.
3. **Existing Contracts & E2E Test Suite Alignment:**
   - In `packages/contracts/src/common/enums.ts`: `householdRoleEnum` is `['owner', 'member']`, and `paymentMethodEnum` is `['cash', 'transfer', 'ewallet', 'other']`.
   - In `packages/contracts/src/inventory/item.schema.ts` & `stock-movement.schema.ts`: `stockMovementReasonEnum` is `['purchase', 'manual_correction', 'waste', 'initial', 'reversal']`. Item threshold status values are `SAFE`, `LOW`, `OUT`.
   - In `packages/contracts/src/purchases/purchase.schema.ts`: `purchaseStatusEnum` is `['draft', 'completed', 'cancelled']`.
   - In `packages/contracts/src/debts/debt.schema.ts`: `debtTypeEnum` is `['payable', 'receivable']`, and `debtStatusEnum` is `['open', 'partially_paid', 'settled', 'overdue', 'cancelled']`.
   - In `packages/contracts/src/notifications/notification.schema.ts` (lines 3-7): `notificationChannelEnum` is `['EMAIL', 'WHATSAPP']`, and `notificationStatusEnum` is `['PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED']`.
   - In `tests/e2e/config.ts` (lines 14-30): Seeded test accounts include `budi@rumahkita.local` (Owner), `ani@rumahkita.local` (Member), and `joko@rumahkita.local` (Other household).
   - In `tests/e2e/tier3-cross-feature/purchase-inventory-expense-atomicity.test.ts` (lines 46-55): Purchase completion endpoint returns `status: 'completed'` and `expenseId` referencing the created expense with matching nominal, category, and `purchaseId`.

---

## 2. Logic Chain

1. **Partitioning Schema across 8 Domain Modules:**
   - Grouping 18 tables into 8 domain files in `packages/db/src/schema/` (`auth.ts`, `household.ts`, `finance.ts`, `inventory.ts`, `purchase.ts`, `debt.ts`, `notification.ts`, `audit.ts`) matches the domain boundaries and prevents monolithic file corruption.
2. **Preventing Circular Imports between Finance and Purchase:**
   - In `finance.ts`, `expenses.purchase_id` references `purchases.id`. In `purchase.ts`, `purchases.expense_category_id` references `expense_categories.id`.
   - In Drizzle ORM, using lazy callback evaluation `references((): AnyPgColumn => purchases.id, ...)` and isolating Drizzle `relations` into a dedicated `relations.ts` prevents runtime circular dependency errors during module evaluation.
3. **Guaranteeing Multi-Tenant Isolation at Schema Level:**
   - All 12 business tables include a non-nullable `household_id uuid REFERENCES households(id) ON DELETE CASCADE`.
   - Explicit B-Tree indexes on `household_id` ensure index-supported multi-tenant filtering across all queries.
4. **Preventing Duplicates while Supporting Archival:**
   - Master data tables (`income_sources`, `income_categories`, `expense_categories`, `items`) enforce partial unique indexes `UNIQUE (household_id, name) WHERE deleted_at IS NULL`. This allows previously soft-deleted names to be reused while strictly preventing active duplicates.
5. **Database-Level Invariant Enforcement:**
   - Check constraints (`chk_incomes_nominal_positive`, `chk_expenses_nominal_positive`, `chk_items_quantity_on_hand_non_negative`, `chk_stock_movements_delta_non_zero`, `chk_debts_principal_positive`, `chk_debts_balance_non_negative`) enforce business integrity directly in PostgreSQL, preventing corrupt state even if application validations are bypassed.

---

## 3. Caveats

1. **Drizzle ORM Package Scripts & tsx:**
   - The current `packages/db/package.json` contains only `"build"`, `"typecheck"`, and `"clean"`. The scripts `"db:generate"`, `"db:migrate"`, `"db:push"`, `"db:studio"`, and `"db:seed"` need to be added to `package.json` during the implementation phase.
2. **Argon2id Hash Precomputation:**
   - The seeder requires hashing `'Password123!'` with Argon2id. The builder can either use an `argon2` npm package call or embed a valid precomputed Argon2id hash string to minimize unnecessary seed dependencies.

---

## 4. Conclusion

The database schema specification for Milestone 2 has been thoroughly formulated and documented in `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m2_schema_1/schema_spec.md`. It covers:
- Complete TypeScript Drizzle code for all 18 tables across 8 domain files.
- Common shared column definitions (`auditColumns`, `softDeleteColumn`, `idrNumeric`).
- Master relations mapping (`relations.ts`) resolving all foreign key relationships without circular dependencies.
- Global PostgreSQL enums matching existing Zod contract enums.
- Comprehensive indexes, partial unique indexes, check constraints, and cascade delete semantics.
- Blueprints for `drizzle.config.ts`, `packages/db/src/index.ts`, and `packages/db/src/seed.ts`.

---

## 5. Verification Method

1. **Specification Document Inspection:**
   - View `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m2_schema_1/schema_spec.md` to verify all 18 tables, column names, data types, indexes, and relations.
2. **Downstream Implementation Verification:**
   - Once builder files are generated in `packages/db/src/schema/`:
     ```bash
     pnpm --filter db typecheck
     pnpm --filter db db:generate
     pnpm --filter db db:migrate
     pnpm --filter db db:seed
     ```
   - Invalidation condition: Any TypeScript compile error in `packages/db`, any Drizzle Kit syntax error, or foreign key constraint violation during seed execution.
