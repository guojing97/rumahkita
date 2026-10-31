# Milestone 2: Database Schema with Drizzle ORM — Challenger Handoff Report

**Challenger:** Challenger 1 (`challenger_m2_1`)  
**Domain:** Adversarial Testing of Database Schema, Check Constraints, Migrations, Partial Unique Indexes, and Seeder Idempotency  
**Target Codebase:** `packages/db/`  
**Verdict:** **`APPROVE`**  
**Date:** 2026-10-27  

---

## 1. Observation

All tests were executed directly against the live PostgreSQL 16 container (`postgresql://rumahkita:rumahkita_dev_password@localhost:5432/rumahkita` / Docker container `rumahkita-postgres` running `postgres:16-alpine`).

### 1.1 Seeder Idempotency Verification
The seeder command was executed twice consecutively, measuring row counts in all 13 seeded tables before run 1, after run 1, and after run 2:

```text
Table Name                 | Pre-Run Count | Post-Run 1 Count | Post-Run 2 Count | Status
---------------------------+---------------+------------------+------------------+----------
households                 |             2 |                2 |                2 | IDENTICAL
users                      |             3 |                3 |                3 | IDENTICAL
household_members          |             3 |                3 |                3 | IDENTICAL
notification_preferences   |             3 |                3 |                3 | IDENTICAL
income_sources             |             4 |                4 |                4 | IDENTICAL
income_categories          |             3 |                3 |                3 | IDENTICAL
expense_categories         |             8 |                8 |                8 | IDENTICAL
items                      |             5 |                5 |                5 | IDENTICAL
stock_movements            |             4 |                4 |                4 | IDENTICAL
debts_receivables          |             4 |                4 |                4 | IDENTICAL
debt_receivable_payments   |             2 |                2 |                2 | IDENTICAL
incomes                    |             3 |                3 |                3 | IDENTICAL
expenses                   |             5 |                5 |                5 | IDENTICAL
```

Both consecutive runs exited with code 0:
```text
$ pnpm --filter db db:seed
🌱 [RumahKita Seeder] Starting database seeding...
🔌 Connection target: postgresql://rumahkita:****@localhost:5432/rumahkita
  -> Seeding households...
  -> Seeding users with Argon2id password hash...
  -> Linking household members...
  -> Setting notification preferences...
  -> Seeding default income sources...
  -> Seeding income categories...
  -> Seeding expense categories with budgets...
  -> Seeding inventory items (Aman, Menipis, Habis)...
  -> Logging initial stock movements...
  -> Seeding debts, receivables, and repayment records...
  -> Seeding incomes for dashboard cash flow presentation...
  -> Seeding expenses for monthly reports and categories...
✅ [RumahKita Seeder] Database seeded successfully!
```
Result: Exactly 0 row duplication, 0 uniqueness errors, and 0 foreign key errors across consecutive runs.

### 1.2 Check Constraint Invariants (Adversarial Data Injections)
Ten adversarial data injection attacks were launched against the live database attempting to breach domain invariants:

1. **Income nominal = 0:**
   - Command: `INSERT INTO incomes (..., nominal) VALUES (..., 0)`
   - Error observed: `new row for relation "incomes" violates check constraint "chk_incomes_nominal_positive"`
   - Result: **REJECTED (PASS)**

2. **Income nominal = -50000:**
   - Command: `INSERT INTO incomes (..., nominal) VALUES (..., -50000)`
   - Error observed: `new row for relation "incomes" violates check constraint "chk_incomes_nominal_positive"`
   - Result: **REJECTED (PASS)**

3. **Item quantity_on_hand = -1:**
   - Command: `INSERT INTO items (..., quantity_on_hand) VALUES (..., -1)`
   - Error observed: `new row for relation "items" violates check constraint "chk_items_quantity_on_hand_non_negative"`
   - Result: **REJECTED (PASS)**

4. **Item low_stock_threshold = -5:**
   - Command: `INSERT INTO items (..., low_stock_threshold) VALUES (..., -5)`
   - Error observed: `new row for relation "items" violates check constraint "chk_items_low_stock_threshold_non_negative"`
   - Result: **REJECTED (PASS)**

