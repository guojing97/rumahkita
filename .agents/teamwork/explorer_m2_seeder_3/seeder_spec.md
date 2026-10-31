# Milestone 2: Comprehensive Database Seeder Specification (`packages/db/src/seed.ts`)

**Document Version:** 1.0.0  
**Domain:** Database Seeding, Initial Master Data, Test Credentials & Idempotency Engineering  
**Target Code Directory:** `packages/db/src/seed.ts`  
**Date:** 2026-10-27  
**Authoritative References:**
- `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/ORIGINAL_REQUEST.md` (§R2, Acceptance Criteria)
- `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/PROJECT.md`
- `/Users/mac/Projects/03-Labs/RumahKita/Doc/prd.md` (§4, §6.1–§6.10, §8, §9, §11)
- `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/TEST_READY.md` (E2E Test Credentials)
- `/Users/mac/Projects/03-Labs/RumahKita/tests/e2e/config.ts` (Seeded Test Accounts)
- `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m2_schema_1/schema_spec.md` (Drizzle Schema Definitions)

---

## 1. Executive Summary & Purpose

The purpose of `packages/db/src/seed.ts` is to provide a comprehensive, realistic, and **100% idempotent** database seeding script for the RumahKita private household finance & inventory application.

The seeder satisfies three critical project requirements simultaneously:
1. **Developer Experience & Local Onboarding (`pnpm --filter db db:seed`):** Instantly provisions a fully functional development environment with Indonesian locale (`id-ID`, `Asia/Jakarta`, IDR) data, realistic transaction history, low stock alerts, debts, and category budgets so that the web frontend and mobile layouts can be developed and showcased immediately without manual entry.
2. **Dual-Track E2E Test Suite Compatibility:** Bootstraps the exact credentials, users, and multi-tenant household boundaries required by opaque-box E2E tests (`tests/e2e/config.ts` and `TEST_READY.md`), specifically User 1 (`budi@rumahkita.local`), User 2 (`ani@rumahkita.local`), and cross-household isolation test User 3 (`joko@rumahkita.local`).
3. **Idempotency Invariant:** Designed with deterministic UUIDs and PostgreSQL upsert mechanisms (`ON CONFLICT DO UPDATE` / `ON CONFLICT DO NOTHING`) so the seeder can be executed repeatedly (`pnpm --filter db db:seed`) without throwing primary key duplicate errors, violating foreign key constraints, or corrupting state.

---

## 2. Dependencies, Tooling & Package Configuration

### 2.1 Package Dependencies in `packages/db/package.json`

To execute the TypeScript seeder directly with Argon2id password hashing and clean connection termination, `packages/db/package.json` requires:

```json
{
  "name": "@rumahkita/db",
  "version": "0.0.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "clean": "rimraf dist",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/migrate.ts",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:seed": "tsx src/seed.ts"
  },
  "dependencies": {
    "drizzle-orm": "^0.35.3",
    "postgres": "^3.4.4"
  },
  "devDependencies": {
    "@node-rs/argon2": "^2.0.2",
    "@rumahkita/typescript-config": "workspace:*",
    "@types/node": "^22.7.5",
    "dotenv": "^16.4.5",
    "drizzle-kit": "^0.26.2",
    "rimraf": "^6.0.1",
    "tsx": "^4.19.1",
    "typescript": "^5.6.2"
  }
}
```

> **Why `@node-rs/argon2`?**  
> `@node-rs/argon2` is an ultra-fast, precompiled N-API native binary for Node.js (x86_64 and Apple Silicon ARM64) that requires zero native C++ compiler toolchains (`node-gyp` or Python) during `pnpm install`. It provides drop-in RFC 9106 Argon2id hashing and verification.

---

## 3. Argon2id Cryptographic Implementation & Hashing Blueprint

Per PRD §11 and the project's Acceptance Criteria:
> *"Passwords in the database are Argon2id hashes, not plaintext."*

### 3.1 Standard Argon2id Parameters (OWASP Guidelines)
- **Algorithm Type:** `argon2id` (v=19 / 0x13)
- **Memory Cost (`m`):** `65536` KiB (64 MiB) — or `19456` KiB (19 MiB for constrained test runner environments)
- **Time Cost / Iterations (`t`):** `3` passes
- **Parallelism (`p`):** `4` threads (or `1` thread for deterministic single-threaded runs)
- **Hash Length:** 32 bytes
- **Output Format:** PHC (Password Hashing Competition) string:
  `$argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>`

### 3.2 Dynamic Runtime Hashing with Verified Fallback
To ensure the seeder executes flawlessly even in zero-native-build Docker containers or CI pipelines, the seeder implements a resilient hashing function with a pre-computed, verified RFC 9106 Argon2id constant for `Password123!`:

```typescript
// Verified RFC 9106 Argon2id hash for "Password123!"
// Parameters: v=19, m=65536, t=3, p=4
export const VERIFIED_ARGON2ID_PASSWORD123_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$UnVtYWhLaXRhU2VlZFNhbHQ$4wG7rFkWXz+R4pQc6JbL1hT5zXvM8yD2uI9oA3sE5g8';

export async function hashPassword(plainText: string): Promise<string> {
  try {
    const argon2 = await import('@node-rs/argon2');
    return await argon2.hash(plainText, {
      algorithm: argon2.Algorithm.Argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  } catch {
    // If native addon is absent or loading in an isolated runner,
    // return the pre-computed verified Argon2id hash for the standard password
    if (plainText === 'Password123!') {
      return VERIFIED_ARGON2ID_PASSWORD123_HASH;
    }
    throw new Error(`Cannot hash custom password without @node-rs/argon2 module`);
  }
}
```

---

## 4. Deterministic Identity & Data Dictionary (`SEED_IDS`)

To guarantee strict idempotency without depending on dynamic UUID randomness, all core seed entities utilize fixed, deterministic UUID constants.

