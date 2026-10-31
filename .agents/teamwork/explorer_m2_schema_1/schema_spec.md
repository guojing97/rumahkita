# Milestone 2: Database Schema with Drizzle ORM — Complete Specification

**Document Version:** 1.0.0  
**Domain:** Database Architecture, Drizzle ORM Schema, Relational Invariants, and Seeder Blueprint  
**Target Code Directory:** `packages/db/src/schema/`  
**Date:** 2026-10-27  
**Authoritative References:**
- `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/ORIGINAL_REQUEST.md` (§R2)
- `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/PROJECT.md`
- `/Users/mac/Projects/03-Labs/RumahKita/Doc/prd.md` (§8, §9, §11)
- `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/spec_miner_survey_backend_1/survey_report.md`
- `/Users/mac/Projects/03-Labs/RumahKita/packages/contracts/src/`

---

## 1. Architectural & Relational Invariants

1. **Primary Keys:**
   - Every single table uses PostgreSQL `UUID` (`defaultRandom()`).
   - v7 sequential UUIDs are preferred for B-Tree index locality, while standard random UUIDs (`gen_random_uuid()` / `defaultRandom()`) are fully supported.
2. **Monetary Precision:**
   - Indonesian Rupiah (IDR) is an integer currency. Floating-point numbers (`float`, `real`, `double precision`) are strictly prohibited.
   - All currency columns use PostgreSQL `numeric(14, 0)` (`numeric({ precision: 14, scale: 0 })`), accommodating values up to 99,999,999,999,999 IDR (99.9 trillion Rupiah).
3. **Multi-Tenant Scoping (`household_id`):**
   - Every business table (`income_sources`, `income_categories`, `expense_categories`, `incomes`, `expenses`, `items`, `stock_movements`, `purchases`, `debts_receivables`, `notification_preferences`, `notification_events`, `audit_logs`) has a non-nullable `household_id` column referencing `households(id)` with `onDelete: 'cascade'`.
   - An explicit B-Tree index is defined on `household_id` for every business table to ensure fast partition/tenant filtering.
4. **Audit Columns:**
   - Standardized audit fields:
     - `created_at`: `timestamp('created_at', { withTimezone: true }).notNull().defaultNow()`
     - `updated_at`: `timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())`
     - `created_by`: `uuid('created_by')` referencing `users(id)`
     - `updated_by`: `uuid('updated_by')` referencing `users(id)`
5. **Soft Deletion (`deleted_at`):**
   - Applied to master data tables: `income_sources`, `income_categories`, `expense_categories`, `items`, and optionally `debts_receivables`, `incomes`, `expenses`.
   - Soft-deleted entities retain transactional referential integrity while being excluded from normal dropdowns and queries (`deleted_at IS NULL`).
   - Master data tables enforce partial unique indexes on `(household_id, name) WHERE deleted_at IS NULL` to prevent name duplication while allowing re-use of names after archival.
6. **PostgreSQL Enums (`pgEnum`):**
   - All enumerated types are defined using Drizzle's `pgEnum` for type safety in database DDL and TypeScript models.
7. **PostgreSQL Constraints:**
   - Check constraints enforce positive monetary values (`nominal > 0`, `principal_amount > 0`, `amount > 0`) and non-negative stocks (`quantity_on_hand >= 0`, `remaining_balance >= 0`).

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Auth | User Identity Storage | Stores user credentials, hashed passwords (Argon2id), and profile info | `email`, `password_hash`, `full_name`, `phone_number` | `users` record | Unique violation on `email` | PRD §6.1, §9 |
| 2 | Auth | Refresh Token Session Lineage | Tracks refresh token hashes, families, and expiry for rotation & reuse detection | `user_id`, `token_hash`, `family_id`, `expires_at` | `refresh_sessions` record | Unique violation on `token_hash` | PRD §6.1, §11 |
| 3 | Household | Tenant Entity | Represents the shared household context for members | `name`, `currency`, `timezone` | `households` record | Validation error if name is empty | PRD §4, §9 |
| 4 | Household | Member Scoping & Roles | Maps users to households with role-based access (`owner`, `member`) | `household_id`, `user_id`, `role` | `household_members` record | Unique violation on `(household_id, user_id)` | PRD §4, §9 |
| 5 | Master Data | Income Sources | User-defined sources of income (Gaji, Freelance, Usaha) scoped to household | `household_id`, `name`, `description`, `is_active` | `income_sources` record | Unique violation on `(household_id, name)` when active | PRD §6.6, §9 |
| 6 | Master Data | Income Categories | User-defined categories classifying income transactions | `household_id`, `name`, `icon`, `color` | `income_categories` record | Unique violation on `(household_id, name)` when active | PRD §9 |
| 7 | Master Data | Expense Categories | User-defined categories classifying expense transactions with optional budget limit | `household_id`, `name`, `icon`, `color`, `budget_limit` | `expense_categories` record | Unique violation on `(household_id, name)` when active | PRD §9 |
| 8 | Finance | Incomes Ledger | Records cash inflows linked to source, optional category, and creator | `household_id`, `source_id`, `nominal`, `date`, `notes` | `incomes` record | CHECK violation if `nominal <= 0`; FK error if source missing | PRD §6.3, §9 |
| 9 | Finance | Expenses Ledger | Records cash outflows linked to category, optional purchase link, and payment method | `household_id`, `category_id`, `nominal`, `date`, `payment_method` | `expenses` record | CHECK violation if `nominal <= 0`; FK error if category missing | PRD §6.4, §9 |
| 10 | Inventory | Master Items Catalog | Tracks physical stock items, location, and minimum warning threshold | `household_id`, `name`, `unit`, `quantity_on_hand`, `low_stock_threshold` | `items` record | CHECK violation if `quantity_on_hand < 0`; Unique violation on name | PRD §6.5, §9 |
| 11 | Inventory | Immutable Stock Movements | Audit ledger recording every stock increment, decrement, or adjustment | `item_id`, `quantity_delta`, `resulting_quantity`, `reason` | `stock_movements` record | CHECK violation if `delta == 0` or `resulting < 0` | PRD §6.5, §9 |
| 12 | Purchases | Purchase Orders | Tracks procurement orders linking supplier/vendor, total, status, and idempotency | `household_id`, `expense_category_id`, `date`, `vendor`, `status` | `purchases` record | Unique violation on `idempotency_key` | PRD §6.6, §9 |
| 13 | Purchases | Purchase Line Items | Detail items in a purchase order with price, quantity, and optional catalog item link | `purchase_id`, `item_id`, `item_name`, `quantity`, `unit_price`, `subtotal` | `purchase_items` record | CHECK violation if `quantity <= 0` or `unit_price < 0` | PRD §6.6, §9 |
| 14 | Debts/Receivables | Debt & Receivable Ledger | Tracks obligations (`payable`) and claims (`receivable`) with balance & due dates | `household_id`, `type`, `party_name`, `principal_amount`, `due_date` | `debts_receivables` record | CHECK violation if `principal <= 0` or `balance < 0` | PRD §6.8, §9 |
| 15 | Debts/Receivables | Repayment Transactions | Records installment or full payments towards debts/receivables | `debt_receivable_id`, `amount`, `payment_date`, `payment_method` | `debt_receivable_payments` record | CHECK violation if `amount <= 0` or exceeds remaining balance | PRD §6.8, §9 |
| 16 | Notification | Channel Preferences | Configures delivery channels (Email, WhatsApp) per user in household | `household_id`, `user_id`, `email_enabled`, `whatsapp_number` | `notification_preferences` record | Unique violation on `(household_id, user_id)` | PRD §6.10, §9 |
| 17 | Notification | Outbox Event Queue | Transactional outbox queuing low stock alerts for asynchronous worker dispatch | `household_id`, `item_id`, `event_type`, `payload`, `channel`, `status` | `notification_events` record | Polling index supports `SKIP LOCKED` query | PRD §6.10, §9 |
| 18 | Audit | Mutation Audit Trail | System-wide log tracking entity mutations, state diffs, user agent, and actor IP | `household_id`, `user_id`, `entity_type`, `entity_id`, `action`, `changes` | `audit_logs` record | FK cascade on household deletion | PRD §4, §9 |

