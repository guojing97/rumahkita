# RumahKita — Comprehensive Backend & Database Specification Survey Report

**Document Version:** 1.0.0  
**Domain:** Backend API, Database Architecture, Transactional Invariants & Background Worker  
**Date:** 2026-10-27  
**Authoritative Sources:**
- `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/ORIGINAL_REQUEST.md`
- `/Users/mac/Projects/03-Labs/RumahKita/Doc/prd.md`
- `/Users/mac/.gemini/antigravity-cli/brain/13245091-e296-474c-b5a5-5860f1bb35db/plan.md`
- `/Users/mac/Projects/03-Labs/RumahKita/Doc/design.md`

---

## 1. Executive Summary & Architecture Overview

RumahKita is an Indonesian-locale (`id-ID`, `Asia/Jakarta`, IDR) private household finance and inventory management web application tailored for two household members (user and spouse). The system is architected as a Turborepo + pnpm monorepo consisting of:
- `apps/api`: NestJS RESTful API backend serving endpoints under `/api/v1`
- `apps/worker`: Outbox consumer daemon processing asynchronous notification events (Email & WhatsApp)
- `apps/web`: Next.js App Router frontend acting as a BFF proxy to `apps/api`
- `packages/db`: Drizzle ORM schema, migrations, connection pool, and seeder for PostgreSQL
- `packages/contracts`: Shared Zod validation schemas and TypeScript types

### Key Architectural Invariants
1. **Multi-Tenant / Household Isolation:** Every business entity belongs strictly to a `household_id`. Every single query and mutation is guarded by household authorization at the database query level. Cross-tenant access is strictly denied with HTTP 403 Forbidden.
2. **Monetary Precision:** All currency amounts are in Indonesian Rupiah (IDR). Floating point numbers are strictly forbidden. All monetary columns are PostgreSQL `NUMERIC(14,0)` (integer Rupiah up to 99 trillion IDR).
3. **Primary Keys & Identifiers:** All tables use UUID (v7 preferred for B-Tree index locality and chronological sortability) generated via `defaultRandom()`.
4. **Auditability & Soft Deletes:** All master data and transactional entities contain audit columns (`created_at`, `updated_at`, `created_by`, `updated_by`). Master data items (categories, income sources, inventory items) implement soft deletion via nullable `deleted_at`.
5. **ACID Transactions:** Financial transactions and stock movements are never updated loosely. Operations linking purchases to expenses and stock movements execute inside atomic PostgreSQL transactions (`db.transaction(...)`).

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Auth | User Registration / Seed | Setup 2 initial household users with Argon2id hashed passwords | Email, password, full_name | User record (sanitized) | 409 Conflict if email exists; 422 if invalid email/pass | PRD §6.1, Plan 0B/0C |
| 2 | Auth | Login (`POST /auth/login`) | Authenticate user credentials, issue 15m access token & set 7d HttpOnly refresh cookie | `{ email, password }` | `{ accessToken, user, household }` + Set-Cookie `refreshToken` | 401 Unauthorized for invalid creds; 429 Too Many Requests | PRD §6.1, §10, Req R3 |
| 3 | Auth | Token Refresh (`POST /auth/refresh`) | Rotate refresh token, issue new access token and new rotated refresh token cookie | Cookie `refreshToken` | `{ accessToken }` + new Set-Cookie `refreshToken` | 401 Unauthorized if expired; Revoke session family on reuse | PRD §6.1, §11, Req R3 |
| 4 | Auth | Logout (`POST /auth/logout`) | Invalidate current refresh session and clear cookie | Cookie `refreshToken` | `{ success: true }` + Clear-Cookie | 200 OK (idempotent) even if already logged out | PRD §6.1, §10, Req R3 |
| 5 | Auth | Logout All (`POST /auth/logout-all`) | Invalidate all active sessions for current user | Bearer JWT | `{ success: true, terminatedSessionsCount }` | 401 Unauthorized if token invalid | PRD §6.1, §10 |
| 6 | Auth | Forgot Password (`POST /auth/password/forgot`) | Generate single-use password reset token with expiration | `{ email }` | `{ message: "Reset instructions sent if email exists" }` | 200 OK generic response to prevent user enumeration | PRD §6.1, §10 |
| 7 | Auth | Reset Password (`POST /auth/password/reset`) | Reset password using valid one-time token | `{ token, newPassword }` | `{ success: true }` | 400 Bad Request if token expired/invalid; 422 if weak password | PRD §6.1, §10 |
| 8 | Household | Get Household (`GET /household`) | Fetch current authenticated user's household profile | Bearer JWT | `{ id, name, currency, timezone, members: [...] }` | 401 Unauthorized, 404 Not Found if no household linked | PRD §6.1, §10 |
| 9 | Household | Invite Member (`POST /household/invitations`) | Invite spouse/partner to join household via email | `{ email, role }` | `{ invitationId, email, expiresAt }` | 403 if not owner; 409 if already member | PRD §4, §6.1, Plan 4B |
| 10 | Master Data | Income Sources CRUD | Manage income sources (e.g., Gaji, Usaha, Freelance) scoped to household | `{ name, description, is_active }` | IncomeSource record(s) | 409 Conflict if name exists in household; 422 if name empty | PRD §6.6, §10, Plan 1A |
| 11 | Master Data | Income Categories CRUD | Manage income categories scoped to household | `{ name, icon, color }` | IncomeCategory record(s) | 409 Conflict if name duplicate; 422 if invalid | PRD §9, §10, Plan 1A |
| 12 | Master Data | Expense Categories CRUD | Manage expense categories scoped to household | `{ name, icon, color, budget_limit }` | ExpenseCategory record(s) | 409 Conflict if duplicate name; 422 if invalid | PRD §9, §10, Plan 1A |
| 13 | Finance | Incomes CRUD (`/incomes`) | Record, list, update, and soft-delete income transactions | `{ date, nominal, source_id, category_id, notes }` | Income record(s) with source/category relations | 422 if nominal ≤ 0 or missing required source_id | PRD §6.4, §10, Plan 1A |
| 14 | Finance | Expenses CRUD (`/expenses`) | Record, list, update, and soft-cancel expense transactions | `{ date, nominal, category_id, payment_method, notes }` | Expense record(s) with category relation | 422 if nominal ≤ 0 or missing category_id | PRD §6.5, §10, Plan 1B |
| 15 | Inventory | Items CRUD (`/items`) | Manage inventory items with stock threshold and status calculation | `{ name, category, unit, quantity_on_hand, low_stock_threshold, location, notes }` | Item record with computed `stock_status` (`Aman`, `Menipis`, `Habis`) | 422 if quantity < 0 or missing name/unit; 409 if duplicate | PRD §6.3, §10, Plan 2A |
| 16 | Inventory | Manual Stock Adjustment (`POST /items/:id/stock-adjustments`) | Adjust item stock with mandatory reason and log stock movement | `{ delta, reason }` or `{ new_quantity, reason }` | Updated Item + new StockMovement record | 422 if `reason` missing; 422 if resulting stock < 0 | PRD §6.3, §10, Plan 2A |
| 17 | Purchases | Purchase Draft CRUD (`/purchases`) | Create, list, and modify draft purchase order with line items | `{ date, vendor, category_id, payment_method, notes, items: [{ item_id, quantity, unit_price }] }` | Purchase record with items & server-calculated total | 422 if quantities ≤ 0 or unit_price < 0 | PRD §6.7, §10, Plan 2B |
| 18 | Purchases | Complete Purchase (`POST /purchases/:id/complete`) | Atomically finalize purchase: create 1 expense, update stock, log stock movements, trigger low-stock check | Header `Idempotency-Key` | Completed purchase, generated expense_id, updated stock | 400 if already completed/cancelled; 409 on duplicate idempotency key; rollback on failure | PRD §6.7, §10, Req R3 |
| 19 | Purchases | Cancel Purchase (`POST /purchases/:id/cancel`) | Revert completed purchase or cancel draft with recorded audit trail | `{ reason }` | Updated purchase status `cancelled` + reversal stock movements | 400 if already cancelled; 422 if missing reason | PRD §6.7, §10, Plan 2B |
| 20 | Debts/Receivables | Debt/Receivable CRUD (`/debts-receivables`) | Manage debts (Payable) and receivables (Receivable) with due dates | `{ type, party_name, description, principal_amount, due_date }` | DebtReceivable record with remaining_balance & status | 422 if principal_amount ≤ 0 or invalid type | PRD §6.8, §10, Plan 3A |
| 21 | Debts/Receivables | Record Payment (`POST /debts-receivables/:id/payments`) | Record partial or full payment, deduct remaining balance, transition status | `{ payment_date, amount, payment_method, notes }` | Payment record + updated Debt status (`PartiallyPaid`/`Settled`) | 422 if amount ≤ 0 or amount > remaining_balance | PRD §6.8, §10, Plan 3A |
| 22 | Dashboard | Dashboard Summary (`GET /dashboard`) | Aggregated financial metrics, open debts, low stock items, recent activities | Query `?period=this_month\|last_month\|this_year\|custom&startDate=&endDate=` | Aggregated metrics object (income, expense, net, debts, lowStock) | 400 Bad Request if invalid date format | PRD §6.2, §10, Plan 1C |
| 23 | Reports | Monthly Report (`GET /reports/monthly`) | Aggregated monthly figures: category breakdown, source breakdown, cash flow | Query `?year=2026&month=10` | Monthly breakdown report JSON | 400 Bad Request for invalid year/month | PRD §6.9, §10, Plan 1C |
| 24 | Reports | Yearly Report (`GET /reports/yearly`) | Year-by-year 12-month trend matrix preserving zero-value months | Query `?year=2026` | Yearly 12-month array with monthly totals | 400 Bad Request for invalid year | PRD §6.9, §10, Plan 1C |
| 25 | Reports | CSV Export (`GET /reports/export/csv`) | Stream transactions or summary as RFC 4180 compliant CSV | Query `?type=expenses\|incomes\|transactions&startDate=&endDate=` | `text/csv; charset=utf-8` stream with content-disposition | 400 Bad Request if invalid export type | PRD §6.9, §10, Req R3 |
| 26 | Settings | Notification Preferences (`GET\|PUT /settings/notifications`) | Read/update user notification channels (email, whatsapp, enabled) | `{ email_enabled, whatsapp_enabled, whatsapp_number }` | NotificationPreference record | 422 if invalid phone number format | PRD §6.10, §10, Plan 4A |
| 27 | Notifications | Low-Stock Outbox Producer | Insert notification event when item stock drops to or below threshold | Triggered on stock update transition | Created `notification_events` record with payload | Database transaction rollback if insert fails | PRD §6.10, §7.D, Req R5 |
| 28 | Notifications | Worker Outbox Consumer | Daemon process polling `notification_events`, executing SMTP/WA delivery with backoff | Internal polling loop / timer | Dispatched email / WA + updated status `sent` | Log error, increment `attempts`, schedule exponential backoff | PRD §6.10, Req R5, Plan 4A |
| 29 | Audit | Audit Trail Recording | Internal system to log sensitive updates (balance changes, reversals) | Table `audit_logs` | Audit record (entity_type, entity_id, action, diff, actor) | None (silent failure prevention) | PRD §4, §8, §9 |
| 30 | Health & Docs | Swagger & Healthcheck | OpenAPI 3.0 specification and system health check endpoints | `GET /api/v1/health`, `GET /api/docs` | Health JSON / Swagger HTML UI | None (always 200 OK when operational) | PRD §10, §11, Plan 0C |