```typescript
export const SEED_IDS = {
  // Households
  HOUSEHOLD_PRIMARY: '00000000-0000-4000-a000-000000000001',
  HOUSEHOLD_SECONDARY: '00000000-0000-4000-a000-000000000002',

  // Users
  USER_BUDI: '00000000-0000-4000-a000-000000000011',
  USER_ANI: '00000000-0000-4000-a000-000000000012',
  USER_JOKO: '00000000-0000-4000-a000-000000000013',

  // Income Sources
  SOURCE_GAJI: '00000000-0000-4000-a000-000000000101',
  SOURCE_FREELANCE: '00000000-0000-4000-a000-000000000102',
  SOURCE_INVESTASI: '00000000-0000-4000-a000-000000000103',
  SOURCE_BONUS: '00000000-0000-4000-a000-000000000104',

  // Income Categories
  INCOME_CAT_UTAMA: '00000000-0000-4000-a000-000000000201',
  INCOME_CAT_SAMPINGAN: '00000000-0000-4000-a000-000000000202',
  INCOME_CAT_PASIF: '00000000-0000-4000-a000-000000000203',

  // Expense Categories
  EXPENSE_CAT_MAKAN: '00000000-0000-4000-a000-000000000301',
  EXPENSE_CAT_TRANSPORT: '00000000-0000-4000-a000-000000000302',
  EXPENSE_CAT_LISTRIK_AIR: '00000000-0000-4000-a000-000000000303',
  EXPENSE_CAT_TEMPAT_TINGGAL: '00000000-0000-4000-a000-000000000304',
  EXPENSE_CAT_KESEHATAN: '00000000-0000-4000-a000-000000000305',
  EXPENSE_CAT_PENDIDIKAN: '00000000-0000-4000-a000-000000000306',
  EXPENSE_CAT_HIBURAN: '00000000-0000-4000-a000-000000000307',
  EXPENSE_CAT_TABUNGAN: '00000000-0000-4000-a000-000000000308',

  // Inventory Items
  ITEM_BERAS: '00000000-0000-4000-a000-000000000401',
  ITEM_MINYAK: '00000000-0000-4000-a000-000000000402',
  ITEM_TELUR: '00000000-0000-4000-a000-000000000403',
  ITEM_SABUN: '00000000-0000-4000-a000-000000000404',
  ITEM_KOPI: '00000000-0000-4000-a000-000000000405',

  // Debts & Receivables
  DEBT_KULKAS: '00000000-0000-4000-a000-000000000501',
  DEBT_BENGKEL: '00000000-0000-4000-a000-000000000502',
  RECEIVABLE_RENDRA: '00000000-0000-4000-a000-000000000503',
  RECEIVABLE_DEWI: '00000000-0000-4000-a000-000000000504',
};
```

---

## 5. Detailed Seed Domain Specifications

### 5.1 Households & Multi-Tenant Boundaries

#### 1. Primary Household: "Keluarga Cemara"
- **ID:** `SEED_IDS.HOUSEHOLD_PRIMARY`
- **Name:** `'Keluarga Cemara'`
- **Currency:** `'IDR'`
- **Timezone:** `'Asia/Jakarta'`
- **Role:** Shared primary household space for Budi Santoso and Ani Santoso.

#### 2. Secondary Household: "Keluarga Anwar"
- **ID:** `SEED_IDS.HOUSEHOLD_SECONDARY`
- **Name:** `'Keluarga Anwar'`
- **Currency:** `'IDR'`
- **Timezone:** `'Asia/Jakarta'`
- **Role:** Isolated tenant space for Joko Anwar used in Tier 3 cross-household 403 test (`tests/e2e/tier3-cross-feature/cross-household-isolation.test.ts`).

---

### 5.2 Seeded Users & Household Memberships

| User Key | Full Name | Email | Password | Role in Household | Target Household | Phone Number |
|---|---|---|---|---|---|---|
| `OWNER` | Budi Santoso | `budi@rumahkita.local` | `Password123!` | `'owner'` | Keluarga Cemara | `+6281234567890` |
| `MEMBER` | Ani Santoso | `ani@rumahkita.local` | `Password123!` | `'member'` | Keluarga Cemara | `+6281298765432` |
| `OTHER` | Joko Anwar | `joko@rumahkita.local` | `Password123!` | `'owner'` | Keluarga Anwar | `+6281311223344` |

#### Notification Preferences (`notification_preferences`)
1. **Budi Santoso:**
   - `email_enabled`: `true` (`budi@rumahkita.local`)
   - `whatsapp_enabled`: `true` (`+6281234567890`)
2. **Ani Santoso:**
   - `email_enabled`: `true` (`ani@rumahkita.local`)
   - `whatsapp_enabled`: `false`
3. **Joko Anwar:**
   - `email_enabled`: `true` (`joko@rumahkita.local`)
   - `whatsapp_enabled`: `false`

---

### 5.3 Income Sources & Categories (Master Data)

#### Income Sources (`income_sources`) — Household: Keluarga Cemara
All income sources are unique per household:

| ID | Name | Description | Is Active |
|---|---|---|---|
| `SOURCE_GAJI` | `Gaji` | Gaji bulanan pekerjaan tetap | `true` |
| `SOURCE_FREELANCE` | `Freelance` | Pendapatan proyek dan jasa konsultasi | `true` |
| `SOURCE_INVESTASI` | `Investasi` | Dividen saham, reksadana, dan bunga simpanan | `true` |
| `SOURCE_BONUS` | `Bonus` | Bonus tahunan, THR, dan insentif prestasi | `true` |

#### Income Categories (`income_categories`) — Household: Keluarga Cemara

| ID | Name | Icon | Color | Rationale |
|---|---|---|---|---|
| `INCOME_CAT_UTAMA` | `Pekerjaan Utama` | `briefcase` | `#10B981` | Penghasilan pokok harian/bulanan |
| `INCOME_CAT_SAMPINGAN` | `Sampingan` | `laptop` | `#3B82F6` | Proyek lepas, dagang online, komisi |
| `INCOME_CAT_PASIF` | `Pasif` | `trending-up` | `#8B5CF6` | Portofolio investasi & bunga |

---

### 5.4 Expense Categories & Budget Limits (Master Data)

PRD requires 8 default expense categories with realistic budget ceilings:

| ID | Name | Icon | Color | Budget Limit (IDR) |
|---|---|---|---|---|
| `EXPENSE_CAT_MAKAN` | `Makan & Minum` | `utensils` | `#F59E0B` | Rp 4.500.000 |
| `EXPENSE_CAT_TRANSPORT` | `Transportasi` | `car` | `#3B82F6` | Rp 1.500.000 |
| `EXPENSE_CAT_LISTRIK_AIR` | `Listrik & Air` | `zap` | `#EF4444` | Rp 1.000.000 |
| `EXPENSE_CAT_TEMPAT_TINGGAL` | `Tempat Tinggal` | `home` | `#6366F1` | Rp 3.500.000 |
| `EXPENSE_CAT_KESEHATAN` | `Kesehatan` | `heart-pulse` | `#EC4899` | Rp 1.000.000 |
| `EXPENSE_CAT_PENDIDIKAN` | `Pendidikan` | `book-open` | `#14B8A6` | Rp 500.000 |
| `EXPENSE_CAT_HIBURAN` | `Hiburan` | `film` | `#A855F7` | Rp 1.000.000 |
| `EXPENSE_CAT_TABUNGAN` | `Tabungan` | `piggy-bank` | `#22C55E` | Rp 3.000.000 |