---

## 3. Edge Cases & Database Integrity Rules

| # | Feature | Input / Condition | Observed / Required Behavior |
|---|---------|-------------------|------------------------------|
| 1 | Master Data Uniqueness | Add category "Makanan" after archiving a previous "Makanan" | Allowed because unique index is partial: `WHERE deleted_at IS NULL`. |
| 2 | Master Data Uniqueness | Add duplicate active category "Makanan" in same household | Rejected by PostgreSQL partial unique index with code `23505` (`unique_violation`). |
| 3 | Master Data Isolation | Household B adds "Makanan" when Household A already has "Makanan" | Allowed because unique index is composite `(household_id, name)`. |
| 4 | Monetary Precision | Create income with decimal fraction (e.g. `15000.75`) | Stored strictly as integer Rupiah `15000` or rejected by DTO validation before Drizzle query. |
| 5 | Non-negative Stock | Stock movement reduces item quantity from 1 to -1 | Rejected by check constraint `chk_items_quantity_on_hand_non_negative`. |
| 6 | Zero Stock Delta | Stock movement inserted with `quantity_delta = 0` | Rejected by check constraint `chk_stock_movements_delta_non_zero`. |
| 7 | Overpayment of Debt | Payment amount exceeds `remaining_balance` | Rejected by service layer check and DB check constraint `chk_debt_remaining_balance_non_negative`. |
| 8 | Cascade on Household Delete | Deleting household record | Cascades and removes all child members, categories, items, transactions, and audit records cleanly. |
| 9 | Protect Master Data Delete | Deleting category with active expenses attached | Blocked by `ON DELETE RESTRICT` foreign key constraint to maintain ledger integrity. |
| 10 | Purchase Item Item Deletion | Master item deleted/purged while referenced in `purchase_items` | `ON DELETE SET NULL` preserves historical purchase record and item name string. |
| 11 | Purchase Complete Replay | Repeat purchase completion with same `idempotency_key` | DB unique constraint on `idempotency_key` prevents double expense insertion. |
| 12 | Outbox Worker Concurrency | Multiple workers polling pending notification events | Polling index `(status, next_retry_at, created_at)` enables `SELECT ... FOR UPDATE SKIP LOCKED`. |

---

## 4. PostgreSQL Enums (`pgEnum`)

All enums reside in their respective domain schema files and are re-exported from `packages/db/src/schema/index.ts`:

```typescript
// 1. Household role enum (in household.ts)
export const householdRoleEnum = pgEnum('household_role', ['owner', 'member']);

// 2. Payment method enum (in finance.ts)
export const paymentMethodEnum = pgEnum('payment_method', ['cash', 'transfer', 'ewallet', 'other']);

// 3. Stock movement reason enum (in inventory.ts)
export const stockMovementReasonEnum = pgEnum('stock_movement_reason', [
  'purchase',
  'manual_correction',
  'waste',
  'initial',
  'reversal',
]);

// 4. Purchase status enum (in purchase.ts)
export const purchaseStatusEnum = pgEnum('purchase_status', ['draft', 'completed', 'cancelled']);

// 5. Debt type enum (in debt.ts)
export const debtTypeEnum = pgEnum('debt_type', ['payable', 'receivable']);

// 6. Debt status enum (in debt.ts)
export const debtStatusEnum = pgEnum('debt_status', [
  'open',
  'partially_paid',
  'settled',
  'overdue',
  'cancelled',
]);

// 7. Notification channel enum (in notification.ts)
export const notificationChannelEnum = pgEnum('notification_channel', ['EMAIL', 'WHATSAPP']);

// 8. Notification status enum (in notification.ts)
export const notificationStatusEnum = pgEnum('notification_status', [
  'PENDING',
  'PROCESSING',
  'SENT',
  'FAILED',
  'CANCELLED',
]);
```

---