---

## 3. Edge Cases & Boundary Conditions

| # | Feature | Input / Condition | Observed / Required Behavior |
|---|---------|-------------------|------------------------------|
| 1 | Income Creation | `nominal = 0` or `nominal = -50000` | Rejection with `422 Unprocessable Entity` ("Nominal must be greater than 0"). |
| 2 | Expense Creation | Missing `category_id` | Rejection with `422 Unprocessable Entity` ("Category is required"). |
| 3 | Cross-Tenant Query | User of Household A requests `GET /incomes/:id` belonging to Household B | Rejection with `403 Forbidden` (or `404 Not Found` if query scoping completely masks existence). |
| 4 | Purchase Completion | Purchase total calculated on client as 100,000, but line items sum to 120,000 | Backend ignores client total and recalculates from DB line items (`sum(quantity * unit_price)` = 120,000). |
| 5 | Purchase Completion | Database connection drops or constraint fails while creating stock movements | PostgreSQL transaction rolls back: 0 expenses created, 0 stock movements created, item stock untouched. |
| 6 | Stock Adjustment | Missing `reason` string or whitespace-only | Rejection with `422 Unprocessable Entity` ("Reason is mandatory for stock adjustment"). |
| 7 | Stock Adjustment | Item stock = 2, adjustment delta = -5 | Rejection with `422 Unprocessable Entity` ("Stock cannot be negative. Current stock: 2, Requested reduction: 5"). |
| 8 | Debt Payment | Remaining balance = 300,000, submitted payment = 350,000 | Rejection with `422 Unprocessable Entity` ("Payment amount exceeds remaining balance of 300,000"). |
| 9 | Debt Payment | Remaining balance = 500,000, submitted payment = 500,000 | Payment accepted; remaining balance becomes 0; status automatically transitions to `Settled`. |
| 10 | Debt Overdue | `due_date = yesterday`, `remaining_balance = 100,000`, `status = Open` | Evaluated dynamically or updated to `Overdue` status. |
| 11 | Low Stock Trigger | Item threshold = 5; stock decreases from 8 to 4 | Transition detected (`Aman` -> `Menipis`): exactly 1 `notification_events` record queued. |
| 12 | Low Stock Spam | Item stock is already 4; another adjustment decreases stock to 3 | No new notification event generated (deduplication rule: item is already in low stock state). |
| 13 | Token Rotation | Refresh token used twice (replay / theft simulation) | Immediate revocation of the entire refresh session family; subsequent requests with either token return 401. |
| 14 | Access Token Expiry | Request made with JWT issued 16 minutes prior | Verification fails; API responds with `401 Unauthorized` (`TOKEN_EXPIRED`). |
| 15 | Idempotency Replay | Client retries `POST /purchases/:id/complete` with same `Idempotency-Key` header | API returns original cached response with identical outcome without duplicating expense or stock. |
| 16 | Yearly Report Months | Year selected has transactions only in March and July | Report returns all 12 months (Jan-Dec) with months having 0 income and 0 expense preserving chart alignment. |
| 17 | Master Data Archive | Attempt to delete income source or category currently referenced by existing transactions | Soft archive performed (`deleted_at = NOW()`); past transactions remain intact and queryable. |

---

## 4. Exhaustive Database Specification (All 18 Tables)

All schema definitions reside in `packages/db/src/schema/*.ts`.  
All primary keys use PostgreSQL `UUID` (`defaultRandom()`).  
All monetary values use `NUMERIC(14,0)` (integer Rupiah, no decimal places, never float).  
Audit columns (`created_at`, `updated_at`, `created_by`, `updated_by`) are standardized across all business tables.

### 4.1 Global PostgreSQL Enums (`pgEnum`)
1. `household_role_enum`: `['owner', 'member']`
2. `purchase_status_enum`: `['draft', 'completed', 'cancelled']`
3. `debt_type_enum`: `['payable', 'receivable']`
4. `debt_status_enum`: `['open', 'partially_paid', 'settled', 'overdue', 'cancelled']`
5. `stock_movement_reason_enum`: `['purchase', 'manual_correction', 'waste', 'initial', 'reversal']`
6. `notification_channel_enum`: `['email', 'whatsapp']`
7. `notification_status_enum`: `['pending', 'processing', 'sent', 'failed', 'cancelled']`
8. `payment_method_enum`: `['cash', 'transfer', 'ewallet', 'other']`

---

### 4.2 Entity Definitions Table by Table

#### Table 1: `users` (`auth.ts`)
- **Purpose:** Stores authenticated user accounts.
- **Columns:**
  - `id`: `uuid`, PRIMARY KEY, `defaultRandom()`
  - `email`: `varchar(255)`, NOT NULL, UNIQUE
  - `password_hash`: `varchar(255)`, NOT NULL (Argon2id hash)
  - `full_name`: `varchar(100)`, NOT NULL
  - `phone_number`: `varchar(30)`, NULLABLE
  - `is_active`: `boolean`, NOT NULL, DEFAULT `true`
  - `created_at`: `timestamp with time zone`, NOT NULL, DEFAULT `now()`
  - `updated_at`: `timestamp with time zone`, NOT NULL, DEFAULT `now()`
- **Indexes:** `users_email_idx` ON (`email`) UNIQUE.

#### Table 2: `refresh_sessions` (`auth.ts`)
- **Purpose:** Tracks active refresh token sessions for rotation, session termination, and reuse detection.
- **Columns:**
  - `id`: `uuid`, PRIMARY KEY, `defaultRandom()`
  - `user_id`: `uuid`, NOT NULL, REFERENCES `users(id)` ON DELETE CASCADE
  - `token_hash`: `varchar(255)`, NOT NULL, UNIQUE (SHA-256 hash of refresh token)
  - `family_id`: `uuid`, NOT NULL (groups token rotation lineage)
  - `is_revoked`: `boolean`, NOT NULL, DEFAULT `false`
  - `expires_at`: `timestamp with time zone`, NOT NULL
  - `user_agent`: `varchar(500)`, NULLABLE
  - `ip_address`: `varchar(45)`, NULLABLE
  - `created_at`: `timestamp with time zone`, NOT NULL, DEFAULT `now()`