5. **Debt remaining_balance = -1:**
   - Command: `INSERT INTO debts_receivables (..., remaining_balance) VALUES (..., -1)`
   - Error observed: `new row for relation "debts_receivables" violates check constraint "chk_debts_balance_non_negative"`
   - Result: **REJECTED (PASS)**

6. **Debt principal_amount = 0:**
   - Command: `INSERT INTO debts_receivables (..., principal_amount) VALUES (..., 0)`
   - Error observed: `new row for relation "debts_receivables" violates check constraint "chk_debts_principal_positive"`
   - Result: **REJECTED (PASS)**

7. **Stock movement quantity_delta = 0:**
   - Command: `INSERT INTO stock_movements (..., quantity_delta) VALUES (..., 0)`
   - Error observed: `new row for relation "stock_movements" violates check constraint "chk_stock_movements_delta_non_zero"`
   - Result: **REJECTED (PASS)**

8. **Stock movement resulting_quantity = -1:**
   - Command: `INSERT INTO stock_movements (..., resulting_quantity) VALUES (..., -1)`
   - Error observed: `new row for relation "stock_movements" violates check constraint "chk_stock_movements_resulting_non_negative"`
   - Result: **REJECTED (PASS)**

9. **Expense nominal = 0:**
   - Command: `INSERT INTO expenses (..., nominal) VALUES (..., 0)`
   - Error observed: `new row for relation "expenses" violates check constraint "chk_expenses_nominal_positive"`
   - Result: **REJECTED (PASS)**

10. **Debt payment amount = 0:**
    - Command: `INSERT INTO debt_receivable_payments (..., amount) VALUES (..., 0)`
    - Error observed: `new row for relation "debt_receivable_payments" violates check constraint "chk_debt_payments_amount_positive"`
    - Result: **REJECTED (PASS)**

### 1.3 Soft Delete Partial Unique Indexes & Multi-Tenancy
Tested on table `items` (`items_household_name_idx` with `WHERE deleted_at IS NULL`):
1. Inserted Item A (`name: 'Adversarial Test Susu UHT 1L'`, `household_id: H1`): Succeeded (ID: `995d25a8-867d-4429-a930-26a2ca02a254`).
2. Attempted to insert duplicate Item B with identical name in Household 1: Correctly rejected with `duplicate key value violates unique constraint "items_household_name_idx"`.
3. Tenant isolation test: Inserted item with identical name in Household 2 (`household_id: H2`): Succeeded (ID: `3f9f5b12-4d3b-495b-a2c2-22b600ccca15`), proving tenant scoping.
4. Soft deleted Item A via `UPDATE items SET deleted_at = NOW() WHERE id = item_A_id`: `deleted_at` populated to `2026-10-27T14:23:07.703Z`.
5. Inserted new active Item C with identical name in Household 1: Succeeded (ID: `50887a89-4dce-4c95-ac97-ab279d234ff7`), confirming soft deletion unblocks the partial index.
6. Soft deleted Item C: Both soft deleted rows coexisted in Household 1 without index conflict.
7. Cleaned up test items cleanly.
8. Repeated and verified identical behavior on `expense_categories` (`expense_categories_household_name_idx`).

### 1.4 Additional Invariants & Security
1. **Foreign Key Integrity:** Inserting into `incomes` with non-existent `household_id` failed with `incomes_household_id_households_id_fk`. Inserting into `items` with non-existent `created_by` failed with `items_created_by_users_id_fk`.
2. **Numeric Field Overflow:** Inserting 15-digit nominal (`100,000,000,000,000`) into `numeric(14,0)` failed with `numeric field overflow`.
3. **Purchase Idempotency Key:** Inserting duplicate `idempotency_key` in `purchases` failed with `purchases_idempotency_key_idx`.
4. **Tenant Membership Uniqueness:** Inserting duplicate `(household_id, user_id)` in `household_members` failed with `household_members_household_user_idx`.
5. **Notification Preference Uniqueness:** Inserting duplicate `(household_id, user_id)` in `notification_preferences` failed with `notification_preferences_household_user_idx`.
6. **Argon2id Authentication:** Verified hash for `budi@rumahkita.local` via `@node-rs/argon2`: returns `true` for `Password123!` and `false` for invalid passwords.