## 5. Domain Files & Table Specifications

The 18 tables are partitioned cleanly across 8 domain files in `packages/db/src/schema/`:

```text
packages/db/src/schema/
├── shared.ts        # Common columns (audit, soft delete, idr helper)
├── auth.ts          # users, refresh_sessions
├── household.ts     # households, household_members
├── finance.ts       # income_sources, income_categories, expense_categories, incomes, expenses
├── inventory.ts     # items, stock_movements
├── purchase.ts      # purchases, purchase_items
├── debt.ts          # debts_receivables, debt_receivable_payments
├── notification.ts  # notification_preferences, notification_events
├── audit.ts         # audit_logs
├── relations.ts     # Complete Drizzle relational queries mapping
└── index.ts         # Master barrel re-export
```

---

### 5.1 Shared Column Helpers (`shared.ts`)

```typescript
import { timestamp, uuid, numeric } from 'drizzle-orm/pg-core';

/**
 * Standard audit columns present on all primary business records
 */
export const auditColumns = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
};

/**
 * Soft delete column helper for master data entities
 */
export const softDeleteColumn = {
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
};

/**
 * Monetary IDR column helper (numeric 14, 0)
 */
export const idrNumeric = (name: string) => numeric(name, { precision: 14, scale: 0 });
```

---

### 5.2 Domain 1: `auth.ts` (Tables: `users`, `refresh_sessions`)

#### Table: `users`
- **Purpose:** Stores registered user accounts with Argon2id hashed credentials.
- **Columns:**
  - `id`: `uuid`, PRIMARY KEY, `defaultRandom()`
  - `email`: `varchar(255)`, NOT NULL, UNIQUE
  - `password_hash`: `varchar(255)`, NOT NULL
  - `full_name`: `varchar(100)`, NOT NULL
  - `phone_number`: `varchar(30)`, NULLABLE
  - `is_active`: `boolean`, NOT NULL, DEFAULT `true`
  - `created_at`: `timestamptz`, NOT NULL, DEFAULT `now()`
  - `updated_at`: `timestamptz`, NOT NULL, DEFAULT `now()`
- **Indexes:**
  - `users_email_idx` ON (`email`) UNIQUE
  - `users_is_active_idx` ON (`is_active`)

#### Table: `refresh_sessions`
- **Purpose:** Manages refresh tokens, rotation lineages (`family_id`), and token replay revocation.
- **Columns:**
  - `id`: `uuid`, PRIMARY KEY, `defaultRandom()`
  - `user_id`: `uuid`, NOT NULL, REFERENCES `users(id)` ON DELETE CASCADE
  - `token_hash`: `varchar(255)`, NOT NULL, UNIQUE (SHA-256 of token)
  - `family_id`: `uuid`, NOT NULL (identifies token rotation lineage)
  - `is_revoked`: `boolean`, NOT NULL, DEFAULT `false`
  - `expires_at`: `timestamptz`, NOT NULL
  - `user_agent`: `varchar(500)`, NULLABLE
  - `ip_address`: `varchar(45)`, NULLABLE
  - `created_at`: `timestamptz`, NOT NULL, DEFAULT `now()`
- **Indexes:**
  - `refresh_sessions_user_id_idx` ON (`user_id`)
  - `refresh_sessions_token_hash_idx` ON (`token_hash`) UNIQUE
  - `refresh_sessions_family_id_idx` ON (`family_id`)

#### Code Blueprint: `packages/db/src/schema/auth.ts`
```typescript
import { pgTable, uuid, varchar, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    fullName: varchar('full_name', { length: 100 }).notNull(),
    phoneNumber: varchar('phone_number', { length: 30 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
    isActiveIdx: index('users_is_active_idx').on(table.isActive),
  })
);

export const refreshSessions = pgTable(
  'refresh_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
    familyId: uuid('family_id').notNull(),
    isRevoked: boolean('is_revoked').notNull().default(false),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    userAgent: varchar('user_agent', { length: 500 }),
    ipAddress: varchar('ip_address', { length: 45 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('refresh_sessions_user_id_idx').on(table.userId),
    tokenHashIdx: uniqueIndex('refresh_sessions_token_hash_idx').on(table.tokenHash),
    familyIdIdx: index('refresh_sessions_family_id_idx').on(table.familyId),
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type RefreshSession = typeof refreshSessions.$inferSelect;
export type NewRefreshSession = typeof refreshSessions.$inferInsert;
```

---

### 5.3 Domain 2: `household.ts` (Tables: `households`, `household_members`)

#### Table: `households`
- **Purpose:** Represents the tenant boundary for two household partners.
- **Columns:**
  - `id`: `uuid`, PRIMARY KEY, `defaultRandom()`
  - `name`: `varchar(100)`, NOT NULL
  - `currency`: `varchar(3)`, NOT NULL, DEFAULT `'IDR'`
  - `timezone`: `varchar(50)`, NOT NULL, DEFAULT `'Asia/Jakarta'`
  - `created_at`: `timestamptz`, NOT NULL, DEFAULT `now()`
  - `updated_at`: `timestamptz`, NOT NULL, DEFAULT `now()`

#### Table: `household_members`
- **Purpose:** Associates users with households and assigns permissions (`owner` vs `member`).
- **Columns:**
  - `id`: `uuid`, PRIMARY KEY, `defaultRandom()`
  - `household_id`: `uuid`, NOT NULL, REFERENCES `households(id)` ON DELETE CASCADE
  - `user_id`: `uuid`, NOT NULL, REFERENCES `users(id)` ON DELETE CASCADE
  - `role`: `household_role`, NOT NULL, DEFAULT `'member'`
  - `joined_at`: `timestamptz`, NOT NULL, DEFAULT `now()`
- **Indexes:**
  - `household_members_household_user_idx` ON (`household_id`, `user_id`) UNIQUE
  - `household_members_user_id_idx` ON (`user_id`)