- **Indexes:** `refresh_sessions_user_id_idx` ON (`user_id`), `refresh_sessions_token_hash_idx` ON (`token_hash`), `refresh_sessions_family_id_idx` ON (`family_id`).

#### Table 3: `households` (`household.ts`)
- **Purpose:** Represents the shared tenant space for the two household members.
- **Columns:**
  - `id`: `uuid`, PRIMARY KEY, `defaultRandom()`
  - `name`: `varchar(100)`, NOT NULL (e.g. "Keluarga Budi & Ani")
  - `currency`: `varchar(3)`, NOT NULL, DEFAULT `'IDR'`
  - `timezone`: `varchar(50)`, NOT NULL, DEFAULT `'Asia/Jakarta'`
  - `created_at`: `timestamp with time zone`, NOT NULL, DEFAULT `now()`
  - `updated_at`: `timestamp with time zone`, NOT NULL, DEFAULT `now()`

#### Table 4: `household_members` (`household.ts`)
- **Purpose:** Links users to households with specific roles.
- **Columns:**
  - `id`: `uuid`, PRIMARY KEY, `defaultRandom()`
  - `household_id`: `uuid`, NOT NULL, REFERENCES `households(id)` ON DELETE CASCADE
  - `user_id`: `uuid`, NOT NULL, REFERENCES `users(id)` ON DELETE CASCADE
  - `role`: `household_role_enum`, NOT NULL, DEFAULT `'member'` (`'owner'` or `'member'`)
  - `joined_at`: `timestamp with time zone`, NOT NULL, DEFAULT `now()`
- **Constraints / Indexes:** UNIQUE (`household_id`, `user_id`); INDEX `household_members_user_id_idx` ON (`user_id`).

#### Table 5: `income_sources` (`finance.ts`)
- **Purpose:** Master data of income sources (Gaji, Usaha, Freelance, Hadiah).
- **Columns:**
  - `id`: `uuid`, PRIMARY KEY, `defaultRandom()`
  - `household_id`: `uuid`, NOT NULL, REFERENCES `households(id)` ON DELETE CASCADE
  - `name`: `varchar(100)`, NOT NULL
  - `description`: `text`, NULLABLE
  - `is_active`: `boolean`, NOT NULL, DEFAULT `true`
  - `created_at`: `timestamp with time zone`, NOT NULL, DEFAULT `now()`
  - `updated_at`: `timestamp with time zone`, NOT NULL, DEFAULT `now()`
  - `created_by`: `uuid`, NULLABLE, REFERENCES `users(id)`
  - `updated_by`: `uuid`, NULLABLE, REFERENCES `users(id)`
  - `deleted_at`: `timestamp with time zone`, NULLABLE (Soft delete)
- **Constraints / Indexes:** UNIQUE (`household_id`, `name`) WHERE `deleted_at IS NULL`; INDEX `income_sources_household_idx` ON (`household_id`).

#### Table 6: `income_categories` (`finance.ts`)
- **Purpose:** Master data classifying types of income.
- **Columns:**
  - `id`: `uuid`, PRIMARY KEY, `defaultRandom()`
  - `household_id`: `uuid`, NOT NULL, REFERENCES `households(id)` ON DELETE CASCADE
  - `name`: `varchar(100)`, NOT NULL
  - `icon`: `varchar(50)`, NULLABLE
  - `color`: `varchar(20)`, NULLABLE
  - `created_at`: `timestamp with time zone`, NOT NULL, DEFAULT `now()`
  - `updated_at`: `timestamp with time zone`, NOT NULL, DEFAULT `now()`
  - `created_by`: `uuid`, NULLABLE, REFERENCES `users(id)`
  - `updated_by`: `uuid`, NULLABLE, REFERENCES `users(id)`
  - `deleted_at`: `timestamp with time zone`, NULLABLE (Soft delete)
- **Constraints / Indexes:** UNIQUE (`household_id`, `name`) WHERE `deleted_at IS NULL`; INDEX `income_categories_household_idx` ON (`household_id`).

#### Table 7: `expense_categories` (`finance.ts`)
- **Purpose:** Master data classifying types of household expenses (Makanan, Tagihan, Transport, Belanja Dapur).
- **Columns:**
  - `id`: `uuid`, PRIMARY KEY, `defaultRandom()`
  - `household_id`: `uuid`, NOT NULL, REFERENCES `households(id)` ON DELETE CASCADE
  - `name`: `varchar(100)`, NOT NULL
  - `icon`: `varchar(50)`, NULLABLE
  - `color`: `varchar(20)`, NULLABLE
  - `budget_limit`: `numeric(14,0)`, NULLABLE
  - `created_at`: `timestamp with time zone`, NOT NULL, DEFAULT `now()`
  - `updated_at`: `timestamp with time zone`, NOT NULL, DEFAULT `now()`
  - `created_by`: `uuid`, NULLABLE, REFERENCES `users(id)`
  - `updated_by`: `uuid`, NULLABLE, REFERENCES `users(id)`
  - `deleted_at`: `timestamp with time zone`, NULLABLE (Soft delete)
- **Constraints / Indexes:** UNIQUE (`household_id`, `name`) WHERE `deleted_at IS NULL`; INDEX `expense_categories_household_idx` ON (`household_id`).

#### Table 8: `incomes` (`finance.ts`)
- **Purpose:** Stores incoming cash flow transactions.
- **Columns:**
  - `id`: `uuid`, PRIMARY KEY, `defaultRandom()`
  - `household_id`: `uuid`, NOT NULL, REFERENCES `households(id)` ON DELETE CASCADE
  - `source_id`: `uuid`, NOT NULL, REFERENCES `income_sources(id)`
  - `category_id`: `uuid`, NULLABLE, REFERENCES `income_categories(id)`
  - `date`: `date`, NOT NULL
  - `nominal`: `numeric(14,0)`, NOT NULL (CONSTRAINT `chk_income_nominal_positive` CHECK `nominal > 0`)
  - `notes`: `text`, NULLABLE
  - `created_at`: `timestamp with time zone`, NOT NULL, DEFAULT `now()`
  - `updated_at`: `timestamp with time zone`, NOT NULL, DEFAULT `now()`
  - `created_by`: `uuid`, NOT NULL, REFERENCES `users(id)`
  - `updated_by`: `uuid`, NULLABLE, REFERENCES `users(id)`
  - `deleted_at`: `timestamp with time zone`, NULLABLE (Soft delete)
- **Indexes:** INDEX `incomes_household_date_idx` ON (`household_id`, `date` DESC), `incomes_source_id_idx` ON (`source_id`), `incomes_category_id_idx` ON (`category_id`).

#### Table 9: `expenses` (`finance.ts`)
- **Purpose:** Stores outgoing cash flow transactions.
- **Columns:**
  - `id`: `uuid`, PRIMARY KEY, `defaultRandom()`
  - `household_id`: `uuid`, NOT NULL, REFERENCES `households(id)` ON DELETE CASCADE
  - `category_id`: `uuid`, NOT NULL, REFERENCES `expense_categories(id)`
  - `purchase_id`: `uuid`, NULLABLE (REFERENCES `purchases(id)` ON DELETE SET NULL)
  - `date`: `date`, NOT NULL
  - `nominal`: `numeric(14,0)`, NOT NULL (CONSTRAINT `chk_expense_nominal_positive` CHECK `nominal > 0`)
  - `payment_method`: `payment_method_enum`, NOT NULL, DEFAULT `'cash'`
  - `notes`: `text`, NULLABLE
  - `created_at`: `timestamp with time zone`, NOT NULL, DEFAULT `now()`
  - `updated_at`: `timestamp with time zone`, NOT NULL, DEFAULT `now()`
  - `created_by`: `uuid`, NOT NULL, REFERENCES `users(id)`
  - `updated_by`: `uuid`, NULLABLE, REFERENCES `users(id)`
  - `deleted_at`: `timestamp with time zone`, NULLABLE (Soft delete)
- **Indexes:** INDEX `expenses_household_date_idx` ON (`household_id`, `date` DESC), `expenses_category_id_idx` ON (`category_id`), `expenses_purchase_id_idx` ON (`purchase_id`).