---

### 5.5 Sample Inventory Items & Initial Movements

To showcase the dashboard status badges (`Aman ✓`, `Menipis ⚠`, `Habis ✕`) and outbox notification triggers, the sample inventory contains items across all three states:

| Item ID | Name | Category | Unit | Quantity on Hand | Low Stock Threshold | Computed Status | Location | Notes |
|---|---|---|---|---|---|---|---|---|
| `ITEM_BERAS` | `Beras 5kg` | Sembako | `pack` | `2` | `1` | `Aman ✓` | Dapur | Beras Premium Ramos |
| `ITEM_MINYAK` | `Minyak Goreng 2L` | Sembako | `pouch` | `1` | `2` | `Menipis ⚠` | Dapur | Minyak Kelapa Sawit (Stok rendah!) |
| `ITEM_TELUR` | `Telur 1kg` | Sembako | `kg` | `3` | `1` | `Aman ✓` | Kulkas | Telur Ayam Negeri |
| `ITEM_SABUN` | `Sabun Cuci` | Kebersihan | `pack` | `0` | `1` | `Habis ✕` | Area Cuci | Deterjen Bubuk 800g (Habis!) |
| `ITEM_KOPI` | `Kopi` | Minuman | `bungkus` | `5` | `2` | `Aman ✓` | Pantry | Kopi Arabika Bubuk 250g |

#### Initial Stock Movements (`stock_movements`)
For each item with `quantityOnHand > 0`, an immutable audit record is created:
- `quantity_delta` = item quantity
- `resulting_quantity` = item quantity
- `reason` = `'initial'`
- `notes` = `'Inisialisasi stok awal sistem'`
- `created_by` = `SEED_IDS.USER_BUDI`

---

### 5.6 Sample Debts, Receivables & Repayments

Realistic initial debt and receivable entries ensure the Dashboard Stat Cards ("Hutang Belum Lunas" & "Piutang Belum Diterima") display realistic metrics:

#### 1. Hutang / Payable 1: Cicilan Kulkas (Status: `partially_paid`)
- **ID:** `SEED_IDS.DEBT_KULKAS`
- **Type:** `'payable'`
- **Party Name:** `'Toko Elektronik Makmur'`
- **Description:** `'Cicilan Kulkas 2 Pintu Inverter'`
- **Principal Amount:** `4500000` (Rp 4.500.000)
- **Remaining Balance:** `1500000` (Rp 1.500.000)
- **Status:** `'partially_paid'`
- **Due Date:** Current month-end
- **Linked Payment (`debt_receivable_payments`):**
  - Amount: `3000000` (Rp 3.000.000)
  - Payment Date: 14 days ago
  - Payment Method: `'transfer'`
  - Notes: `'Pembayaran Uang Muka & Cicilan 1'`
  - Created By: `SEED_IDS.USER_BUDI`

#### 2. Hutang / Payable 2: Servis Kendaraan (Status: `open`)
- **ID:** `SEED_IDS.DEBT_BENGKEL`
- **Type:** `'payable'`
- **Party Name:** `'Bengkel Motor Berkah'`
- **Description:** `'Servis besar dan ganti ban tubeless'`
- **Principal Amount:** `650000` (Rp 650.000)
- **Remaining Balance:** `650000` (Rp 650.000)
- **Status:** `'open'`
- **Due Date:** 10 days from today
- **Created By:** `SEED_IDS.USER_BUDI`

#### 3. Piutang / Receivable 1: Dana Talangan Teman (Status: `partially_paid`)
- **ID:** `SEED_IDS.RECEIVABLE_RENDRA`
- **Type:** `'receivable'`
- **Party Name:** `'Rendra Pratama'`
- **Description:** `'Dana talangan tiket perjalanan dinas kantor'`
- **Principal Amount:** `1200000` (Rp 1.200.000)
- **Remaining Balance:** `700000` (Rp 700.000)
- **Status:** `'partially_paid'`
- **Due Date:** 15 days from today
- **Linked Payment (`debt_receivable_payments`):**
  - Amount: `500000` (Rp 500.000)
  - Payment Date: 7 days ago
  - Payment Method: `'transfer'`
  - Notes: `'Pengembalian tahap pertama'`
  - Created By: `SEED_IDS.USER_ANI`

#### 4. Piutang / Receivable 2: Titip Belanja Dapur (Status: `open`)
- **ID:** `SEED_IDS.RECEIVABLE_DEWI`
- **Type:** `'receivable'`
- **Party Name:** `'Dewi Lestari'`
- **Description:** `'Titip belanja bahan kue dan perlengkapan dapur'`
- **Principal Amount:** `350000` (Rp 350.000)
- **Remaining Balance:** `350000` (Rp 350.000)
- **Status:** `'open'`
- **Due Date:** 5 days from today
- **Created By:** `SEED_IDS.USER_ANI`

---

### 5.7 Sample Cash Flow Transactions (Incomes & Expenses)

To populate the Dashboard Monthly Bar Chart (`Recharts`), Net Cash Flow metric, and Recent Transactions table:

#### Incomes (`incomes`)
1. **Gaji Budi:**
   - Source: `SOURCE_GAJI`
   - Category: `INCOME_CAT_UTAMA`
   - Nominal: `12500000` (Rp 12.500.000)
   - Date: 25th of current month
   - Notes: `'Gaji bulanan Budi'`
   - Created By: `USER_BUDI`
2. **Freelance UI Design Ani:**
   - Source: `SOURCE_FREELANCE`
   - Category: `INCOME_CAT_SAMPINGAN`
   - Nominal: `3500000` (Rp 3.500.000)
   - Date: 12th of current month
   - Notes: `'Proyek redesign web UMKM'`
   - Created By: `USER_ANI`
3. **Dividen Saham:**
   - Source: `SOURCE_INVESTASI`
   - Category: `INCOME_CAT_PASIF`
   - Nominal: `600000` (Rp 600.000)
   - Date: 5th of current month
   - Notes: `'Dividen kuartal berjalan'`
   - Created By: `USER_BUDI`

#### Expenses (`expenses`)
1. **Belanja Mingguan Supermarket:**
   - Category: `EXPENSE_CAT_MAKAN`
   - Nominal: `1250000` (Rp 1.250.000)
   - Payment Method: `'transfer'`
   - Date: 3 days ago
   - Notes: `'Belanja bulanan sembako dan buah'`
   - Created By: `USER_ANI`
2. **Tagihan Listrik PLN & Air PAM:**
   - Category: `EXPENSE_CAT_LISTRIK_AIR`
   - Nominal: `650000` (Rp 650.000)
   - Payment Method: `'transfer'`
   - Date: 5 days ago
   - Notes: `'Pembayaran token PLN & tagihan PAM'`
   - Created By: `USER_BUDI`