#### Code Blueprint: `packages/db/src/schema/household.ts`
```typescript
import { pgTable, uuid, varchar, timestamp, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './auth.js';

export const householdRoleEnum = pgEnum('household_role', ['owner', 'member']);

export const households = pgTable('households', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('IDR'),
  timezone: varchar('timezone', { length: 50 }).notNull().default('Asia/Jakarta'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const householdMembers = pgTable(
  'household_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: householdRoleEnum('role').notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    householdUserIdx: uniqueIndex('household_members_household_user_idx').on(table.householdId, table.userId),
    userIdIdx: index('household_members_user_id_idx').on(table.userId),
    householdIdIdx: index('household_members_household_id_idx').on(table.householdId),
  })
);

export type Household = typeof households.$inferSelect;
export type NewHousehold = typeof households.$inferInsert;
export type HouseholdMember = typeof householdMembers.$inferSelect;
export type NewHouseholdMember = typeof householdMembers.$inferInsert;
```

---

### 5.4 Domain 3: `finance.ts` (Tables: `income_sources`, `income_categories`, `expense_categories`, `incomes`, `expenses`)

#### Tables Overview:
- `income_sources`: Master data for income origin (e.g. Gaji, Usaha, Bonus).
- `income_categories`: Master data for income categorization.
- `expense_categories`: Master data for expense budgeting with `budget_limit`.
- `incomes`: Ledger of incoming cash flow. Check constraint: `nominal > 0`.
- `expenses`: Ledger of outgoing cash flow. Check constraint: `nominal > 0`. References `purchases.id` nullable.

#### Code Blueprint: `packages/db/src/schema/finance.ts`
```typescript
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  date,
  numeric,
  pgEnum,
  index,
  uniqueIndex,
  check,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './auth.js';
import { households } from './household.js';
import { purchases } from './purchase.js';

export const paymentMethodEnum = pgEnum('payment_method', ['cash', 'transfer', 'ewallet', 'other']);

// Table 5: income_sources
export const incomeSources = pgTable(
  'income_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => ({
    householdIdx: index('income_sources_household_idx').on(table.householdId),
    uniqueNamePerHousehold: uniqueIndex('income_sources_household_name_idx')
      .on(table.householdId, table.name)
      .where(sql`deleted_at IS NULL`),
  })
);

// Table 6: income_categories
export const incomeCategories = pgTable(
  'income_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    icon: varchar('icon', { length: 50 }),
    color: varchar('color', { length: 20 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => ({
    householdIdx: index('income_categories_household_idx').on(table.householdId),
    uniqueNamePerHousehold: uniqueIndex('income_categories_household_name_idx')
      .on(table.householdId, table.name)
      .where(sql`deleted_at IS NULL`),
  })
);

// Table 7: expense_categories
export const expenseCategories = pgTable(
  'expense_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    icon: varchar('icon', { length: 50 }),
    color: varchar('color', { length: 20 }),
    budgetLimit: numeric('budget_limit', { precision: 14, scale: 0 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => ({
    householdIdx: index('expense_categories_household_idx').on(table.householdId),
    uniqueNamePerHousehold: uniqueIndex('expense_categories_household_name_idx')
      .on(table.householdId, table.name)
      .where(sql`deleted_at IS NULL`),
  })
);

// Table 8: incomes
export const incomes = pgTable(
  'incomes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => incomeSources.id, { onDelete: 'restrict' }),
    categoryId: uuid('category_id').references(() => incomeCategories.id, { onDelete: 'set null' }),
    date: date('date', { mode: 'string' }).notNull(),
    nominal: numeric('nominal', { precision: 14, scale: 0 }).notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => ({
    nominalPositiveChk: check('chk_incomes_nominal_positive', sql`${table.nominal} > 0`),
    householdDateIdx: index('incomes_household_date_idx').on(table.householdId, table.date),
    sourceIdIdx: index('incomes_source_id_idx').on(table.sourceId),
    categoryIdIdx: index('incomes_category_id_idx').on(table.categoryId),
  })
);

// Table 9: expenses
export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => expenseCategories.id, { onDelete: 'restrict' }),
    purchaseId: uuid('purchase_id').references((): AnyPgColumn => purchases.id, { onDelete: 'set null' }),
    date: date('date', { mode: 'string' }).notNull(),
    nominal: numeric('nominal', { precision: 14, scale: 0 }).notNull(),
    paymentMethod: paymentMethodEnum('payment_method').notNull().default('cash'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => ({
    nominalPositiveChk: check('chk_expenses_nominal_positive', sql`${table.nominal} > 0`),
    householdDateIdx: index('expenses_household_date_idx').on(table.householdId, table.date),
    categoryIdIdx: index('expenses_category_id_idx').on(table.categoryId),
    purchaseIdIdx: index('expenses_purchase_id_idx').on(table.purchaseId),
  })
);

export type IncomeSource = typeof incomeSources.$inferSelect;
export type NewIncomeSource = typeof incomeSources.$inferInsert;
export type IncomeCategory = typeof incomeCategories.$inferSelect;
export type NewIncomeCategory = typeof incomeCategories.$inferInsert;
export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type NewExpenseCategory = typeof expenseCategories.$inferInsert;
export type Income = typeof incomes.$inferSelect;
export type NewIncome = typeof incomes.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
```

---

### 5.5 Domain 4: `inventory.ts` (Tables: `items`, `stock_movements`)

#### Tables Overview:
- `items`: Physical goods catalog. Check constraint: `quantity_on_hand >= 0` and `low_stock_threshold >= 0`.
- `stock_movements`: Immutable transaction log for every stock modification. Check constraints: `quantity_delta != 0` and `resulting_quantity >= 0`.