#### Table 10: `items` (`inventory.ts`)
- **Purpose:** Inventory catalog items with current stock and threshold settings.
- **Columns:**
  - `id`: `uuid`, PRIMARY KEY, `defaultRandom()`
  - `household_id`: `uuid`, NOT NULL, REFERENCES `households(id)` ON DELETE CASCADE
  - `name`: `varchar(150)`, NOT NULL
  - `category`: `varchar(100)`, NULLABLE (e.g. Sembako, Kebersihan, Bumbu)
  - `unit`: `varchar(30)`, NOT NULL (e.g. pcs, kg, liter, botol, pack)
  - `quantity_on_hand`: `integer`, NOT NULL, DEFAULT `0` (CONSTRAINT `chk_items_stock_non_negative` CHECK `quantity_on_hand >= 0`)
  - `low_stock_threshold`: `integer`, NOT NULL, DEFAULT `0`
  - `location`: `varchar(100)`, NULLABLE (e.g. Dapur, Gudang Belakang, Kulkas)
  - `notes`: `text`, NULLABLE
  - `is_active`: `boolean`, NOT NULL, DEFAULT `true`
  - `created_at`: `timestamp with time zone`, NOT NULL, DEFAULT `now()`
  - `updated_at`: `timestamp with time zone`, NOT NULL, DEFAULT `now()`
  - `created_by`: `uuid`, NOT NULL, REFERENCES `users(id)`
  - `updated_by`: `uuid`, NULLABLE, REFERENCES `users(id)`
  - `deleted_at`: `timestamp with time zone`, NULLABLE (Soft delete)
- **Indexes:** INDEX `items_household_idx` ON (`household_id`), UNIQUE (`household_id`, `name`) WHERE `deleted_at IS NULL`.

#### Table 11: `stock_movements` (`inventory.ts`)
- **Purpose:** Immutable audit ledger of every inventory stock adjustment, purchase arrival, or consumption.
- **Columns:**
  - `id`: `uuid`, PRIMARY KEY, `defaultRandom()`
  - `household_id`: `uuid`, NOT NULL, REFERENCES `households(id)` ON DELETE CASCADE
  - `item_id`: `uuid`, NOT NULL, REFERENCES `items(id)` ON DELETE CASCADE
  - `quantity_delta`: `integer`, NOT NULL (positive for addition, negative for deduction, non-zero)
  - `resulting_quantity`: `integer`, NOT NULL
  - `reason`: `stock_movement_reason_enum`, NOT NULL
  - `notes`: `text`, NULLABLE (mandatory when reason is manual_correction)
  - `reference_id`: `uuid`, NULLABLE (e.g. purchase_id or adjustment ticket)
  - `created_at`: `timestamp with time zone`, NOT NULL, DEFAULT `now()`
  - `created_by`: `uuid`, NOT NULL, REFERENCES `users(id)`
- **Indexes:** INDEX `stock_movements_item_id_idx` ON (`item_id`, `created_at` DESC), `stock_movements_household_idx` ON (`household_id`).

#### Table 12: `purchases` (`purchase.ts`)
- **Purpose:** Purchase orders/events that link shopping activities to expenses and stock movements.
- **Columns:**
  - `id`: `uuid`, PRIMARY KEY, `defaultRandom()`
  - `household_id`: `uuid`, NOT NULL, REFERENCES `households(id)` ON DELETE CASCADE
  - `expense_category_id`: `uuid`, NOT NULL, REFERENCES `expense_categories(id)`
  - `date`: `date`, NOT NULL
  - `total_amount`: `numeric(14,0)`, NOT NULL, DEFAULT `0` (recalculated on server)
  - `vendor`: `varchar(150)`, NULLABLE (e.g. Superindo, Tokopedia, Warung Madura)
  - `payment_method`: `payment_method_enum`, NOT NULL, DEFAULT `'cash'`
  - `status`: `purchase_status_enum`, NOT NULL, DEFAULT `'draft'`
  - `idempotency_key`: `varchar(100)`, NULLABLE, UNIQUE
  - `notes`: `text`, NULLABLE
  - `completed_at`: `timestamp with time zone`, NULLABLE
  - `created_at`: `timestamp with time zone`, NOT NULL, DEFAULT `now()`
  - `updated_at`: `timestamp with time zone`, NOT NULL, DEFAULT `now()`
  - `created_by`: `uuid`, NOT NULL, REFERENCES `users(id)`
  - `updated_by`: `uuid`, NULLABLE, REFERENCES `users(id)`
- **Indexes:** INDEX `purchases_household_date_idx` ON (`household_id`, `date` DESC), `purchases_status_idx` ON (`status`).

#### Table 13: `purchase_items` (`purchase.ts`)
- **Purpose:** Line items of a purchase order.
- **Columns:**
  - `id`: `uuid`, PRIMARY KEY, `defaultRandom()`
  - `purchase_id`: `uuid`, NOT NULL, REFERENCES `purchases(id)` ON DELETE CASCADE
  - `item_id`: `uuid`, NULLABLE, REFERENCES `items(id)` ON DELETE SET NULL (NULL if non-inventory purchase)
  - `item_name`: `varchar(150)`, NOT NULL (captured at purchase time)
  - `quantity`: `integer`, NOT NULL (CONSTRAINT `chk_purchase_items_qty` CHECK `quantity > 0`)
  - `unit_price`: `numeric(14,0)`, NOT NULL (CONSTRAINT `chk_purchase_items_price` CHECK `unit_price >= 0`)
  - `subtotal`: `numeric(14,0)`, NOT NULL (`quantity * unit_price`)
  - `created_at`: `timestamp with time zone`, NOT NULL, DEFAULT `now()`
- **Indexes:** INDEX `purchase_items_purchase_id_idx` ON (`purchase_id`), `purchase_items_item_id_idx` ON (`item_id`).

#### Table 14: `debts_receivables` (`debt.ts`)
- **Purpose:** Tracks debts owed to third parties (`Payable`) or money owed to the household (`Receivable`).
- **Columns:**
  - `id`: `uuid`, PRIMARY KEY, `defaultRandom()`
  - `household_id`: `uuid`, NOT NULL, REFERENCES `households(id)` ON DELETE CASCADE
  - `type`: `debt_type_enum`, NOT NULL (`'payable'` or `'receivable'`)
  - `party_name`: `varchar(150)`, NOT NULL
  - `description`: `text`, NULLABLE
  - `principal_amount`: `numeric(14,0)`, NOT NULL (CONSTRAINT `chk_debt_principal_positive` CHECK `principal_amount > 0`)
  - `remaining_balance`: `numeric(14,0)`, NOT NULL (CONSTRAINT `chk_debt_balance_non_negative` CHECK `remaining_balance >= 0`)
  - `due_date`: `date`, NULLABLE
  - `status`: `debt_status_enum`, NOT NULL, DEFAULT `'open'`
  - `created_at`: `timestamp with time zone`, NOT NULL, DEFAULT `now()`
  - `updated_at`: `timestamp with time zone`, NOT NULL, DEFAULT `now()`
  - `created_by`: `uuid`, NOT NULL, REFERENCES `users(id)`
  - `updated_by`: `uuid`, NULLABLE, REFERENCES `users(id)`
  - `deleted_at`: `timestamp with time zone`, NULLABLE
- **Indexes:** INDEX `debts_receivables_household_idx` ON (`household_id`), `debts_receivables_due_date_idx` ON (`due_date`), `debts_receivables_status_idx` ON (`status`).

#### Table 15: `debt_receivable_payments` (`debt.ts`)
- **Purpose:** Ledger of installment or full payments made against debts or receivables.
- **Columns:**
  - `id`: `uuid`, PRIMARY KEY, `defaultRandom()`
  - `debt_receivable_id`: `uuid`, NOT NULL, REFERENCES `debts_receivables(id)` ON DELETE CASCADE
  - `amount`: `numeric(14,0)`, NOT NULL (CONSTRAINT `chk_debt_payment_positive` CHECK `amount > 0`)
  - `payment_date`: `date`, NOT NULL
  - `payment_method`: `payment_method_enum`, NOT NULL, DEFAULT `'transfer'`
  - `notes`: `text`, NULLABLE
  - `created_at`: `timestamp with time zone`, NOT NULL, DEFAULT `now()`
  - `created_by`: `uuid`, NOT NULL, REFERENCES `users(id)`
- **Indexes:** INDEX `debt_payments_debt_id_idx` ON (`debt_receivable_id`).

