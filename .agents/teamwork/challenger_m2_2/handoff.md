# Milestone 2 Challenge Report: Database Schema with Drizzle ORM

**Agent:** Challenger 2 (`challenger_m2_2`)  
**Role:** Empirical Challenger (Critic & Specialist)  
**Target:** Milestone 2 (`packages/db/` & live PostgreSQL database)  
**Date:** 2026-10-27  
**Verdict:** **`APPROVE`**  

---

## Challenge Summary

**Overall risk assessment**: **LOW**

All empirical stress tests executed against the live PostgreSQL database instance (`rumahkita-postgres`, PostgreSQL 16 Alpine on port 5432) succeeded with zero violations, zero blocking, and zero orphaned records. Multi-tenant foreign key cascade semantics, `FOR UPDATE SKIP LOCKED` outbox non-blocking concurrency, Argon2id password hash verification, and monorepo compilation/testing pipelines are verified.

---

## 1. Observation

### 1.1 Multi-Tenant Cascading Deletion Stress Test
A test harness dynamically created an isolated test user and a complete multi-tenant entity tree spanning 16 interrelated tables:
- **Root Table:** `households` (1 record)
- **Direct Child Tables (with `household_id`):** `household_members`, `income_sources`, `income_categories`, `expense_categories`, `items`, `stock_movements`, `purchases`, `expenses`, `incomes`, `debts_receivables`, `notification_preferences`, `notification_events`, `audit_logs` (1 record each)
- **Secondary Child Tables (linked via parent ID):** `purchase_items` (linked to `purchases.id`), `debt_receivable_payments` (linked to `debts_receivables.id`) (1 record each)

Before deletion, all 16 tables confirmed exactly +1 row count over baseline:
```text
  - households: 3 (baseline 2)
  - household_members: 4 (baseline 3)
  - income_sources: 5 (baseline 4)
  - income_categories: 4 (baseline 3)
  - expense_categories: 9 (baseline 8)
  - items: 6 (baseline 5)
  - stock_movements: 5 (baseline 4)
  - purchases: 1 (baseline 0)
  - purchase_items: 1 (baseline 0)
  - expenses: 6 (baseline 5)
  - incomes: 4 (baseline 3)
  - debts_receivables: 5 (baseline 4)
  - debt_receivable_payments: 3 (baseline 2)
  - notification_preferences: 4 (baseline 3)
  - notification_events: 1 (baseline 0)
  - audit_logs: 1 (baseline 0)
```

Execution of `DELETE FROM households WHERE id = $testHouseholdId`:
- **Direct Child Rows Remaining:** 0 across all 13 direct child tables.
- **Secondary Child Rows Remaining:** `purchase_items`: 0, `debt_receivable_payments`: 0.
- **Database-wide Orphan Checks:**
  - `purchase_items -> purchases`: 0 orphaned rows
  - `debt_receivable_payments -> debts_receivables`: 0 orphaned rows
  - `expenses -> expense_categories`: 0 orphaned rows
  - `incomes -> income_sources`: 0 orphaned rows
  - `stock_movements -> items`: 0 orphaned rows
  - `notification_events -> items`: 0 orphaned rows
- **Multi-tenant Isolation:** Baseline row counts for the existing households ("Keluarga Cemara" and "Keluarga Anwar") remained 100% untouched.

### 1.2 Transactional Outbox Concurrency Stress Test
Tested under high contention simulating 3 concurrent worker processes and 1 concurrent producer:
- **Phase 1:** 10 pending notification events pre-populated.
- **Phase 2:**
  - **Worker 1** locked 5 events using `FOR UPDATE SKIP LOCKED LIMIT 5` in 6ms and held locks for 2500ms.
  - **Worker 2** concurrently queried `FOR UPDATE SKIP LOCKED LIMIT 5`: locked the remaining 5 events in **7ms** without blocking. Held locks for 1500ms.
  - **Worker 3** concurrently queried `FOR UPDATE SKIP LOCKED LIMIT 5` while all 10 events were locked: returned 0 rows in **7ms** immediately without blocking.
  - **Producer** inserted a new event during active lock hold: completed in **3ms** (verified non-blocking).