#### Code Blueprint: `packages/db/src/schema/inventory.ts`
```typescript
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './auth.js';
import { households } from './household.js';

export const stockMovementReasonEnum = pgEnum('stock_movement_reason', [
  'purchase',
  'manual_correction',
  'waste',
  'initial',
  'reversal',
]);

// Table 10: items
export const items = pgTable(
  'items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 150 }).notNull(),
    category: varchar('category', { length: 100 }),
    unit: varchar('unit', { length: 30 }).notNull(),
    quantityOnHand: integer('quantity_on_hand').notNull().default(0),
    lowStockThreshold: integer('low_stock_threshold').notNull().default(0),
    location: varchar('location', { length: 100 }),
    notes: text('notes'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => ({
    stockNonNegativeChk: check('chk_items_quantity_on_hand_non_negative', sql`${table.quantityOnHand} >= 0`),
    thresholdNonNegativeChk: check('chk_items_low_stock_threshold_non_negative', sql`${table.lowStockThreshold} >= 0`),
    householdIdx: index('items_household_idx').on(table.householdId),
    uniqueNamePerHousehold: uniqueIndex('items_household_name_idx')
      .on(table.householdId, table.name)
      .where(sql`deleted_at IS NULL`),
  })
);

// Table 11: stock_movements
export const stockMovements = pgTable(
  'stock_movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    quantityDelta: integer('quantity_delta').notNull(),
    resultingQuantity: integer('resulting_quantity').notNull(),
    reason: stockMovementReasonEnum('reason').notNull(),
    notes: text('notes'),
    referenceId: uuid('reference_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
  },
  (table) => ({
    deltaNonZeroChk: check('chk_stock_movements_delta_non_zero', sql`${table.quantityDelta} != 0`),
    resultingNonNegativeChk: check('chk_stock_movements_resulting_non_negative', sql`${table.resultingQuantity} >= 0`),
    itemCreatedIdx: index('stock_movements_item_created_idx').on(table.itemId, table.createdAt),
    householdIdx: index('stock_movements_household_idx').on(table.householdId),
    referenceIdIdx: index('stock_movements_reference_id_idx').on(table.referenceId),
  })
);

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type StockMovement = typeof stockMovements.$inferSelect;
export type NewStockMovement = typeof stockMovements.$inferInsert;
```

---

### 5.6 Domain 5: `purchase.ts` (Tables: `purchases`, `purchase_items`)

#### Tables Overview:
- `purchases`: Purchase order header. Check constraint: `total_amount >= 0`. Includes `idempotency_key` unique index.
- `purchase_items`: Line items of a purchase. Check constraints: `quantity > 0`, `unit_price >= 0`, `subtotal >= 0`.

#### Code Blueprint: `packages/db/src/schema/purchase.ts`
```typescript
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  timestamp,
  date,
  pgEnum,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './auth.js';
import { households } from './household.js';
import { expenseCategories, paymentMethodEnum } from './finance.js';
import { items } from './inventory.js';

export const purchaseStatusEnum = pgEnum('purchase_status', ['draft', 'completed', 'cancelled']);

// Table 12: purchases
export const purchases = pgTable(
  'purchases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    expenseCategoryId: uuid('expense_category_id')
      .notNull()
      .references(() => expenseCategories.id, { onDelete: 'restrict' }),
    date: date('date', { mode: 'string' }).notNull(),
    totalAmount: numeric('total_amount', { precision: 14, scale: 0 }).notNull().default('0'),
    vendor: varchar('vendor', { length: 150 }),
    paymentMethod: paymentMethodEnum('payment_method').notNull().default('cash'),
    status: purchaseStatusEnum('status').notNull().default('draft'),
    idempotencyKey: varchar('idempotency_key', { length: 100 }),
    notes: text('notes'),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    totalNonNegativeChk: check('chk_purchases_total_non_negative', sql`${table.totalAmount} >= 0`),
    householdDateIdx: index('purchases_household_date_idx').on(table.householdId, table.date),
    statusIdx: index('purchases_status_idx').on(table.status),
    expenseCategoryIdx: index('purchases_expense_category_idx').on(table.expenseCategoryId),
    idempotencyKeyIdx: uniqueIndex('purchases_idempotency_key_idx').on(table.idempotencyKey),
  })
);

// Table 13: purchase_items
export const purchaseItems = pgTable(
  'purchase_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    purchaseId: uuid('purchase_id')
      .notNull()
      .references(() => purchases.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id').references(() => items.id, { onDelete: 'set null' }),
    itemName: varchar('item_name', { length: 150 }).notNull(),
    quantity: integer('quantity').notNull(),
    unitPrice: numeric('unit_price', { precision: 14, scale: 0 }).notNull(),
    subtotal: numeric('subtotal', { precision: 14, scale: 0 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    quantityPositiveChk: check('chk_purchase_items_quantity_positive', sql`${table.quantity} > 0`),
    unitPriceNonNegativeChk: check('chk_purchase_items_unit_price_non_negative', sql`${table.unitPrice} >= 0`),
    subtotalNonNegativeChk: check('chk_purchase_items_subtotal_non_negative', sql`${table.subtotal} >= 0`),
    purchaseIdIdx: index('purchase_items_purchase_id_idx').on(table.purchaseId),
    itemIdIdx: index('purchase_items_item_id_idx').on(table.itemId),
  })
);

export type Purchase = typeof purchases.$inferSelect;
export type NewPurchase = typeof purchases.$inferInsert;
export type PurchaseItem = typeof purchaseItems.$inferSelect;
export type NewPurchaseItem = typeof purchaseItems.$inferInsert;
```

---

### 5.7 Domain 6: `debt.ts` (Tables: `debts_receivables`, `debt_receivable_payments`)

#### Tables Overview:
- `debts_receivables`: Tracks payable obligations and receivable claims. Check constraints: `principal_amount > 0` and `remaining_balance >= 0`.
- `debt_receivable_payments`: Tracks payment transactions against debt/receivable records. Check constraint: `amount > 0`.