#### Table 16: `notification_preferences` (`notification.ts`)
- **Purpose:** Configuration per user/household for alert delivery channels.
- **Columns:**
  - `id`: `uuid`, PRIMARY KEY, `defaultRandom()`
  - `household_id`: `uuid`, NOT NULL, REFERENCES `households(id)` ON DELETE CASCADE
  - `user_id`: `uuid`, NOT NULL, REFERENCES `users(id)` ON DELETE CASCADE
  - `email_enabled`: `boolean`, NOT NULL, DEFAULT `true`
  - `email_address`: `varchar(255)`, NULLABLE
  - `whatsapp_enabled`: `boolean`, NOT NULL, DEFAULT `false`
  - `whatsapp_number`: `varchar(30)`, NULLABLE
  - `created_at`: `timestamp with time zone`, NOT NULL, DEFAULT `now()`
  - `updated_at`: `timestamp with time zone`, NOT NULL, DEFAULT `now()`
- **Constraints / Indexes:** UNIQUE (`household_id`, `user_id`).

#### Table 17: `notification_events` (`notification.ts`)
- **Purpose:** Transactional outbox table storing alert events to be dispatched asynchronously by `apps/worker`.
- **Columns:**
  - `id`: `uuid`, PRIMARY KEY, `defaultRandom()`
  - `household_id`: `uuid`, NOT NULL, REFERENCES `households(id)` ON DELETE CASCADE
  - `item_id`: `uuid`, NULLABLE, REFERENCES `items(id)` ON DELETE CASCADE
  - `event_type`: `varchar(50)`, NOT NULL (e.g. `'low_stock'`, `'out_of_stock'`)
  - `payload`: `jsonb`, NOT NULL (contains `itemName`, `unit`, `currentStock`, `threshold`, `timestamp`)
  - `status`: `notification_status_enum`, NOT NULL, DEFAULT `'pending'`
  - `channel`: `notification_channel_enum`, NOT NULL DEFAULT `'email'`
  - `recipient`: `varchar(255)`, NOT NULL
  - `attempts`: `integer`, NOT NULL, DEFAULT `0`
  - `max_attempts`: `integer`, NOT NULL, DEFAULT `5`
  - `last_error`: `text`, NULLABLE
  - `next_retry_at`: `timestamp with time zone`, NULLABLE
  - `sent_at`: `timestamp with time zone`, NULLABLE
  - `created_at`: `timestamp with time zone`, NOT NULL, DEFAULT `now()`
- **Indexes:** INDEX `notification_events_poll_idx` ON (`status`, `next_retry_at`, `created_at`) WHERE `status IN ('pending', 'failed')`.

#### Table 18: `audit_logs` (`audit.ts`)
- **Purpose:** System-wide audit log for critical mutations, reversals, and security events.
- **Columns:**
  - `id`: `uuid`, PRIMARY KEY, `defaultRandom()`
  - `household_id`: `uuid`, NOT NULL, REFERENCES `households(id)` ON DELETE CASCADE
  - `user_id`: `uuid`, NULLABLE, REFERENCES `users(id)`
  - `entity_type`: `varchar(50)`, NOT NULL (e.g. `'purchase'`, `'stock'`, `'debt'`, `'auth'`)
  - `entity_id`: `uuid`, NOT NULL
  - `action`: `varchar(50)`, NOT NULL (e.g. `'complete'`, `'cancel'`, `'adjust'`, `'login_failed'`)
  - `changes`: `jsonb`, NULLABLE (before and after state diff)
  - `ip_address`: `varchar(45)`, NULLABLE
  - `user_agent`: `varchar(500)`, NULLABLE
  - `created_at`: `timestamp with time zone`, NOT NULL, DEFAULT `now()`
- **Indexes:** INDEX `audit_logs_household_entity_idx` ON (`household_id`, `entity_type`, `entity_id`), INDEX `audit_logs_created_at_idx` ON (`created_at` DESC).

---

## 5. Exhaustive REST API Specification (`/api/v1`)

All endpoints are prefixed with `/api/v1`.  
Unless explicitly marked as Public, **all endpoints require a valid Bearer JWT in the `Authorization` header** and an active `HouseholdGuard` check.

### 5.1 Common Response Envelopes & Error Formats

#### Success Envelope (Standard)
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

#### Error Envelope (Standard NestJS Filter)
Never leak database stack traces, SQL syntax, or internal file paths to the client.
```json
{
  "success": false,
  "statusCode": 422,
  "error": "Unprocessable Entity",
  "message": "Validation failed",
  "errors": [
    {
      "field": "nominal",
      "message": "Nominal must be greater than 0"
    }
  ],
  "timestamp": "2026-10-27T12:00:00.000Z",
  "path": "/api/v1/expenses"
}
```

---

### 5.2 Authentication Endpoints (`/api/v1/auth`)

#### 1. `POST /api/v1/auth/login`
- **Access:** Public (Rate limited: 5 attempts / min)
- **Request Body:**
  ```json
  {
    "email": "budi@rumahkita.local",
    "password": "Password123!"
  }
  ```
- **Validation:**
  - `email`: valid email string, required, lowercase trimmed
  - `password`: string, min 8 chars, required
- **Response `200 OK`:**
  - Set-Cookie: `refreshToken=<token>; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=604800`
  ```json
  {
    "success": true,
    "data": {
      "accessToken": "eyJhbGciOi...",
      "expiresIn": 900,
      "user": {
        "id": "0192e20b-...",
        "email": "budi@rumahkita.local",
        "fullName": "Budi Santoso"
      },
      "household": {
        "id": "0192e20b-...",
        "name": "Keluarga Budi & Ani",
        "role": "owner"
      }
    }
  }
  ```
- **Errors:** `401 Unauthorized` ("Invalid email or password"), `429 Too Many Requests`.

#### 2. `POST /api/v1/auth/refresh`
- **Access:** Public via HttpOnly Cookie (Rate limited: 30 / min)
- **Request Headers:** Cookie containing `refreshToken`
- **Logic:**
  1. Hash received refresh token using SHA-256.
  2. Query `refresh_sessions` by `token_hash`.
  3. If session not found or `is_revoked = true`: **Token Reuse Detected**. Invalidate all sessions sharing the same `family_id` immediately. Return `401 Unauthorized`.
  4. If expired (`expires_at < NOW()`): Mark revoked, return `401 Unauthorized`.
  5. Rotate token: Mark current session as revoked, generate new refresh token and new access token, insert new session record with identical `family_id`.
- **Response `200 OK`:**
  - Set-Cookie: New rotated `refreshToken`
  ```json
  {
    "success": true,
    "data": {
      "accessToken": "eyJhbGciOi...",
      "expiresIn": 900
    }
  }
  ```
- **Errors:** `401 Unauthorized` ("Session expired or invalid").

#### 3. `POST /api/v1/auth/logout`
- **Access:** Public / Authenticated via Cookie
- **Logic:** Mark active refresh token session as revoked in DB; clear cookie with `Max-Age=0`.
- **Response `200 OK`:** `{ "success": true, "message": "Successfully logged out" }`

#### 4. `POST /api/v1/auth/logout-all`
- **Access:** Private (Bearer JWT)
- **Logic:** Mark all `refresh_sessions` where `user_id = currentUser.id` as `is_revoked = true`.
- **Response `200 OK`:** `{ "success": true, "message": "All sessions revoked" }`

#### 5. `POST /api/v1/auth/password/forgot`
- **Access:** Public (Rate limited)
- **Request Body:** `{ "email": "budi@rumahkita.local" }`
- **Response `200 OK`:** `{ "success": true, "message": "If the email is registered, reset instructions have been sent" }`

#### 6. `POST /api/v1/auth/password/reset`
- **Access:** Public
- **Request Body:** `{ "token": "string", "newPassword": "Password123!" }`
- **Response `200 OK`:** `{ "success": true, "message": "Password successfully reset" }`
- **Errors:** `400 Bad Request` ("Invalid or expired reset token"), `422 Unprocessable Entity` ("Password too weak").

---

### 5.3 Household & Member Endpoints (`/api/v1/household`)