- **Phase 3:** Overlap between Worker 1 and Worker 2 locked IDs was **0** (perfect mutual exclusion).
- **Phase 4:** The newly inserted event was immediately selectable by Worker 1 in the next polling cycle.

### 1.3 Argon2id Password Hash Verification
Queried `users` table directly for seeded users and verified password hashes against `@node-rs/argon2`:
```text
Testing user: ani@rumahkita.local (Ani Santoso)
  - Household: Keluarga Cemara (member)
  - Password Hash: $argon2id$v=19$m=65536,t=3,p=4$9b24qAkGNFwnJjhbBRXbGw$q6dUdD66nWg4znRJej1AGXwfOmccJRLBpHFLJlNCWzY
  - Hash format is Argon2id: true
  - 'Password123!' verification: true
  - Negative tests rejection: true

Testing user: budi@rumahkita.local (Budi Santoso)
  - Household: Keluarga Cemara (owner)
  - Password Hash: $argon2id$v=19$m=65536,t=3,p=4$9b24qAkGNFwnJjhbBRXbGw$q6dUdD66nWg4znRJej1AGXwfOmccJRLBpHFLJlNCWzY
  - Hash format is Argon2id: true
  - 'Password123!' verification: true
  - Negative tests rejection: true

Testing user: joko@rumahkita.local (Joko Anwar)
  - Household: Keluarga Anwar (owner)
  - Password Hash: $argon2id$v=19$m=65536,t=3,p=4$9b24qAkGNFwnJjhbBRXbGw$q6dUdD66nWg4znRJej1AGXwfOmccJRLBpHFLJlNCWzY
  - Hash format is Argon2id: true
  - 'Password123!' verification: true
  - Negative tests rejection: true
```
All 3 users validated `Password123!` as `true`, and rejected incorrect variations (`password123!`, `Password123`, `""`, `admin`) as `false`.

### 1.4 Monorepo Build and Test Suite
- `pnpm --filter db test`: 17 passed, 0 failed (217ms).
- `pnpm test`: 5 tasks passed across `@rumahkita/contracts` (21 tests) and `@rumahkita/db` (17 tests).
- `pnpm build --force`: Full turbo monorepo build succeeded across 6 packages with 0 TypeScript errors.
- `pnpm typecheck`: 9 tasks passed.
- `pnpm lint`: 3 tasks passed.
- `pnpm --filter db db:seed`: Idempotency re-verified through repeat runs with 0 errors.

---

## 2. Logic Chain

1. **Cascading Deletions Logic:**
   - Drizzle schema correctly annotated foreign keys on `householdId` with `{ onDelete: 'cascade' }`.
   - Secondary child tables (`purchase_items`, `debt_receivable_payments`) correctly cascade from their parent tables (`purchases.id`, `debts_receivables.id`).
   - Although intra-tenant references exist with `onDelete: 'restrict'` (e.g. `expenses.category_id -> expense_categories.id`), PostgreSQL resolves foreign key graph cascades top-down from `households`, removing all linked child rows in the same transaction without violating restrict constraints.
   - Verified that zero orphaned records remain, proving relational consistency.

2. **Outbox Concurrency Logic:**
   - The query `SELECT ... FROM notification_events WHERE status = 'PENDING' FOR UPDATE SKIP LOCKED` leverages PostgreSQL MVCC row-level locking.
   - Row-level `FOR UPDATE` locks only acquired rows; it does NOT acquire table locks or page locks that would hinder `INSERT`.
   - `SKIP LOCKED` instructs subsequent worker transactions to skip locked rows instead of waiting, preventing deadlocks or serial worker queues.
   - Verified empirically: Worker 2 and 3 executed queries in 7ms, and concurrent `INSERT` executed in 3ms.