#### Code Blueprint: `packages/db/src/schema/debt.ts`
```typescript
import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  timestamp,
  date,
  pgEnum,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './auth.js';
import { households } from './household.js';
import { paymentMethodEnum } from './finance.js';

export const debtTypeEnum = pgEnum('debt_type', ['payable', 'receivable']);
export const debtStatusEnum = pgEnum('debt_status', ['open', 'partially_paid', 'settled', 'overdue', 'cancelled']);

// Table 14: debts_receivables
export const debtsReceivables = pgTable(
  'debts_receivables',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    type: debtTypeEnum('type').notNull(),
    partyName: varchar('party_name', { length: 150 }).notNull(),
    description: text('description'),
    principalAmount: numeric('principal_amount', { precision: 14, scale: 0 }).notNull(),
    remainingBalance: numeric('remaining_balance', { precision: 14, scale: 0 }).notNull(),
    dueDate: date('due_date', { mode: 'string' }),
    status: debtStatusEnum('status').notNull().default('open'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => ({
    principalPositiveChk: check('chk_debts_principal_positive', sql`${table.principalAmount} > 0`),
    balanceNonNegativeChk: check('chk_debts_balance_non_negative', sql`${table.remainingBalance} >= 0`),
    householdIdx: index('debts_receivables_household_idx').on(table.householdId),
    dueDateIdx: index('debts_receivables_due_date_idx').on(table.dueDate),
    statusIdx: index('debts_receivables_status_idx').on(table.status),
    householdTypeStatusIdx: index('debts_receivables_household_type_status_idx').on(
      table.householdId,
      table.type,
      table.status
    ),
  })
);

// Table 15: debt_receivable_payments
export const debtReceivablePayments = pgTable(
  'debt_receivable_payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    debtReceivableId: uuid('debt_receivable_id')
      .notNull()
      .references(() => debtsReceivables.id, { onDelete: 'cascade' }),
    amount: numeric('amount', { precision: 14, scale: 0 }).notNull(),
    paymentDate: date('payment_date', { mode: 'string' }).notNull(),
    paymentMethod: paymentMethodEnum('payment_method').notNull().default('transfer'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
  },
  (table) => ({
    amountPositiveChk: check('chk_debt_payments_amount_positive', sql`${table.amount} > 0`),
    debtReceivableIdx: index('debt_payments_debt_receivable_idx').on(table.debtReceivableId),
    paymentDateIdx: index('debt_payments_payment_date_idx').on(table.paymentDate),
  })
);

export type DebtReceivable = typeof debtsReceivables.$inferSelect;
export type NewDebtReceivable = typeof debtsReceivables.$inferInsert;
export type DebtReceivablePayment = typeof debtReceivablePayments.$inferSelect;
export type NewDebtReceivablePayment = typeof debtReceivablePayments.$inferInsert;
```

---

### 5.8 Domain 7: `notification.ts` (Tables: `notification_preferences`, `notification_events`)

#### Tables Overview:
- `notification_preferences`: Channel preferences per household member. Unique on `(household_id, user_id)`.
- `notification_events`: Transactional outbox table for low stock alerts and event dispatching. Polling index `(status, next_retry_at, created_at)`.

#### Code Blueprint: `packages/db/src/schema/notification.ts`
```typescript
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './auth.js';
import { households } from './household.js';
import { items } from './inventory.js';

export const notificationChannelEnum = pgEnum('notification_channel', ['EMAIL', 'WHATSAPP']);
export const notificationStatusEnum = pgEnum('notification_status', [
  'PENDING',
  'PROCESSING',
  'SENT',
  'FAILED',
  'CANCELLED',
]);

// Table 16: notification_preferences
export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    emailEnabled: boolean('email_enabled').notNull().default(true),
    emailAddress: varchar('email_address', { length: 255 }),
    whatsappEnabled: boolean('whatsapp_enabled').notNull().default(false),
    whatsappNumber: varchar('whatsapp_number', { length: 30 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    householdUserIdx: uniqueIndex('notification_preferences_household_user_idx').on(
      table.householdId,
      table.userId
    ),
    userIdIdx: index('notification_preferences_user_id_idx').on(table.userId),
  })
);

// Table 17: notification_events (Transactional Outbox)
export const notificationEvents = pgTable(
  'notification_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id').references(() => items.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 50 }).notNull(),
    channel: notificationChannelEnum('channel').notNull().default('EMAIL'),
    recipient: varchar('recipient', { length: 255 }).notNull(),
    payload: jsonb('payload').notNull(),
    status: notificationStatusEnum('status').notNull().default('PENDING'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(5),
    lastError: text('last_error'),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true, mode: 'date' }),
    sentAt: timestamp('sent_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    outboxPollingIdx: index('notification_events_outbox_polling_idx').on(
      table.status,
      table.nextRetryAt,
      table.createdAt
    ),
    householdIdx: index('notification_events_household_idx').on(table.householdId),
    itemIdIdx: index('notification_events_item_id_idx').on(table.itemId),
  })
);

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert;
export type NotificationEvent = typeof notificationEvents.$inferSelect;
export type NewNotificationEvent = typeof notificationEvents.$inferInsert;
```

---

### 5.9 Domain 8: `audit.ts` (Table: `audit_logs`)

#### Table Overview:
- `audit_logs`: System-wide audit log recording sensitive transactions, manual stock overrides, and entity state transitions.

#### Code Blueprint: `packages/db/src/schema/audit.ts`
```typescript
import { pgTable, uuid, varchar, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './auth.js';
import { households } from './household.js';

// Table 18: audit_logs
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: uuid('entity_id').notNull(),
    action: varchar('action', { length: 50 }).notNull(),
    changes: jsonb('changes'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: varchar('user_agent', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    householdEntityIdx: index('audit_logs_household_entity_idx').on(
      table.householdId,
      table.entityType,
      table.entityId
    ),
    householdCreatedIdx: index('audit_logs_household_created_idx').on(table.householdId, table.createdAt),
    createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
  })
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
```

---

### 5.10 Relational Definitions (`relations.ts`)

Centralizing all Drizzle ORM relations in a single module prevents circular import issues and enables powerful type-safe nested queries (e.g. `db.query.purchases.findFirst({ with: { items: true, expenseCategory: true } })`).