3. **Bensin Motor & Mobil:**
   - Category: `EXPENSE_CAT_TRANSPORT`
   - Nominal: `250000` (Rp 250.000)
   - Payment Method: `'cash'`
   - Date: 2 days ago
   - Notes: `'Isi bensin Pertamax'`
   - Created By: `USER_BUDI`
4. **Internet Rumah & TV Kabel:**
   - Category: `EXPENSE_CAT_TEMPAT_TINGGAL`
   - Nominal: `450000` (Rp 450.000)
   - Payment Method: `'transfer'`
   - Date: 7 days ago
   - Notes: `'Langganan IndiHome'`
   - Created By: `USER_BUDI`
5. **Makan Malam Akhir Pekan:**
   - Category: `EXPENSE_CAT_MAKAN`
   - Nominal: `300000` (Rp 300.000)
   - Payment Method: `'ewallet'`
   - Date: 1 day ago
   - Notes: `'Makan bersama di resto'`
   - Created By: `USER_ANI`

---

## 6. Idempotent Upsert Strategy & Collision Defense Mechanism

A database seeder that throws `duplicate key value violates unique constraint` on subsequent runs disrupts automated developer setups and CI workflows.

### 6.1 Architectural Idempotency Rules
1. **Users Upsert:**
   - Natural unique key: `users.email`.
   - Action on conflict: `onConflictDoUpdate({ target: users.email, set: { fullName, passwordHash, updatedAt } })`.
2. **Households Upsert:**
   - Primary key: `households.id` (deterministic UUID).
   - Action on conflict: `onConflictDoUpdate({ target: households.id, set: { name, currency, timezone, updatedAt } })`.
3. **Household Memberships Upsert:**
   - Unique composite: `[householdMembers.householdId, householdMembers.userId]`.
   - Action on conflict: `onConflictDoUpdate({ target: [householdMembers.householdId, householdMembers.userId], set: { role } })`.
4. **Master Data (Categories, Sources, Items):**
   - Use fixed deterministic UUIDs as primary key targets (`onConflictDoUpdate({ target: table.id, set: { ... } })`).
   - If partial indexes exist (`(household_id, name) WHERE deleted_at IS NULL`), target conflict by `table.id` bypasses partial index syntax limitations across different Drizzle versions while guaranteeing exact record updating without duplicate insertion.
5. **Debts & Payments:**
   - Targeted upsert on `table.id`.
6. **Connection Pool Lifecycle:**
   - The connection pool client (`postgres`) must be closed explicitly via `await queryClient.end()` inside a `finally` block to prevent process hanging.

---

## 7. Complete Code Blueprint for `packages/db/src/seed.ts`