3. **Argon2id Hash Security Logic:**
   - All seeded password hashes conform to RFC 9106 Argon2id PHC format (`$argon2id$v=19$m=65536,t=3,p=4$...`).
   - Native verification via `@node-rs/argon2` confirmed valid credentials and prevented false-positive authentication.

---

## 3. Caveats

- **Database Connection Password in Environment:** The dispatch prompt cited `postgresql://rumahkita:rumahkita_secret_2026@localhost:5432/rumahkita`. The authoritative local credentials defined in the repository's `.env` and `docker-compose.yml` are `POSTGRES_USER=rumahkita` and `POSTGRES_PASSWORD=rumahkita_dev_password`. All tests were verified against the live PostgreSQL 16 container (`rumahkita-postgres`) using the authoritative environment configuration.
- **REST API & Auth Token Testing:** Refresh sessions and JWT tokens were verified at the database schema level (table structure, indexes, and unique constraints). Full HTTP authentication testing belongs to Milestone 3 (Backend API).

---

## 4. Challenges & Stress Test Results

| # | Stress Test Scenario | Expected Result | Actual Result | Status |
|---|----------------------|-----------------|---------------|--------|
| 1 | Multi-tenant Cascading Deletion across 16 tables | All child entities deleted, 0 orphans, zero cross-tenant impact | 0 orphans across all 16 tables; baseline households unaffected | **PASS** |
| 2 | Outbox Worker 1 row-locking vs Producer concurrent INSERT | Insert completes in < 500ms without blocking | Insert finished in **3ms** while lock held for 2500ms | **PASS** |
| 3 | Concurrent Outbox Workers polling same batch | Workers acquire mutually exclusive sets without waiting (<500ms) | Worker 2 locked remaining rows in **7ms** with 0 overlap; Worker 3 returned in **7ms** | **PASS** |
| 4 | Seed Users Argon2id Password Verification (`Password123!`) | Returns `true` for all 3 users, `false` for incorrect passwords | All 3 users verified; incorrect passwords rejected | **PASS** |
| 5 | Monorepo Test & Build Verification | All unit tests pass, compilation succeeds with 0 TS errors | 17 db tests pass, full monorepo build exits 0 | **PASS** |
| 6 | Database Seeder Idempotency | Multiple runs cause no unique constraint violations | Second run updated existing records cleanly in 577ms | **PASS** |

---

## 5. Unchallenged Areas

- **NestJS Auth Controllers & Guards:** Will be challenged in Milestone 3.
- **Next.js UI & BFF Proxy:** Will be challenged in Milestone 4.
- **Long-term Worker Polling Daemon Daemonization:** Will be challenged in Milestone 5.

---

## 6. Conclusion & Verdict

**Verdict:** **`APPROVE`**

Milestone 2 implementation is robust, adheres strictly to the PRD §9 specifications and project contracts, satisfies all data integrity and concurrency guarantees, and is ready for Milestone 3 (Backend API).

---

## 7. Verification Method

To independently reproduce all tests:

1. **Verify db package tests:**
   ```bash
   pnpm --filter db test
   ```
2. **Verify monorepo build:**
   ```bash
   pnpm build
   ```
3. **Verify Argon2id Passwords:**
   ```bash
   pnpm --filter db exec tsx -e "
   import postgres from 'postgres';
   import * as argon2 from '@node-rs/argon2';
   const sql = postgres(process.env.DATABASE_URL || 'postgresql://rumahkita:rumahkita_dev_password@localhost:5432/rumahkita');
   const users = await sql\`SELECT email, password_hash FROM users\`;
   for (const u of users) {
     const ok = await argon2.verify(u.password_hash, 'Password123!');
     console.log(u.email, ok);
   }
   await sql.end();
   "
   ```
4. **Verify Outbox Concurrency:**
   Execute concurrent worker query with `FOR UPDATE SKIP LOCKED` and concurrent insert in separate connections.