#### Code Blueprint: `packages/db/src/schema/relations.ts`
```typescript
import { relations } from 'drizzle-orm';
import { users, refreshSessions } from './auth.js';
import { households, householdMembers } from './household.js';
import { incomeSources, incomeCategories, expenseCategories, incomes, expenses } from './finance.js';
import { items, stockMovements } from './inventory.js';
import { purchases, purchaseItems } from './purchase.js';
import { debtsReceivables, debtReceivablePayments } from './debt.js';
import { notificationPreferences, notificationEvents } from './notification.js';
import { auditLogs } from './audit.js';

// Users Relations
export const usersRelations = relations(users, ({ many }) => ({
  householdMembers: many(householdMembers),
  refreshSessions: many(refreshSessions),
  notificationPreferences: many(notificationPreferences),
}));

// Refresh Sessions Relations
export const refreshSessionsRelations = relations(refreshSessions, ({ one }) => ({
  user: one(users, {
    fields: [refreshSessions.userId],
    references: [users.id],
  }),
}));

// Households Relations
export const householdsRelations = relations(households, ({ many }) => ({
  members: many(householdMembers),
  incomeSources: many(incomeSources),
  incomeCategories: many(incomeCategories),
  expenseCategories: many(expenseCategories),
  incomes: many(incomes),
  expenses: many(expenses),
  items: many(items),
  stockMovements: many(stockMovements),
  purchases: many(purchases),
  debtsReceivables: many(debtsReceivables),
  notificationPreferences: many(notificationPreferences),
  notificationEvents: many(notificationEvents),
  auditLogs: many(auditLogs),
}));

// Household Members Relations
export const householdMembersRelations = relations(householdMembers, ({ one }) => ({
  household: one(households, {
    fields: [householdMembers.householdId],
    references: [households.id],
  }),
  user: one(users, {
    fields: [householdMembers.userId],
    references: [users.id],
  }),
}));

// Income Sources Relations
export const incomeSourcesRelations = relations(incomeSources, ({ one, many }) => ({
  household: one(households, {
    fields: [incomeSources.householdId],
    references: [households.id],
  }),
  incomes: many(incomes),
  creator: one(users, {
    fields: [incomeSources.createdBy],
    references: [users.id],
  }),
}));

// Income Categories Relations
export const incomeCategoriesRelations = relations(incomeCategories, ({ one, many }) => ({
  household: one(households, {
    fields: [incomeCategories.householdId],
    references: [households.id],
  }),
  incomes: many(incomes),
}));

// Expense Categories Relations
export const expenseCategoriesRelations = relations(expenseCategories, ({ one, many }) => ({
  household: one(households, {
    fields: [expenseCategories.householdId],
    references: [households.id],
  }),
  expenses: many(expenses),
  purchases: many(purchases),
}));

// Incomes Relations
export const incomesRelations = relations(incomes, ({ one }) => ({
  household: one(households, {
    fields: [incomes.householdId],
    references: [households.id],
  }),
  source: one(incomeSources, {
    fields: [incomes.sourceId],
    references: [incomeSources.id],
  }),
  category: one(incomeCategories, {
    fields: [incomes.categoryId],
    references: [incomeCategories.id],
  }),
  creator: one(users, {
    fields: [incomes.createdBy],
    references: [users.id],
  }),
}));

// Expenses Relations
export const expensesRelations = relations(expenses, ({ one }) => ({
  household: one(households, {
    fields: [expenses.householdId],
    references: [households.id],
  }),
  category: one(expenseCategories, {
    fields: [expenses.categoryId],
    references: [expenseCategories.id],
  }),
  purchase: one(purchases, {
    fields: [expenses.purchaseId],
    references: [purchases.id],
  }),
  creator: one(users, {
    fields: [expenses.createdBy],
    references: [users.id],
  }),
}));

// Items Relations
export const itemsRelations = relations(items, ({ one, many }) => ({
  household: one(households, {
    fields: [items.householdId],
    references: [households.id],
  }),
  stockMovements: many(stockMovements),
  purchaseItems: many(purchaseItems),
  notificationEvents: many(notificationEvents),
}));

// Stock Movements Relations
export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  household: one(households, {
    fields: [stockMovements.householdId],
    references: [households.id],
  }),
  item: one(items, {
    fields: [stockMovements.itemId],
    references: [items.id],
  }),
  creator: one(users, {
    fields: [stockMovements.createdBy],
    references: [users.id],
  }),
}));

// Purchases Relations
export const purchasesRelations = relations(purchases, ({ one, many }) => ({
  household: one(households, {
    fields: [purchases.householdId],
    references: [households.id],
  }),
  expenseCategory: one(expenseCategories, {
    fields: [purchases.expenseCategoryId],
    references: [expenseCategories.id],
  }),
  items: many(purchaseItems),
  expense: one(expenses, {
    fields: [purchases.id],
    references: [expenses.purchaseId],
  }),
  creator: one(users, {
    fields: [purchases.createdBy],
    references: [users.id],
  }),
}));

// Purchase Items Relations
export const purchaseItemsRelations = relations(purchaseItems, ({ one }) => ({
  purchase: one(purchases, {
    fields: [purchaseItems.purchaseId],
    references: [purchases.id],
  }),
  item: one(items, {
    fields: [purchaseItems.itemId],
    references: [items.id],
  }),
}));

// Debts / Receivables Relations
export const debtsReceivablesRelations = relations(debtsReceivables, ({ one, many }) => ({
  household: one(households, {
    fields: [debtsReceivables.householdId],
    references: [households.id],
  }),
  payments: many(debtReceivablePayments),
  creator: one(users, {
    fields: [debtsReceivables.createdBy],
    references: [users.id],
  }),
}));

// Debt Payments Relations
export const debtReceivablePaymentsRelations = relations(debtReceivablePayments, ({ one }) => ({
  debtReceivable: one(debtsReceivables, {
    fields: [debtReceivablePayments.debtReceivableId],
    references: [debtsReceivables.id],
  }),
  creator: one(users, {
    fields: [debtReceivablePayments.createdBy],
    references: [users.id],
  }),
}));

// Notification Preferences Relations
export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  household: one(households, {
    fields: [notificationPreferences.householdId],
    references: [households.id],
  }),
  user: one(users, {
    fields: [notificationPreferences.userId],
    references: [users.id],
  }),
}));

// Notification Events Relations
export const notificationEventsRelations = relations(notificationEvents, ({ one }) => ({
  household: one(households, {
    fields: [notificationEvents.householdId],
    references: [households.id],
  }),
  item: one(items, {
    fields: [notificationEvents.itemId],
    references: [items.id],
  }),
}));

// Audit Logs Relations
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  household: one(households, {
    fields: [auditLogs.householdId],
    references: [households.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));
```