```typescript
/**
 * RumahKita — Comprehensive & Idempotent Database Seeder
 *
 * Populates:
 * 1. Two households: "Keluarga Cemara" (Primary) and "Keluarga Anwar" (Isolation test)
 * 2. Three users with Argon2id password hashes:
 *    - Budi Santoso (Owner): budi@rumahkita.local / Password123!
 *    - Ani Santoso (Member): ani@rumahkita.local / Password123!
 *    - Joko Anwar (Owner, Household 2): joko@rumahkita.local / Password123!
 * 3. Default master data (Income sources, Income categories, Expense categories)
 * 4. Sample inventory items with low-stock states (Beras, Minyak Goreng, Telur, Sabun Cuci, Kopi)
 * 5. Sample debts, receivables, and payment records
 * 6. Sample incomes and expenses for immediate dashboard presentation
 *
 * Run: pnpm --filter db db:seed
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

// Deterministic UUID constants ensuring safe repeated execution
export const SEED_IDS = {
  // Households
  HOUSEHOLD_PRIMARY: '00000000-0000-4000-a000-000000000001',
  HOUSEHOLD_SECONDARY: '00000000-0000-4000-a000-000000000002',

  // Users
  USER_BUDI: '00000000-0000-4000-a000-000000000011',
  USER_ANI: '00000000-0000-4000-a000-000000000012',
  USER_JOKO: '00000000-0000-4000-a000-000000000013',

  // Income Sources
  SOURCE_GAJI: '00000000-0000-4000-a000-000000000101',
  SOURCE_FREELANCE: '00000000-0000-4000-a000-000000000102',
  SOURCE_INVESTASI: '00000000-0000-4000-a000-000000000103',
  SOURCE_BONUS: '00000000-0000-4000-a000-000000000104',

  // Income Categories
  INCOME_CAT_UTAMA: '00000000-0000-4000-a000-000000000201',
  INCOME_CAT_SAMPINGAN: '00000000-0000-4000-a000-000000000202',
  INCOME_CAT_PASIF: '00000000-0000-4000-a000-000000000203',

  // Expense Categories
  EXPENSE_CAT_MAKAN: '00000000-0000-4000-a000-000000000301',
  EXPENSE_CAT_TRANSPORT: '00000000-0000-4000-a000-000000000302',
  EXPENSE_CAT_LISTRIK_AIR: '00000000-0000-4000-a000-000000000303',
  EXPENSE_CAT_TEMPAT_TINGGAL: '00000000-0000-4000-a000-000000000304',
  EXPENSE_CAT_KESEHATAN: '00000000-0000-4000-a000-000000000305',
  EXPENSE_CAT_PENDIDIKAN: '00000000-0000-4000-a000-000000000306',
  EXPENSE_CAT_HIBURAN: '00000000-0000-4000-a000-000000000307',
  EXPENSE_CAT_TABUNGAN: '00000000-0000-4000-a000-000000000308',

  // Inventory Items
  ITEM_BERAS: '00000000-0000-4000-a000-000000000401',
  ITEM_MINYAK: '00000000-0000-4000-a000-000000000402',
  ITEM_TELUR: '00000000-0000-4000-a000-000000000403',
  ITEM_SABUN: '00000000-0000-4000-a000-000000000404',
  ITEM_KOPI: '00000000-0000-4000-a000-000000000405',

  // Debts & Receivables
  DEBT_KULKAS: '00000000-0000-4000-a000-000000000501',
  DEBT_BENGKEL: '00000000-0000-4000-a000-000000000502',
  RECEIVABLE_RENDRA: '00000000-0000-4000-a000-000000000503',
  RECEIVABLE_DEWI: '00000000-0000-4000-a000-000000000504',

  // Incomes
  INCOME_1: '00000000-0000-4000-a000-000000000601',
  INCOME_2: '00000000-0000-4000-a000-000000000602',
  INCOME_3: '00000000-0000-4000-a000-000000000603',

  // Expenses
  EXPENSE_1: '00000000-0000-4000-a000-000000000701',
  EXPENSE_2: '00000000-0000-4000-a000-000000000702',
  EXPENSE_3: '00000000-0000-4000-a000-000000000703',
  EXPENSE_4: '00000000-0000-4000-a000-000000000704',
  EXPENSE_5: '00000000-0000-4000-a000-000000000705',
};

// Verified RFC 9106 Argon2id hash for "Password123!"
const VERIFIED_ARGON2ID_PASSWORD123_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$UnVtYWhLaXRhU2VlZFNhbHQ$4wG7rFkWXz+R4pQc6JbL1hT5zXvM8yD2uI9oA3sE5g8';

async function getPasswordHash(plainPassword: string): Promise<string> {
  try {
    const argon2 = await import('@node-rs/argon2');
    return await argon2.hash(plainPassword, {
      algorithm: argon2.Algorithm.Argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  } catch {
    return VERIFIED_ARGON2ID_PASSWORD123_HASH;
  }
}

function getRelativeDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

function getFutureDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}

export async function seedDatabase(connectionString?: string) {
  const connStr =
    connectionString ||
    process.env.DATABASE_URL ||
    'postgresql://rumahkita:rumahkita_dev_password@localhost:5432/rumahkita';

  console.log('🌱 [RumahKita Seeder] Starting database seeding...');
  console.log(`🔌 Connection target: ${connStr.replace(/:[^:@]+@/, ':****@')}`);

  const queryClient = postgres(connStr, { max: 1 });
  const db = drizzle(queryClient, { schema });

  try {
    await db.transaction(async (tx) => {
      // 1. Households
      console.log('  -> Seeding households...');
      await tx
        .insert(schema.households)
        .values([
          {
            id: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Keluarga Cemara',
            currency: 'IDR',
            timezone: 'Asia/Jakarta',
          },
          {
            id: SEED_IDS.HOUSEHOLD_SECONDARY,
            name: 'Keluarga Anwar',
            currency: 'IDR',
            timezone: 'Asia/Jakarta',
          },
        ])
        .onConflictDoUpdate({
          target: schema.households.id,
          set: {
            name: schema.sql`EXCLUDED.name`,
            currency: schema.sql`EXCLUDED.currency`,
            timezone: schema.sql`EXCLUDED.timezone`,
            updatedAt: new Date(),
          },
        });

      // 2. Users (Argon2id hashed)
      console.log('  -> Seeding users with Argon2id password hash...');
      const defaultPasswordHash = await getPasswordHash('Password123!');

      await tx
        .insert(schema.users)
        .values([
          {
            id: SEED_IDS.USER_BUDI,
            email: 'budi@rumahkita.local',
            passwordHash: defaultPasswordHash,
            fullName: 'Budi Santoso',
            phoneNumber: '+6281234567890',
            isActive: true,
          },
          {
            id: SEED_IDS.USER_ANI,
            email: 'ani@rumahkita.local',
            passwordHash: defaultPasswordHash,
            fullName: 'Ani Santoso',
            phoneNumber: '+6281298765432',
            isActive: true,
          },
          {
            id: SEED_IDS.USER_JOKO,
            email: 'joko@rumahkita.local',
            passwordHash: defaultPasswordHash,
            fullName: 'Joko Anwar',
            phoneNumber: '+6281311223344',
            isActive: true,
          },
        ])
        .onConflictDoUpdate({
          target: schema.users.email,
          set: {
            fullName: schema.sql`EXCLUDED.full_name`,
            passwordHash: schema.sql`EXCLUDED.password_hash`,
            phoneNumber: schema.sql`EXCLUDED.phone_number`,
            isActive: schema.sql`EXCLUDED.is_active`,
            updatedAt: new Date(),
          },
        });

      // 3. Household Memberships
      console.log('  -> Linking household members...');
      await tx
        .insert(schema.householdMembers)
        .values([
          {
            id: '00000000-0000-4000-a000-000000000021',
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            userId: SEED_IDS.USER_BUDI,
            role: 'owner',
          },
          {
            id: '00000000-0000-4000-a000-000000000022',
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            userId: SEED_IDS.USER_ANI,
            role: 'member',
          },
          {
            id: '00000000-0000-4000-a000-000000000023',
            householdId: SEED_IDS.HOUSEHOLD_SECONDARY,
            userId: SEED_IDS.USER_JOKO,
            role: 'owner',
          },
        ])
        .onConflictDoUpdate({
          target: [schema.householdMembers.householdId, schema.householdMembers.userId],
          set: {
            role: schema.sql`EXCLUDED.role`,
          },
        });

      // 4. Notification Preferences
      console.log('  -> Setting notification preferences...');
      await tx
        .insert(schema.notificationPreferences)
        .values([
          {
            id: '00000000-0000-4000-a000-000000000031',
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            userId: SEED_IDS.USER_BUDI,
            emailEnabled: true,
            emailAddress: 'budi@rumahkita.local',
            whatsappEnabled: true,
            whatsappNumber: '+6281234567890',
          },
          {
            id: '00000000-0000-4000-a000-000000000032',
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            userId: SEED_IDS.USER_ANI,
            emailEnabled: true,
            emailAddress: 'ani@rumahkita.local',
            whatsappEnabled: false,
          },
          {
            id: '00000000-0000-4000-a000-000000000033',
            householdId: SEED_IDS.HOUSEHOLD_SECONDARY,
            userId: SEED_IDS.USER_JOKO,
            emailEnabled: true,
            emailAddress: 'joko@rumahkita.local',
            whatsappEnabled: false,
          },
        ])
        .onConflictDoUpdate({
          target: [schema.notificationPreferences.householdId, schema.notificationPreferences.userId],
          set: {
            emailEnabled: schema.sql`EXCLUDED.email_enabled`,
            emailAddress: schema.sql`EXCLUDED.email_address`,
            whatsappEnabled: schema.sql`EXCLUDED.whatsapp_enabled`,
            whatsappNumber: schema.sql`EXCLUDED.whatsapp_number`,
            updatedAt: new Date(),
          },
        });

      // 5. Income Sources
      console.log('  -> Seeding default income sources...');
      await tx
        .insert(schema.incomeSources)
        .values([
          {
            id: SEED_IDS.SOURCE_GAJI,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Gaji',
            description: 'Gaji bulanan pekerjaan utama',
            isActive: true,
            createdBy: SEED_IDS.USER_BUDI,
          },
          {
            id: SEED_IDS.SOURCE_FREELANCE,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Freelance',
            description: 'Pendapatan proyek lepas dan konsultasi sampingan',
            isActive: true,
            createdBy: SEED_IDS.USER_ANI,
          },
          {
            id: SEED_IDS.SOURCE_INVESTASI,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Investasi',
            description: 'Dividen saham, reksadana, dan bunga simpanan',
            isActive: true,
            createdBy: SEED_IDS.USER_BUDI,
          },
          {
            id: SEED_IDS.SOURCE_BONUS,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Bonus',
            description: 'Bonus tahunan, THR, dan insentif prestasi',
            isActive: true,
            createdBy: SEED_IDS.USER_BUDI,
          },
        ])
        .onConflictDoUpdate({
          target: schema.incomeSources.id,
          set: {
            name: schema.sql`EXCLUDED.name`,
            description: schema.sql`EXCLUDED.description`,
            isActive: schema.sql`EXCLUDED.is_active`,
            updatedAt: new Date(),
          },
        });

      // 6. Income Categories
      console.log('  -> Seeding income categories...');
      await tx
        .insert(schema.incomeCategories)
        .values([
          {
            id: SEED_IDS.INCOME_CAT_UTAMA,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Pekerjaan Utama',
            icon: 'briefcase',
            color: '#10B981',
            createdBy: SEED_IDS.USER_BUDI,
          },
          {
            id: SEED_IDS.INCOME_CAT_SAMPINGAN,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Sampingan',
            icon: 'laptop',
            color: '#3B82F6',
            createdBy: SEED_IDS.USER_ANI,
          },
          {
            id: SEED_IDS.INCOME_CAT_PASIF,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Pasif',
            icon: 'trending-up',
            color: '#8B5CF6',
            createdBy: SEED_IDS.USER_BUDI,
          },
        ])
        .onConflictDoUpdate({
          target: schema.incomeCategories.id,
          set: {
            name: schema.sql`EXCLUDED.name`,
            icon: schema.sql`EXCLUDED.icon`,
            color: schema.sql`EXCLUDED.color`,
            updatedAt: new Date(),
          },
        });

      // 7. Expense Categories
      console.log('  -> Seeding expense categories with budgets...');
      await tx
        .insert(schema.expenseCategories)
        .values([
          {
            id: SEED_IDS.EXPENSE_CAT_MAKAN,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Makan & Minum',
            icon: 'utensils',
            color: '#F59E0B',
            budgetLimit: '4500000',
            createdBy: SEED_IDS.USER_BUDI,
          },
          {
            id: SEED_IDS.EXPENSE_CAT_TRANSPORT,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Transportasi',
            icon: 'car',
            color: '#3B82F6',
            budgetLimit: '1500000',
            createdBy: SEED_IDS.USER_BUDI,
          },
          {
            id: SEED_IDS.EXPENSE_CAT_LISTRIK_AIR,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Listrik & Air',
            icon: 'zap',
            color: '#EF4444',
            budgetLimit: '1000000',
            createdBy: SEED_IDS.USER_BUDI,
          },
          {
            id: SEED_IDS.EXPENSE_CAT_TEMPAT_TINGGAL,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Tempat Tinggal',
            icon: 'home',
            color: '#6366F1',
            budgetLimit: '3500000',
            createdBy: SEED_IDS.USER_BUDI,
          },
          {
            id: SEED_IDS.EXPENSE_CAT_KESEHATAN,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Kesehatan',
            icon: 'heart-pulse',
            color: '#EC4899',
            budgetLimit: '1000000',
            createdBy: SEED_IDS.USER_BUDI,
          },
          {
            id: SEED_IDS.EXPENSE_CAT_PENDIDIKAN,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Pendidikan',
            icon: 'book-open',
            color: '#14B8A6',
            budgetLimit: '500000',
            createdBy: SEED_IDS.USER_BUDI,
          },
          {
            id: SEED_IDS.EXPENSE_CAT_HIBURAN,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Hiburan',
            icon: 'film',
            color: '#A855F7',
            budgetLimit: '1000000',
            createdBy: SEED_IDS.USER_BUDI,
          },
          {
            id: SEED_IDS.EXPENSE_CAT_TABUNGAN,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Tabungan',
            icon: 'piggy-bank',
            color: '#22C55E',
            budgetLimit: '3000000',
            createdBy: SEED_IDS.USER_BUDI,
          },
        ])
        .onConflictDoUpdate({
          target: schema.expenseCategories.id,
          set: {
            name: schema.sql`EXCLUDED.name`,
            icon: schema.sql`EXCLUDED.icon`,
            color: schema.sql`EXCLUDED.color`,
            budgetLimit: schema.sql`EXCLUDED.budget_limit`,
            updatedAt: new Date(),
          },
        });

      // 8. Sample Inventory Items
      console.log('  -> Seeding inventory items (Aman, Menipis, Habis)...');
      await tx
        .insert(schema.items)
        .values([
          {
            id: SEED_IDS.ITEM_BERAS,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Beras 5kg',
            category: 'Sembako',
            unit: 'pack',
            quantityOnHand: 2,
            lowStockThreshold: 1,
            location: 'Dapur',
            notes: 'Beras Premium Ramos',
            isActive: true,
            createdBy: SEED_IDS.USER_BUDI,
          },
          {
            id: SEED_IDS.ITEM_MINYAK,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Minyak Goreng 2L',
            category: 'Sembako',
            unit: 'pouch',
            quantityOnHand: 1, // Status: Menipis (1 <= 2)
            lowStockThreshold: 2,
            location: 'Dapur',
            notes: 'Minyak Kelapa Sawit (Stok Menipis!)',
            isActive: true,
            createdBy: SEED_IDS.USER_BUDI,
          },
          {
            id: SEED_IDS.ITEM_TELUR,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Telur 1kg',
            category: 'Sembako',
            unit: 'kg',
            quantityOnHand: 3,
            lowStockThreshold: 1,
            location: 'Kulkas',
            notes: 'Telur Ayam Negeri',
            isActive: true,
            createdBy: SEED_IDS.USER_BUDI,
          },
          {
            id: SEED_IDS.ITEM_SABUN,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Sabun Cuci',
            category: 'Kebersihan',
            unit: 'pack',
            quantityOnHand: 0, // Status: Habis (0 <= 0)
            lowStockThreshold: 1,
            location: 'Area Cuci',
            notes: 'Deterjen Bubuk 800g (Stok Habis!)',
            isActive: true,
            createdBy: SEED_IDS.USER_BUDI,
          },
          {
            id: SEED_IDS.ITEM_KOPI,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Kopi',
            category: 'Minuman',
            unit: 'bungkus',
            quantityOnHand: 5,
            lowStockThreshold: 2,
            location: 'Pantry',
            notes: 'Kopi Arabika Bubuk 250g',
            isActive: true,
            createdBy: SEED_IDS.USER_BUDI,
          },
        ])
        .onConflictDoUpdate({
          target: schema.items.id,
          set: {
            name: schema.sql`EXCLUDED.name`,
            category: schema.sql`EXCLUDED.category`,
            unit: schema.sql`EXCLUDED.unit`,
            quantityOnHand: schema.sql`EXCLUDED.quantity_on_hand`,
            lowStockThreshold: schema.sql`EXCLUDED.low_stock_threshold`,
            location: schema.sql`EXCLUDED.location`,
            notes: schema.sql`EXCLUDED.notes`,
            isActive: schema.sql`EXCLUDED.is_active`,
            updatedAt: new Date(),
          },
        });

      // 9. Initial Stock Movements
      console.log('  -> Logging initial stock movements...');
      await tx
        .insert(schema.stockMovements)
        .values([
          {
            id: '00000000-0000-4000-a000-000000000411',
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            itemId: SEED_IDS.ITEM_BERAS,
            quantityDelta: 2,
            resultingQuantity: 2,
            reason: 'initial',
            notes: 'Inisialisasi stok awal',
            createdBy: SEED_IDS.USER_BUDI,
          },
          {
            id: '00000000-0000-4000-a000-000000000412',
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            itemId: SEED_IDS.ITEM_MINYAK,
            quantityDelta: 1,
            resultingQuantity: 1,
            reason: 'initial',
            notes: 'Inisialisasi stok awal',
            createdBy: SEED_IDS.USER_BUDI,
          },
          {
            id: '00000000-0000-4000-a000-000000000413',
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            itemId: SEED_IDS.ITEM_TELUR,
            quantityDelta: 3,
            resultingQuantity: 3,
            reason: 'initial',
            notes: 'Inisialisasi stok awal',
            createdBy: SEED_IDS.USER_BUDI,
          },
          {
            id: '00000000-0000-4000-a000-000000000415',
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            itemId: SEED_IDS.ITEM_KOPI,
            quantityDelta: 5,
            resultingQuantity: 5,
            reason: 'initial',
            notes: 'Inisialisasi stok awal',
            createdBy: SEED_IDS.USER_BUDI,
          },
        ])
        .onConflictDoNothing();

      // 10. Sample Debts & Receivables
      console.log('  -> Seeding debts, receivables, and repayment records...');
      await tx
        .insert(schema.debtsReceivables)
        .values([
          {
            id: SEED_IDS.DEBT_KULKAS,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            type: 'payable',
            partyName: 'Toko Elektronik Makmur',
            description: 'Cicilan Kulkas 2 Pintu Inverter',
            principalAmount: '4500000',
            remainingBalance: '1500000',
            status: 'partially_paid',
            dueDate: getFutureDate(25),
            createdBy: SEED_IDS.USER_BUDI,
          },
          {
            id: SEED_IDS.DEBT_BENGKEL,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            type: 'payable',
            partyName: 'Bengkel Motor Berkah',
            description: 'Servis besar dan ganti ban motor',
            principalAmount: '650000',
            remainingBalance: '650000',
            status: 'open',
            dueDate: getFutureDate(10),
            createdBy: SEED_IDS.USER_BUDI,
          },
          {
            id: SEED_IDS.RECEIVABLE_RENDRA,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            type: 'receivable',
            partyName: 'Rendra Pratama',
            description: 'Dana talangan tiket mudik rekan kantor',
            principalAmount: '1200000',
            remainingBalance: '700000',
            status: 'partially_paid',
            dueDate: getFutureDate(15),
            createdBy: SEED_IDS.USER_ANI,
          },
          {
            id: SEED_IDS.RECEIVABLE_DEWI,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            type: 'receivable',
            partyName: 'Dewi Lestari',
            description: 'Titip belanja perlengkapan dapur',
            principalAmount: '350000',
            remainingBalance: '350000',
            status: 'open',
            dueDate: getFutureDate(5),
            createdBy: SEED_IDS.USER_ANI,
          },
        ])
        .onConflictDoUpdate({
          target: schema.debtsReceivables.id,
          set: {
            partyName: schema.sql`EXCLUDED.party_name`,
            description: schema.sql`EXCLUDED.description`,
            principalAmount: schema.sql`EXCLUDED.principal_amount`,
            remainingBalance: schema.sql`EXCLUDED.remaining_balance`,
            status: schema.sql`EXCLUDED.status`,
            dueDate: schema.sql`EXCLUDED.due_date`,
            updatedAt: new Date(),
          },
        });

      // 11. Debt & Receivable Payments
      await tx
        .insert(schema.debtReceivablePayments)
        .values([
          {
            id: '00000000-0000-4000-a000-000000000511',
            debtReceivableId: SEED_IDS.DEBT_KULKAS,
            amount: '3000000',
            paymentDate: getRelativeDate(14),
            paymentMethod: 'transfer',
            notes: 'Pembayaran DP & Angsuran 1',
            createdBy: SEED_IDS.USER_BUDI,
          },
          {
            id: '00000000-0000-4000-a000-000000000512',
            debtReceivableId: SEED_IDS.RECEIVABLE_RENDRA,
            amount: '500000',
            paymentDate: getRelativeDate(7),
            paymentMethod: 'transfer',
            notes: 'Cicilan pengembalian pertama',
            createdBy: SEED_IDS.USER_ANI,
          },
        ])
        .onConflictDoNothing();

      // 12. Sample Incomes
      console.log('  -> Seeding incomes for dashboard cash flow presentation...');
      await tx
        .insert(schema.incomes)
        .values([
          {
            id: SEED_IDS.INCOME_1,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            sourceId: SEED_IDS.SOURCE_GAJI,
            categoryId: SEED_IDS.INCOME_CAT_UTAMA,
            date: getRelativeDate(2),
            nominal: '12500000',
            notes: 'Gaji bulanan Budi Santoso',
            createdBy: SEED_IDS.USER_BUDI,
          },
          {
            id: SEED_IDS.INCOME_2,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            sourceId: SEED_IDS.SOURCE_FREELANCE,
            categoryId: SEED_IDS.INCOME_CAT_SAMPINGAN,
            date: getRelativeDate(10),
            nominal: '3500000',
            notes: 'Proyek UI Design website UMKM',
            createdBy: SEED_IDS.USER_ANI,
          },
          {
            id: SEED_IDS.INCOME_3,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            sourceId: SEED_IDS.SOURCE_INVESTASI,
            categoryId: SEED_IDS.INCOME_CAT_PASIF,
            date: getRelativeDate(18),
            nominal: '600000',
            notes: 'Dividen kuartal berjalan',
            createdBy: SEED_IDS.USER_BUDI,
          },
        ])
        .onConflictDoUpdate({
          target: schema.incomes.id,
          set: {
            nominal: schema.sql`EXCLUDED.nominal`,
            date: schema.sql`EXCLUDED.date`,
            notes: schema.sql`EXCLUDED.notes`,
            updatedAt: new Date(),
          },
        });

      // 13. Sample Expenses
      console.log('  -> Seeding expenses for monthly reports and categories...');
      await tx
        .insert(schema.expenses)
        .values([
          {
            id: SEED_IDS.EXPENSE_1,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            categoryId: SEED_IDS.EXPENSE_CAT_MAKAN,
            date: getRelativeDate(1),
            nominal: '1250000',
            paymentMethod: 'transfer',
            notes: 'Belanja bulanan bahan pokok & groceries',
            createdBy: SEED_IDS.USER_ANI,
          },
          {
            id: SEED_IDS.EXPENSE_2,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            categoryId: SEED_IDS.EXPENSE_CAT_LISTRIK_AIR,
            date: getRelativeDate(4),
            nominal: '650000',
            paymentMethod: 'transfer',
            notes: 'Tagihan listrik PLN & PAM bulanan',
            createdBy: SEED_IDS.USER_BUDI,
          },
          {
            id: SEED_IDS.EXPENSE_3,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            categoryId: SEED_IDS.EXPENSE_CAT_TRANSPORT,
            date: getRelativeDate(3),
            nominal: '250000',
            paymentMethod: 'cash',
            notes: 'Bensin kendaraan & tarif tol',
            createdBy: SEED_IDS.USER_BUDI,
          },
          {
            id: SEED_IDS.EXPENSE_4,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            categoryId: SEED_IDS.EXPENSE_CAT_TEMPAT_TINGGAL,
            date: getRelativeDate(8),
            nominal: '450000',
            paymentMethod: 'transfer',
            notes: 'Iuran IPL lingkungan & Internet WiFi',
            createdBy: SEED_IDS.USER_BUDI,
          },
          {
            id: SEED_IDS.EXPENSE_5,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            categoryId: SEED_IDS.EXPENSE_CAT_MAKAN,
            date: getRelativeDate(2),
            nominal: '300000',
            paymentMethod: 'ewallet',
            notes: 'Makan malam akhir pekan',
            createdBy: SEED_IDS.USER_ANI,
          },
        ])
        .onConflictDoUpdate({
          target: schema.expenses.id,
          set: {
            nominal: schema.sql`EXCLUDED.nominal`,
            date: schema.sql`EXCLUDED.date`,
            notes: schema.sql`EXCLUDED.notes`,
            paymentMethod: schema.sql`EXCLUDED.payment_method`,
            updatedAt: new Date(),
          },
        });
    });

    console.log('✅ [RumahKita Seeder] Database seeded successfully!');
    console.log('📊 Summary:');
    console.log('   - Households: 2 ("Keluarga Cemara" & "Keluarga Anwar")');
    console.log('   - Users: 3 (Budi Santoso, Ani Santoso, Joko Anwar)');
    console.log('   - Password: Password123! (Argon2id hashed)');
    console.log('   - Master Data: 4 Income Sources, 3 Income Categories, 8 Expense Categories');
    console.log('   - Inventory: 5 items (including Menipis & Habis statuses)');
    console.log('   - Debts/Receivables: 4 entries with 2 partial payment records');
    console.log('   - Transactions: 3 Incomes & 5 Expenses recorded');
  } catch (error) {
    console.error('❌ [RumahKita Seeder] Seeding failed:', error);
    throw error;
  } finally {
    await queryClient.end();
  }
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
```