#### 1. `GET /api/v1/household`
- **Access:** Private
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "id": "uuid",
      "name": "Keluarga Budi & Ani",
      "currency": "IDR",
      "timezone": "Asia/Jakarta",
      "members": [
        {
          "userId": "uuid",
          "fullName": "Budi Santoso",
          "email": "budi@rumahkita.local",
          "role": "owner",
          "joinedAt": "2026-10-01T00:00:00Z"
        },
        {
          "userId": "uuid",
          "fullName": "Ani Santoso",
          "email": "ani@rumahkita.local",
          "role": "member",
          "joinedAt": "2026-10-01T00:00:00Z"
        }
      ]
    }
  }
  ```

#### 2. `POST /api/v1/household/invitations`
- **Access:** Private (Role: `owner` only)
- **Request Body:** `{ "email": "ani@rumahkita.local", "role": "member" }`
- **Response `201 Created`:** `{ "success": true, "invitationId": "uuid", "expiresAt": "2026-11-03T00:00:00Z" }`
- **Errors:** `403 Forbidden` ("Only household owner can invite members"), `409 Conflict`.

---

### 5.4 Master Data Endpoints (`/api/v1/income-sources`, `/income-categories`, `/expense-categories`)

#### 1. `GET|POST /api/v1/income-sources`
- **`GET` Query:** `?includeInactive=false`
- **`POST` Body:** `{ "name": "Gaji Bulanan", "description": "Gaji kantor PT ABC" }`
- **Validation:** `name` string, non-empty, max 100 chars, unique per household.
- **Response `201 Created`:** Created income source record.
- **Errors:** `409 Conflict` ("Income source name already exists in household").

#### 2. `PUT|DELETE /api/v1/income-sources/:id`
- **`PUT` Body:** `{ "name": "Gaji Utama", "description": "Updated desc", "isActive": true }`
- **`DELETE`:** Soft archive (`deleted_at = now()`).
- **Response `200 OK`:** Updated record or `{ "success": true, "message": "Archived" }`.

#### 3. `GET|POST|PUT|DELETE /api/v1/income-categories` & `/api/v1/expense-categories`
- **`POST` Body:** `{ "name": "Belanja Dapur", "icon": "utensils", "color": "#FF8A65", "budgetLimit": 2500000 }`
- **Validation:** `name` required, `budgetLimit` integer Rupiah ≥ 0.
- **Response:** `200` / `201` standard JSON.

---

### 5.5 Finance Endpoints (`/api/v1/incomes`, `/api/v1/expenses`)

#### 1. `GET /api/v1/incomes`
- **Query Params:**
  - `page`: default 1
  - `limit`: default 20
  - `startDate`: ISO date `YYYY-MM-DD`
  - `endDate`: ISO date `YYYY-MM-DD`
  - `sourceId`: UUID
  - `categoryId`: UUID
  - `createdBy`: UUID
  - `search`: string (matches notes)
- **Response `200 OK`:** Enveloped array of incomes + pagination meta.

#### 2. `POST /api/v1/incomes`
- **Header:** `Idempotency-Key` (optional string)
- **Request Body:**
  ```json
  {
    "date": "2026-10-27",
    "nominal": 12000000,
    "sourceId": "0192e20b-...",
    "categoryId": "0192e20b-...",
    "notes": "Gaji bulan Oktober"
  }
  ```
- **Validation:**
  - `date`: valid `YYYY-MM-DD` date string
  - `nominal`: integer > 0
  - `sourceId`: valid UUID referencing active `income_sources` in household
  - `categoryId`: optional UUID referencing active `income_categories`
- **Response `201 Created`:** Created income record with populated source and category relations.
- **Errors:** `422 Unprocessable Entity` (`nominal <= 0` or missing `sourceId`).

#### 3. `GET|PUT|DELETE /api/v1/incomes/:id`
- **`PUT` Body:** `{ "nominal": 12500000, "notes": "Gaji + bonus" }`
- **`DELETE`:** Sets `deleted_at = now()` (soft delete) with audit log.

#### 4. `GET /api/v1/expenses`
- **Query Params:** `page`, `limit`, `startDate`, `endDate`, `categoryId`, `paymentMethod`, `search`
- **Response `200 OK`:** Enveloped list of expenses.

#### 5. `POST /api/v1/expenses`
- **Header:** `Idempotency-Key` (optional string)
- **Request Body:**
  ```json
  {
    "date": "2026-10-27",
    "nominal": 150000,
    "categoryId": "0192e20b-...",
    "paymentMethod": "transfer",
    "notes": "Belanja sayur mingguan"
  }
  ```
- **Validation:**
  - `nominal`: integer > 0
  - `categoryId`: valid UUID referencing active `expense_categories` in household
  - `paymentMethod`: enum `['cash', 'transfer', 'ewallet', 'other']`
- **Response `201 Created`:** Created expense record.
- **Errors:** `422 Unprocessable Entity` (if nominal ≤ 0 or categoryId missing).

---

### 5.6 Inventory Endpoints (`/api/v1/items`)

#### 1. `GET /api/v1/items`
- **Query Params:**
  - `status`: `Aman` | `Menipis` | `Habis` | `all`
  - `category`: string
  - `search`: string
  - `page`, `limit`
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "uuid",
        "name": "Beras Rojolele 5kg",
        "category": "Sembako",
        "unit": "pack",
        "quantityOnHand": 2,
        "lowStockThreshold": 3,
        "location": "Dapur",
        "status": "Menipis",
        "notes": null
      }
    ],
    "meta": {
      "summary": {
        "totalActive": 45,
        "lowStock": 3,
        "outOfStock": 1
      }
    }
  }
  ```

#### 2. `POST /api/v1/items`
- **Request Body:**
  ```json
  {
    "name": "Minyak Goreng 2L",
    "category": "Sembako",
    "unit": "pouch",
    "quantityOnHand": 2,
    "lowStockThreshold": 1,
    "location": "Dapur",
    "notes": "Merk Bimoli / Sania"
  }
  ```
- **Validation:** `name` required, `unit` required, `quantityOnHand >= 0`, `lowStockThreshold >= 0`.
- **Response `201 Created`:** Created item record.

#### 3. `GET /api/v1/items/:id/stock-adjustments`
- **Response `200 OK`:** List of `stock_movements` for the item sorted by `created_at DESC`.

#### 4. `POST /api/v1/items/:id/stock-adjustments`
- **Request Body:**
  ```json
  {
    "delta": -1,
    "reason": "Minyak tumpah saat memasak"
  }
  ```
- **Validation:**
  - `reason`: string, required, min 3 chars
  - `delta`: non-zero integer
  - Calculation check: `quantity_on_hand + delta >= 0`
- **Logic:**
  1. Lock item row for update (`SELECT ... FOR UPDATE`).
  2. Compute `newQuantity = quantity_on_hand + delta`.
  3. If `newQuantity < 0`, throw `422 Unprocessable Entity`.
  4. Update `items.quantity_on_hand = newQuantity`.
  5. Insert `stock_movements` record (`delta`, `resultingQuantity = newQuantity`, `reason = 'manual_correction'`, `notes = reason`).
  6. Transition Evaluation: If `previousQuantity > threshold` AND `newQuantity <= threshold`, insert into `notification_events`.
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "itemId": "uuid",
      "previousQuantity": 2,
      "newQuantity": 1,
      "status": "Menipis"
    }
  }
  ```
- **Errors:** `422 Unprocessable Entity` ("Reason is mandatory" or "Resulting stock cannot be negative").

---

### 5.7 Purchases Endpoints (`/api/v1/purchases`)

#### 1. `GET /api/v1/purchases`
- **Query Params:** `status`, `startDate`, `endDate`, `page`, `limit`
- **Response `200 OK`:** List of purchases with line item counts.

#### 2. `POST /api/v1/purchases`
- **Request Body:**
  ```json
  {
    "date": "2026-10-27",
    "vendor": "Superindo",
    "expenseCategoryId": "uuid",
    "paymentMethod": "transfer",
    "notes": "Belanja bulanan dapur",
    "items": [
      {
        "itemId": "uuid",
        "itemName": "Beras Rojolele 5kg",
        "quantity": 2,
        "unitPrice": 75000
      },
      {
        "itemId": null,
        "itemName": "Sabun Cuci Piring",
        "quantity": 1,
        "unitPrice": 15000
      }
    ]
  }
  ```
- **Server Calculation:** Backend computes `subtotal = quantity * unitPrice` for each item and `total_amount = sum(subtotals)`. Never trust client-sent total.
- **Response `201 Created`:** Draft purchase created.

#### 3. `POST /api/v1/purchases/:id/complete` (Core Transaction)
- **Header:** `Idempotency-Key` (required for safe retries)
- **Request Body:** `{}` (or optional final adjustment)
- **Transactional Steps (`db.transaction`):**
  1. Check idempotency table/key. If cached, return previous result.
  2. Fetch purchase by ID with FOR UPDATE.
  3. Validate purchase status is `draft`. (If already `completed`, return `400 Bad Request`).
  4. Recalculate total amount from `purchase_items`.
  5. Create 1 record in `expenses`:
     - `nominal = purchase.total_amount`
     - `category_id = purchase.expense_category_id`
     - `purchase_id = purchase.id`
     - `date = purchase.date`
     - `payment_method = purchase.payment_method`
     - `notes = "Pembelian: " + purchase.vendor + " - " + purchase.notes`
  6. For each `purchase_items` where `item_id IS NOT NULL`:
     - Fetch current item stock with FOR UPDATE.
     - Insert `stock_movements`: `quantity_delta = +quantity`, `reason = 'purchase'`, `reference_id = purchase.id`.
     - Update `items`: `quantity_on_hand = quantity_on_hand + quantity`.
  7. Mark `purchases.status = 'completed'`, `completed_at = NOW()`.
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "purchaseId": "uuid",
      "status": "completed",
      "expenseId": "uuid",
      "totalAmount": 165000,
      "itemsUpdatedCount": 1
    }
  }
  ```