---

### 5.11 Master Barrel Export (`index.ts`)

```typescript
// packages/db/src/schema/index.ts
export * from './shared.js';
export * from './auth.js';
export * from './household.js';
export * from './finance.js';
export * from './inventory.js';
export * from './purchase.js';
export * from './debt.js';
export * from './notification.js';
export * from './audit.js';
export * from './relations.js';
```

And updating `packages/db/src/index.ts` to re-export the entire schema:
```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export * from './schema/index.js';

export interface DatabaseConfig {
  connectionString?: string;
  maxConnections?: number;
}

export function createDatabaseClient(config: DatabaseConfig = {}) {
  const connectionString =
    config.connectionString ||
    process.env.DATABASE_URL ||
    'postgresql://rumahkita:rumahkita_dev_password@localhost:5432/rumahkita';

  const queryClient = postgres(connectionString, {
    max: config.maxConnections || 10,
  });

  const db = drizzle(queryClient, { schema });

  return {
    db,
    queryClient,
  };
}

export type DbClient = ReturnType<typeof createDatabaseClient>['db'];
```

---

## 6. Drizzle Kit Configuration (`packages/db/drizzle.config.ts`)

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://rumahkita:rumahkita_dev_password@localhost:5432/rumahkita',
  },
  verbose: true,
  strict: true,
});
```

`package.json` scripts required in `packages/db`:
```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:seed": "tsx src/seed.ts"
  }
}
```

---

## 7. Database Seeder Blueprint (`packages/db/src/seed.ts`)

The database seeder satisfies all initial E2E tests and developer onboarding requirements:

1. **Households:**
   - Primary: `Keluarga Budi & Ani` (currency: `IDR`, timezone: `Asia/Jakarta`)
   - Secondary (isolation test): `Keluarga Joko Anwar`
2. **Users & Passwords (Argon2id):**
   - Password hash for `Password123!`: `$argon2id$v=19$m=65536,t=3,p=4$...`
   - Budi Santoso (`budi@rumahkita.local`, role: `owner`)
   - Ani Santoso (`ani@rumahkita.local`, role: `member`)
   - Joko Anwar (`joko@rumahkita.local`, role: `owner` in secondary household)
3. **Master Data (Default Categories & Sources for Primary Household):**
   - **Income Sources:**
     - `Gaji Bulanan`
     - `Freelance`
     - `Usaha Sampingan`
     - `Hadiah / THR`
   - **Income Categories:**
     - `Gaji & Upah` (icon: `wallet`, color: `#C8F169`)
     - `Penjualan & Usaha` (icon: `store`, color: `#B9D9FF`)
     - `Investasi & Bunga` (icon: `trending-up`, color: `#FFD700`)
     - `Lainnya` (icon: `tag`, color: `#E0E0E0`)
   - **Expense Categories:**
     - `Belanja Dapur` (icon: `shopping-cart`, color: `#FF8A65`, budgetLimit: 3000000)
     - `Tagihan & Utilitas` (icon: `zap`, color: `#FF6B6B`, budgetLimit: 1500000)
     - `Transportasi` (icon: `car`, color: `#4DABF7`, budgetLimit: 1000000)
     - `Kesehatan` (icon: `activity`, color: `#20C997`, budgetLimit: 500000)
     - `Makanan & Jajanan` (icon: `utensils`, color: `#FFA94D`, budgetLimit: 2000000)
     - `Hiburan & Rekreasi` (icon: `film`, color: `#D9C8FF`, budgetLimit: 1000000)
4. **Sample Inventory Items (with status coverage):**
   - `Beras Rojolele 5kg`: stock 2, threshold 1, unit `pack` (Status: `Aman`)
   - `Minyak Goreng 2L`: stock 3, threshold 2, unit `pouch` (Status: `Aman`)
   - `Gula Pasir 1kg`: stock 4, threshold 2, unit `kg` (Status: `Aman`)
   - `Kopi Bubuk 250g`: stock 1, threshold 2, unit `pack` (Status: `Menipis ⚠`)
   - `Garam Dapur 500g`: stock 0, threshold 1, unit `pack` (Status: `Habis ✕`)
   - `Sabun Cuci Piring 750ml`: stock 3, threshold 1, unit `botol` (Status: `Aman`)
5. **Initial Stock Movements:**
   - Logged with `reason = 'initial'` for all seeded items.
6. **Notification Preferences:**
   - Default preferences for Budi (`email_enabled = true`, `email_address = 'budi@rumahkita.local'`)
   - Default preferences for Ani (`email_enabled = true`, `email_address = 'ani@rumahkita.local'`)

---

## 8. Verification & Migration Workflow

To verify and apply this schema in Milestone 2:

1. **Generate Migration Files:**
   ```bash
   pnpm --filter db db:generate
   ```
   *Expected outcome:* Creates `packages/db/drizzle/0000_initial_schema.sql` containing all 18 table definitions, constraints, indexes, and enums.

2. **Execute Database Migration:**
   ```bash
   pnpm --filter db db:migrate
   ```
   *Expected outcome:* Applies migration SQL against the target PostgreSQL 16 container cleanly with zero errors.

3. **Execute Database Seeding:**
   ```bash
   pnpm --filter db db:seed
   ```
   *Expected outcome:* Seeds test households, users, categories, items, and movements.

4. **Verify TypeScript Compilation:**
   ```bash
   pnpm --filter db typecheck
   pnpm --filter db build
   ```
   *Expected outcome:* Clean compilation with no type errors or unresolved imports.