### 1.5 Monorepo Quality Checks
- `pnpm --filter db test`: 17 passed, 0 failed (260ms)
- `pnpm --filter contracts test`: 21 passed, 0 failed (242ms)
- `pnpm typecheck`: 9 tasks successful, 0 errors

---

## 2. Logic Chain

1. **Invariants Enforced by Database Engine:**
   Observations §1.2 and §1.4 confirm that business constraints are not solely dependent on application validation layer (NestJS / Zod), but are guaranteed as low-level PostgreSQL invariants (`chk_incomes_nominal_positive`, `chk_items_quantity_on_hand_non_negative`, `chk_debts_balance_non_negative`, `chk_stock_movements_delta_non_zero`, `items_created_by_users_id_fk`, etc.). Any direct SQL bypass or out-of-order race condition will be stopped by the RDBMS.

2. **Safe Soft Delete Lifecycle:**
   Observation §1.3 confirms the partial unique index pattern (`UNIQUE (household_id, name) WHERE deleted_at IS NULL`). This solves the classic RDBMS soft-delete anti-pattern: users can delete an item named "Beras 5kg", create a new "Beras 5kg", and restore or archive records without primary key or unique key collisions. Furthermore, cross-tenant isolation ensures Household 1 and Household 2 operate in mutually isolated namespaces.

3. **Deterministic Seeding Architecture:**
   Observation §1.1 confirms that `packages/db/src/seed.ts` is fully idempotent. By employing deterministic UUID constants (`SEED_IDS`) and UPSERT clauses (`.onConflictDoUpdate()` / `.onConflictDoNothing()`), development and CI environments can run migrations and seed scripts repeatedly without state explosion or manual truncations.

4. **Security & Data Types:**
   Observation §1.4 verifies that passwords stored in the database are Argon2id hashes, monetary fields strictly use integer Rupiah `numeric(14,0)` to avoid floating-point math issues, and idempotency keys guarantee purchase operation atomicity.

---

## 3. Caveats

- **Connection String in Dispatch:** The dispatch prompt contained a placeholder password (`rumahkita_secret_2026`), whereas the canonical local Docker dev environment configured in `.env` and `docker-compose.yml` uses `rumahkita_dev_password`. All tests were run against the live PostgreSQL container using the canonical project credentials.
- **Worker Daemon Polling:** While the transactional outbox schema (`notification_events`) and index (`notification_events_outbox_polling_idx`) are verified at the database level, end-to-end background polling and exponential backoff belong to Milestone 5.

---

## 4. Conclusion

**Verdict: `APPROVE`**

Milestone 2 (`packages/db/`) fulfills all specification requirements from `ORIGINAL_REQUEST.md` (§R2) and `PROJECT.md` (Features 7, 8, 9, 10). The database schema, migrations, constraints, partial unique indexes, and seeders are structurally robust, secure, and empirically proven under adversarial testing. Milestone 3 (Backend API) is unblocked to proceed.

---

## 5. Verification Method

To independently reproduce all challenger findings:

1. **Verify Unit Tests:**
   ```bash
   pnpm --filter db test
   ```
   *Expected:* 17 tests pass.

2. **Verify Seeder Idempotency:**
   ```bash
   pnpm --filter db db:seed
   pnpm --filter db db:seed
   ```
   *Expected:* Both runs complete with zero errors and no table row count changes.

3. **Verify Constraints Against Live PostgreSQL:**
   ```bash
   pnpm --filter db exec tsx -r dotenv/config -e "
   import postgres from 'postgres';
   const sql = postgres(process.env.DATABASE_URL!);
   await sql\`INSERT INTO incomes (household_id, source_id, date, nominal, created_by) VALUES ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101', '2026-10-27', 0, '00000000-0000-4000-a000-000000000011')\`;
   "
   ```
   *Expected:* Rejection with `violates check constraint "chk_incomes_nominal_positive"`.

4. **Verify Monorepo Integrity:**
   ```bash
   pnpm typecheck
   pnpm test
   ```
   *Expected:* All packages pass.