- **Errors:** `400 Bad Request` ("Purchase is already completed or cancelled"), `409 Conflict` ("Concurrent modification").

#### 4. `POST /api/v1/purchases/:id/cancel`
- **Request Body:** `{ "reason": "Salah input barang belanjaan" }`
- **Logic:**
  - If draft: simple status update to `cancelled`.
  - If completed: execute compensating reversal transaction:
    1. Soft delete / cancel generated expense.
    2. Deduct item stocks back and insert compensating `stock_movements` with `reason = 'reversal'`.
    3. Update purchase status to `cancelled`.
- **Response `200 OK`:** `{ "success": true, "message": "Purchase cancelled and reversed" }`

---

### 5.8 Debts & Receivables Endpoints (`/api/v1/debts-receivables`)

#### 1. `GET /api/v1/debts-receivables`
- **Query Params:** `type` (`payable` | `receivable`), `status` (`open`, `partially_paid`, `settled`, `overdue`), `page`, `limit`
- **Response `200 OK`:** Enveloped list including `principalAmount`, `remainingBalance`, `dueDate`, `status`.

#### 2. `POST /api/v1/debts-receivables`
- **Request Body:**
  ```json
  {
    "type": "payable",
    "partyName": "Pak RT",
    "description": "Iuran sampah tahunan",
    "principalAmount": 1000000,
    "dueDate": "2026-12-31"
  }
  ```
- **Validation:** `principalAmount > 0`, `type` in `['payable', 'receivable']`, `partyName` non-empty.
- **Logic:** Sets initial `remaining_balance = principalAmount`, `status = 'open'`.
- **Response `201 Created`:** Created record.

#### 3. `POST /api/v1/debts-receivables/:id/payments`
- **Request Body:**
  ```json
  {
    "paymentDate": "2026-10-27",
    "amount": 300000,
    "paymentMethod": "transfer",
    "notes": "Cicilan 1"
  }
  ```
- **Validation & Transactional Logic:**
  1. Lock debt record FOR UPDATE.
  2. Validate `amount > 0`.
  3. Validate `amount <= remaining_balance`. If `amount > remaining_balance`, return `422 Unprocessable Entity` ("Amount exceeds remaining balance").
  4. Insert record into `debt_receivable_payments`.
  5. Compute `newBalance = remaining_balance - amount`.
  6. Transition status:
     - If `newBalance == 0`: `status = 'settled'`.
     - Else: `status = 'partially_paid'`.
  7. Update `debts_receivables`: `remaining_balance = newBalance`, `status = newStatus`.
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "paymentId": "uuid",
      "debtId": "uuid",
      "amountPaid": 300000,
      "remainingBalance": 700000,
      "status": "partially_paid"
    }
  }
  ```
- **Errors:** `422 Unprocessable Entity` ("Payment amount exceeds remaining balance of 700,000").

---

### 5.9 Dashboard & Reporting Endpoints

#### 1. `GET /api/v1/dashboard`
- **Query Params:** `period` (`this_month` | `last_month` | `this_year` | `custom`), `startDate`, `endDate`
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "period": {
        "startDate": "2026-10-01",
        "endDate": "2026-10-31"
      },
      "summaryCards": {
        "totalIncome": 25000000,
        "totalExpense": 14250000,
        "netCashFlow": 10750000,
        "openDebtsCount": 2,
        "openDebtsTotal": 1500000,
        "openReceivablesTotal": 500000
      },
      "cashFlowTrend": [
        { "date": "2026-10-05", "income": 12500000, "expense": 1200000 },
        { "date": "2026-10-25", "income": 12500000, "expense": 3500000 }
      ],
      "recentTransactions": [ ... ],
      "lowStockItems": [
        {
          "id": "uuid",
          "name": "Minyak Goreng 2L",
          "currentStock": 1,
          "threshold": 2,
          "unit": "pouch",
          "status": "Menipis"
        }
      ]
    }
  }
  ```

#### 2. `GET /api/v1/reports/monthly`
- **Query Params:** `year` (int, e.g. 2026), `month` (1-12)
- **Response `200 OK`:**
  - Net cash flow = `totalIncome - totalExpense`
  - Expense breakdown by category (`categoryId`, `categoryName`, `total`, `percentage`)
  - Income breakdown by source (`sourceId`, `sourceName`, `total`, `percentage`)
  - Debt/Receivable balance movement summary during the month

#### 3. `GET /api/v1/reports/yearly`
- **Query Params:** `year` (int, e.g. 2026)
- **Invariants:** Returns an array of exactly 12 months (indices 1 to 12). Months without transactions MUST be present with `income: 0`, `expense: 0`, `net: 0` to preserve Recharts visual continuity.

#### 4. `GET /api/v1/reports/export/csv`
- **Query Params:** `type` (`expenses` | `incomes` | `transactions`), `startDate`, `endDate`
- **Response `200 OK`:**
  - Header: `Content-Type: text/csv; charset=utf-8`
  - Header: `Content-Disposition: attachment; filename="transaksi_2026-10.csv"`
  - Format: RFC 4180 standard, UTF-8 BOM if needed for Indonesian Excel compatibility.

---

### 5.10 Notification Settings Endpoints (`/api/v1/settings/notifications`)

#### 1. `GET /api/v1/settings/notifications`
- **Response `200 OK`:** User's current notification settings and channel verification status.

#### 2. `PUT /api/v1/settings/notifications`
- **Request Body:**
  ```json
  {
    "emailEnabled": true,
    "emailAddress": "budi@rumahkita.local",
    "whatsappEnabled": true,
    "whatsappNumber": "+6281234567890"
  }
  ```
- **Validation:** `whatsappNumber` must match E.164 phone regex (e.g. `^\+62[0-9]{9,13}$`).

#### 3. `POST /api/v1/settings/notifications/test`
- **Request Body:** `{ "channel": "email" }`
- **Logic:** Enqueues a test event to `notification_events`.
- **Response `200 OK`:** `{ "success": true, "message": "Test notification queued" }`

---

## 6. Authentication & Security Architecture

### 6.1 Cryptographic Standards
1. **Password Hashing:** Argon2id via `@node-rs/argon2` or `argon2`:
   - Memory cost: ≥ 65536 KB (64 MB)
   - Time cost (iterations): ≥ 3
   - Parallelism: 4 threads
   - Output hash format: `$argon2id$v=19$m=65536,t=3,p=4$...`
2. **Access Token:**
   - Stateless JWT (HMAC-SHA256 via `JWT_SECRET`)
   - Expiration: exactly 15 minutes (`15m` / 900 seconds)
   - Payload claims:
     ```json
     {
       "sub": "user-uuid",
       "householdId": "household-uuid",
       "role": "owner",
       "email": "budi@rumahkita.local",
       "iat": 1729000000,
       "exp": 1729000900
     }
     ```
3. **Refresh Token & Storage:**
   - Cryptographically random 64-byte hex string (`crypto.randomBytes(32).toString('hex')`)
   - Stored in database ONLY as a SHA-256 hash (`crypto.createHash('sha256').update(rawToken).digest('hex')`)
   - Stored in browser ONLY as an `HttpOnly`, `Secure` (in production), `SameSite=Lax`, `Path=/api/v1/auth` cookie.
   - Lifetime: 7 days (`604800` seconds).
4. **Token Family & Reuse Detection:**
   - Every login generates a new `family_id` (UUID).
   - On rotation (`POST /auth/refresh`), the old token is marked revoked, and the new token shares the same `family_id`.
   - If an already-revoked token hash is submitted, the system flags token theft, revokes all tokens with that `family_id`, and immediately invalidates all active sessions for that user.

### 6.2 Household Multi-Tenancy Isolation Guard (`HouseholdGuard`)
- Custom NestJS Guard / Interceptor (`@UseGuards(JwtAuthGuard, HouseholdGuard)`):
  1. Reads `householdId` from validated JWT claims.
  2. Verifies `user_id` is an active member of `household_id` in `household_members`.
  3. Attaches `householdId` to the NestJS request context (`req.householdId`).
  4. Service Layer Contract: Every single Drizzle query MUST include `eq(table.householdId, req.householdId)`.
  5. Attempting to query or mutate an entity with an ID from another household returns `403 Forbidden` or `404 Not Found`.