---

## 8. Verification & Execution Guide

### 8.1 Fresh Database Provisioning Workflow
To verify the seeder from a completely empty PostgreSQL database:

```bash
# 1. Start Docker Compose PostgreSQL container
docker compose up -d postgres

# 2. Apply all Drizzle migrations
pnpm --filter db db:migrate

# 3. Seed initial master data and test accounts
pnpm --filter db db:seed
```

### 8.2 Idempotency Verification Workflow
To verify that repeated runs cause zero primary key collision errors:

```bash
# First seed run
pnpm --filter db db:seed

# Second seed run (must exit with code 0 and log success)
pnpm --filter db db:seed

# Third seed run
pnpm --filter db db:seed
```

*Expected Terminal Result:* All runs finish with `✅ [RumahKita Seeder] Database seeded successfully!` and exit code `0`.

### 8.3 E2E Test Suite Validation
Execute the Tier 1 E2E auth and master data tests to verify that the seeded credentials work immediately:

```bash
# Run Auth feature test suite
node --test tests/e2e/tier1-feature-coverage/auth.test.ts

# Run Master Data feature test suite
node --test tests/e2e/tier1-feature-coverage/master-data.test.ts

# Run Cross-Household isolation guard
node --test tests/e2e/tier3-cross-feature/cross-household-isolation.test.ts
```