### 6.3 Security Hardening & OWASP Compliance
- **CSRF Protection:** Origin / Referer validation middleware for state-changing HTTP methods (`POST`, `PUT`, `DELETE`).
- **Rate Limiting:** NestJS `@nestjs/throttler` applied globally with strict limits on `/auth/*` (e.g. 5 attempts per 60 seconds).
- **Error Sanitization:** Global NestJS Exception Filter catches all unhandled exceptions, logs the internal error to server console, and emits a clean JSON response without DB error codes, table names, or stack traces.

---

## 7. Transactional Business Logic & Invariants

### 7.1 Atomic Purchase Completion (`POST /purchases/:id/complete`)
```
+---------------------------------------------------------------------------------+
|                       PostgreSQL Transaction (db.transaction)                   |
|                                                                                 |
| 1. SELECT * FROM purchases WHERE id = :id FOR UPDATE                            |
|    - Assert status == 'draft' (else throw 400 Bad Request)                      |
|                                                                                 |
| 2. SELECT * FROM purchase_items WHERE purchase_id = :id                         |
|    - Compute totalAmount = SUM(quantity * unit_price)                           |
|                                                                                 |
| 3. INSERT INTO expenses (household_id, category_id, nominal, date, ...)         |
|    - nominal = totalAmount                                                      |
|    - purchase_id = purchase.id                                                  |
|                                                                                 |
| 4. FOR EACH purchase_item WHERE item_id IS NOT NULL:                            |
|    - SELECT * FROM items WHERE id = item_id FOR UPDATE                          |
|    - INSERT INTO stock_movements (item_id, delta = +qty, reason = 'purchase')   |
|    - UPDATE items SET quantity_on_hand = quantity_on_hand + qty                 |
|                                                                                 |
| 5. UPDATE purchases SET status = 'completed', total_amount = totalAmount        |
|                                                                                 |
| 6. COMMIT TRANSACTION                                                           |
+---------------------------------------------------------------------------------+
      |
      | (If any step fails -> Automatic ROLLBACK -> Zero side effects)
```

### 7.2 Stock Adjustment Invariants
1. `reason` is **mandatory**. Empty or omitted reason results in `422 Unprocessable Entity`.
2. Stock cannot drop below zero. If `quantity_on_hand + delta < 0`, abort with `422 Unprocessable Entity`.
3. Every adjustment creates an immutable `stock_movements` record.
4. Stock status transitions:
   - `quantity_on_hand == 0` -> `Habis`
   - `0 < quantity_on_hand <= low_stock_threshold` -> `Menipis`
   - `quantity_on_hand > low_stock_threshold` -> `Aman`

### 7.3 Debts & Receivables Invariants
1. `principal_amount > 0` at creation.
2. Initial `remaining_balance = principal_amount`.
3. Payments:
   - `payment_amount > 0`.
   - `payment_amount <= remaining_balance` (cannot overpay; return 422).
   - Remaining balance update: `remaining_balance = remaining_balance - payment_amount`.
   - If `remaining_balance == 0`: `status = 'settled'`.
   - If `remaining_balance > 0`: `status = 'partially_paid'`.
4. Overdue logic: If `due_date < CURRENT_DATE` and `remaining_balance > 0`, item is classified as `Overdue`.

---

## 8. Notification Outbox System & Deduplication Engine

### 8.1 The Outbox Model (`apps/worker`)
- Background notification dispatching is fully decoupled from HTTP requests to prevent blocking API responses and avoid distributed transaction failure.
- When a stock transition occurs, the API inserts an event into `notification_events` inside the existing DB transaction.
- The daemon `apps/worker`:
  1. Polls `notification_events` where `status IN ('pending', 'failed')` AND `(next_retry_at IS NULL OR next_retry_at <= NOW())` AND `attempts < max_attempts`.
  2. Claims batch using `UPDATE ... SET status = 'processing' ... RETURNING *`.
  3. Formats template (Indonesian copywriting):
     - *Subject:* `[RumahKita] Pengingat: Stok ${itemName} Menipis`
     - *Body:* `Stok ${itemName} saat ini tersisa ${currentStock} ${unit} (batas minimum: ${threshold} ${unit}). Harap segera jadwalkan pembelian.`
  4. Dispatches via configured provider:
     - Email: SMTP or Resend (MVP stub/logging)
     - WhatsApp: Meta Cloud API (MVP stub/logging)
  5. On success: Updates `status = 'sent'`, `sent_at = NOW()`.
  6. On failure: Increments `attempts`, logs `last_error`, sets `next_retry_at = NOW() + (2 ^ attempts * 60 seconds)`, sets `status = 'failed'`.

### 8.2 Deduplication Rules
1. **Transition Guard:** Notification is ONLY queued when an item transitions from `Aman` (`quantity > threshold`) to `Menipis` / `Habis` (`quantity <= threshold`).
2. **State Suppression:** If an item is already at or below threshold, subsequent consumption or adjustments that reduce stock further do NOT trigger duplicate notification events.
3. **Re-arm Condition:** A new alert can only be triggered after stock has been replenished above threshold (`> low_stock_threshold`) and subsequently falls back below threshold.

---

## 9. Backend Acceptance Criteria & Test Assertions

| Criteria ID | Category | Acceptance Rule | Test Assertion & Verification Method |
|-------------|----------|-----------------|--------------------------------------|
| AC-BE-01 | Auth | Two seeded users can login and access same household | `POST /auth/login` with user A and user B credentials; both return tokens with identical `householdId`. |
| AC-BE-02 | Auth | Cross-tenant access is rejected | User with Token H1 attempts `GET /incomes/:id_of_H2`; API responds `403 Forbidden`. |
| AC-BE-03 | Auth | Access token expires after 15m; refresh rotates | Issue token; wait/mock 15m; request returns 401. Call `/auth/refresh` with cookie; receives new token pair; old refresh cookie fails on replay. |
| AC-BE-04 | Auth | Logout revokes refresh session | Call `POST /auth/logout`; subsequent `POST /auth/refresh` returns `401 Unauthorized`. |
| AC-BE-05 | Auth | Passwords are Argon2id hashes in DB | Query `users.password_hash`; verify string starts with `$argon2id$v=19$m=...`. Plaintext is nowhere in DB. |
| AC-BE-06 | Finance | Income nominal ≤ 0 returns 422 | `POST /incomes` with `{ nominal: 0 }` and `{ nominal: -100 }`; API returns HTTP 422 with field validation error. |
| AC-BE-07 | Finance | Expense without category returns 422 | `POST /expenses` without `categoryId`; API returns HTTP 422. |
| AC-BE-08 | Finance | Dashboard aggregation equals sum of incomes | Insert incomes 100K, 200K, 300K; `GET /dashboard` returns `totalIncome: 600000`. |
| AC-BE-09 | Finance | Monthly report matches stored transactions | Query `GET /reports/monthly?year=2026&month=10`; sums match exact DB aggregation. |
| AC-BE-10 | Purchase | Atomic purchase completion creates 1 expense and increments stock | `POST /purchases/:id/complete`; check DB: exactly 1 expense row created with matching purchase ID; item stock incremented by purchased quantity. |
| AC-BE-11 | Purchase | Purchase completion rollback on error | Simulate error mid-transaction; verify in DB: 0 expenses created, 0 stock movements created, item stock unmodified. |
| AC-BE-12 | Inventory | Stock adjustment without reason returns 422 | `POST /items/:id/stock-adjustments` with `{ delta: 5 }`; API returns HTTP 422. |
| AC-BE-13 | Inventory | Stock adjustment cannot go below zero | Item with stock = 2; `POST /items/:id/stock-adjustments` with `{ delta: -3 }`; returns HTTP 422. |
| AC-BE-14 | Debt | Payment deduction updates balance correctly | Create debt 1,000,000; `POST /debts-receivables/:id/payments` with 300,000; returns `remainingBalance: 700000`. |
| AC-BE-15 | Debt | Payment exceeding balance returns 422 | Debt balance = 700,000; attempt payment of 800,000; API returns HTTP 422. |
| AC-BE-16 | Debt | Overdue status detection | Debt with `dueDate = yesterday` and `remainingBalance > 0`; status is `overdue`. |
| AC-BE-17 | Notification | Transition to low stock creates outbox event | Complete purchase or adjustment dropping stock from 6 to 2 (threshold = 3); verify 1 row created in `notification_events`. |
| AC-BE-18 | Notification | Duplicate check on low stock does not spam | Perform second adjustment from 2 to 1 (already low); verify NO second row in `notification_events`. |
| AC-BE-19 | Notification | Worker processes outbox event | Worker polls; marks `notification_events.status = 'sent'`. |
| AC-BE-20 | DB | Migrations and seed run cleanly | Fresh Postgres: `pnpm --filter db db:migrate` exits 0; `pnpm --filter db db:seed` exits 0; all 18 tables populated properly. |