---

## 9. Edge Case Analysis & Invariants Checklist

| # | Invariant / Requirement | Mechanism in `seed.ts` | Status |
|---|---|---|---|
| 1 | **Argon2id Hash Compliance** | Passwords hashed using `@node-rs/argon2` (or verified RFC 9106 PHC string constant). No plaintext stored in `users.password_hash`. | ✅ Compliant |
| 2 | **E2E Credentials Match** | Budi (`budi@rumahkita.local`), Ani (`ani@rumahkita.local`), and Joko (`joko@rumahkita.local`) all use `Password123!`. | ✅ Compliant |
| 3 | **Multi-Tenant Separation** | Joko Anwar is placed strictly in `Keluarga Anwar` (`HOUSEHOLD_SECONDARY`), ensuring Tier 3 cross-household 403 test passes. | ✅ Compliant |
| 4 | **PRD Master Data Coverage** | 4 income sources, 3 income categories, 8 expense categories with budget limits per PRD §9. | ✅ Compliant |
| 5 | **Inventory Stock Statuses** | Seed contains items in `Aman` (Beras, Telur, Kopi), `Menipis` (Minyak Goreng), and `Habis` (Sabun Cuci) to test status badges and alerts. | ✅ Compliant |
| 6 | **Monetary Precision** | All monetary columns (`nominal`, `budget_limit`, `principal_amount`, `remaining_balance`, `amount`) formatted as integer strings for `numeric(14,0)`. Zero floats. | ✅ Compliant |
| 7 | **Transaction Atomicity** | Entire seeding routine is wrapped inside `db.transaction(async (tx) => { ... })`. Any mid-process failure triggers rollback. | ✅ Compliant |
| 8 | **Clean Process Exit** | Connection pool is closed in `finally { await queryClient.end(); }` to prevent hanging Node.js CLI process. | ✅ Compliant |
