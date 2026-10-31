# Project: RumahKita MVP

## Architecture
RumahKita is a private household finance & inventory management application designed for two household members.
- **Monorepo Architecture**: Turborepo + pnpm workspaces.
  - `apps/web`: Next.js 14+ App Router, Neo-brutalism design system, React Hook Form + Zod, TanStack Table (desktop) / Card List (mobile), Recharts, BFF Proxy.
  - `apps/api`: NestJS REST API (`/api/v1`), Argon2id auth, JWT + refresh cookies, multi-tenant HouseholdGuard, atomic transactions, Swagger OpenAPI.
  - `apps/worker`: Node.js/TypeScript daemon polling `notification_events` via `FOR UPDATE SKIP LOCKED`, state transition deduplication, exponential backoff, email/WhatsApp stubs.
  - `packages/db`: Drizzle ORM schema (18 PostgreSQL tables), UUID PKs, `numeric(14,0)` IDR currency, audit columns, migrations, seeds.
  - `packages/contracts`: Isomorphic Zod schemas & TypeScript types shared between API and Web.
  - `packages/ui`: Tailwind CSS + Neo-brutalism design tokens, Radix UI primitives.
  - `packages/eslint-config`, `packages/typescript-config`: Shared developer tooling.
  - Docker Compose: PostgreSQL 16 Alpine container.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Turborepo Workspace Scaffolding | Monorepo root, pnpm-workspace.yaml, turbo.json, package.json | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Apps & Packages Skeleton | apps/{web,api,worker}, packages/{db,contracts,ui,eslint-config,typescript-config} | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Docker Compose PostgreSQL | docker-compose.yml for local PostgreSQL 16 Alpine dev environment | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Environment Configuration | Root .env.example, environment variables validation | M1 | ORIGINAL_REQUEST §R1 |
| 5 | Shared Contracts (Zod/TS) | DTO validation schemas & inferred types in packages/contracts | M1 | ORIGINAL_REQUEST §R1 |
| 6 | Neo-brutalism Design System | Tailwind tokens (--bg, --ink, --primary, shadows, borders) in packages/ui | M1 | Doc/design.md §2 |
| 7 | Drizzle ORM Configuration | drizzle.config.ts and database connection pool in packages/db | M2 | ORIGINAL_REQUEST §R2 |
| 8 | 18 Database Tables Schema | Auth, Household, Finance, Inventory, Purchase, Debt, Notification, Audit | M2 | ORIGINAL_REQUEST §R2 |
| 9 | Drizzle Migrations | Generated SQL migration files and execution runner | M2 | ORIGINAL_REQUEST §R2 |
| 10 | Database Seeder | Household, 2 users, default categories, sample inventory items | M2 | ORIGINAL_REQUEST §R2 |
| 11 | NestJS App Scaffolding | apps/api setup with /api/v1 prefix, Swagger docs at /api/docs | M3 | ORIGINAL_REQUEST §R3 |
| 12 | Argon2id & JWT Auth Module | /auth/login, /auth/refresh, /auth/logout, HttpOnly cookies, token rotation | M3 | PRD §6.1, §10 |
| 13 | Multi-Tenant Household Guard | Strict household_id filtering on all queries; HTTP 403 on cross-household access | M3 | PRD §4, §10 |
| 14 | Master Data Management API | CRUD for income sources, income categories, expense categories | M3 | PRD §10 |
| 15 | Incomes API | CRUD for incomes, validation (nominal > 0, date, category) | M3 | PRD §6.3, §10 |
| 16 | Expenses API | CRUD for expenses, validation (nominal > 0, category required) | M3 | PRD §6.4, §10 |
| 17 | Inventory & Items API | CRUD for items, min_stock, unit, stock tracking | M3 | PRD §6.5, §10 |
| 18 | Stock Adjustments API | /items/:id/stock-adjustments with mandatory reason and non-negative check | M3 | PRD §6.7, §10 |
| 19 | Purchases API | CRUD for purchases, items array, total calculation | M3 | PRD §6.6, §10 |
| 20 | Atomic Purchase Completion API | POST /purchases/:id/complete creating expense + stock increment in 1 transaction | M3 | PRD §6.6, §10 |
| 21 | Debts & Receivables API | CRUD for debts/receivables, due date, status computation | M3 | PRD §6.8, §10 |
| 22 | Debt/Receivable Payments API | Record payment with balance validation and monotonic deduction | M3 | PRD §6.9, §10 |
| 23 | Dashboard Aggregation API | GET /dashboard summary figures, net savings, low stock alerts, recent transactions | M3 | PRD §6.2, §10 |
| 24 | Monthly/Yearly Reports API | GET /reports/monthly, GET /reports/yearly with zero-month continuity | M3 | PRD §6.11, §10 |
| 25 | CSV Export API | GET /reports/export/csv financial transactions export | M3 | PRD §6.11, §10 |
| 26 | Notification Preferences API | GET/PUT /settings/notifications preferences management | M3 | PRD §6.10, §10 |
| 27 | Next.js App Router Scaffolding | apps/web initialization with layout, fonts, Neo-brutalism global CSS | M4 | ORIGINAL_REQUEST §R4 |
| 28 | BFF Proxy Integration | Next.js API proxy forwarding requests to NestJS with cookie management | M4 | Doc/design.md §7 |
| 29 | Authentication UI | Login page, credentials form, error toast/alerts | M4 | Doc/design.md §4.1 |
| 30 | Dashboard Page UI | 4 stat cards, Recharts monthly bar chart, recent transactions, low stock | M4 | Doc/design.md §4.2 |
| 31 | Incomes & Expenses UI | TanStack table (desktop) / Card list (mobile), add drawer/modal, validation | M4 | Doc/design.md §4.3 |
| 32 | Purchases Flow UI | Item combobox search, dynamic item rows, confirmation modal with stock preview | M4 | Doc/design.md §4.5 |
| 33 | Inventory UI | Item list with Aman ✓ / Menipis ⚠ / Habis ✕ badges, manual stock adjustment dialog | M4 | Doc/design.md §4.6 |
| 34 | Debts & Receivables UI | Hutang / Piutang tabs, payment recording dialog with balance validation | M4 | Doc/design.md §4.7 |
| 35 | Reports & CSV Export UI | Monthly/yearly charts, breakdown tables, CSV export button | M4 | Doc/design.md §4.8 |
| 36 | Settings UI | Profile, household members, notification channels configuration | M4 | Doc/design.md §4.9 |
| 37 | Responsive Layout (390px - 1280px) | Fixed sidebar desktop, 5-item bottom nav mobile, table-to-card reflow | M4 | Doc/design.md §3 |
| 38 | Notification Events Outbox Trigger | DB transaction trigger creating events on Safe -> Low/Out stock transition | M5 | ORIGINAL_REQUEST §R5 |
| 39 | Notification Worker Daemon | apps/worker polling notification_events via FOR UPDATE SKIP LOCKED | M5 | ORIGINAL_REQUEST §R5 |
| 40 | Notification Channel Adapters | Email and WhatsApp notification delivery stubs with logging | M5 | ORIGINAL_REQUEST §R5 |
| 41 | Worker Exponential Retry Backoff | Retry mechanism with backoff and delivery status tracking | M5 | ORIGINAL_REQUEST §R5 |
| 42 | E2E Test Runner & Harness | Opaque-box HTTP test runner and Playwright test suite | E2E | ORIGINAL_REQUEST Acceptance |
| 43 | E2E Test Suite Tiers 1-4 | Feature, Boundary, Cross-Feature, and Real-World Scenarios tests | E2E | ORIGINAL_REQUEST Acceptance |
| 44 | Adversarial Coverage Hardening | Tier 5 white-box challenger stress tests and security edge cases | M5 | Project Pattern Phase 2 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Track | Test harness, opaque-box API tests, responsive Playwright tests (T1-T4) | none (requirements-driven) | DONE |
| M1 | Monorepo Foundation | Turborepo, pnpm workspaces, apps & packages skeleton, Docker, contracts, ui tokens | none | DONE |
| M2 | Database Schema & Drizzle | 18 PostgreSQL tables, UUID PKs, numeric(14,0), migrations, seeder | M1 | DONE |
| M3 | Backend API (NestJS) | /api/v1 REST endpoints, Auth, Guards, CRUD, Atomic Transactions, Reports, Swagger | M2 | DONE |
| M4 | Frontend Web (Next.js) | Neo-brutalism UI, pages, components, TanStack tables/cards, Recharts, BFF proxy | M1, M3 | DONE |
| M5 | Worker & E2E Hardening | Outbox polling worker, 100% E2E test pass (Phase 1), Adversarial hardening (Phase 2) | M3, M4, E2E | DONE |

## Interface Contracts

### contracts ↔ api ↔ web
- Shared DTOs and Zod validation schemas exported from `packages/contracts`:
  - `loginSchema`, `registerSchema`, `userProfileSchema`, `householdSchema`, `householdMemberSchema`, `inviteMemberSchema`, `forgotPasswordSchema`, `resetPasswordSchema`
  - `createIncomeSourceSchema`, `updateIncomeSourceSchema`, `incomeSourceResponseSchema`
  - `createIncomeCategorySchema`, `updateIncomeCategorySchema`, `createExpenseCategorySchema`, `updateExpenseCategorySchema`
  - `createIncomeSchema`, `updateIncomeSchema`, `incomeResponseSchema`, `incomeQuerySchema`
  - `createExpenseSchema`, `updateExpenseSchema`, `expenseResponseSchema`, `expenseQuerySchema`
  - `createItemSchema`, `updateItemSchema`, `stockAdjustmentSchema`, `itemResponseSchema`, `itemQuerySchema`
  - `createPurchaseSchema`, `updatePurchaseSchema`, `completePurchaseSchema`, `cancelPurchaseSchema`, `purchaseResponseSchema`
  - `createDebtReceivableSchema`, `updateDebtReceivableSchema`, `recordPaymentSchema`, `debtPaymentResponseSchema`, `debtReceivableResponseSchema`
  - `dashboardQuerySchema`, `dashboardSummaryResponseSchema`, `monthlyReportQuerySchema`, `monthlyReportResponseSchema`, `yearlyReportQuerySchema`, `yearlyReportResponseSchema`, `csvExportQuerySchema`
  - `notificationPreferenceSchema`, `updateNotificationPreferenceSchema`, `notificationEventResponseSchema`
  - Helpers: `formatIDR`, `parseIDR`, `calculateStockStatus`, `evaluateStockThresholdTransition`
- Error Envelope:
  ```json
  {
    "statusCode": 400,
    "error": "Bad Request",
    "message": "Validation failed",
    "details": [{ "field": "amount", "issue": "nominal must be greater than 0" }]
  }
  ```

### api ↔ worker (Outbox Contract)
- Table `notification_events`:
  - `id`: UUID PK
  - `household_id`: UUID FK -> households(id)
  - `item_id`: UUID FK -> items(id)
  - `event_type`: varchar ('STOCK_LOW', 'STOCK_OUT')
  - `channel`: pgEnum ('EMAIL', 'WHATSAPP')
  - `recipient`: varchar
  - `payload`: jsonb ({ itemName, currentStock, minStock, unit })
  - `status`: pgEnum ('PENDING', 'PROCESSING', 'SENT', 'FAILED')
  - `retry_count`: integer (default 0)
  - `next_retry_at`: timestamp with time zone

## Code Layout
```text
RumahKita/
├── apps/
│   ├── web/                    # Next.js 14+ App Router
│   ├── api/                    # NestJS backend
│   └── worker/                 # Notification worker daemon
├── packages/
│   ├── db/                     # Drizzle ORM schema, migrations, seed
│   ├── contracts/              # Shared Zod schemas & TypeScript types
│   ├── ui/                     # Shared Neo-brutalism UI components & tokens
│   ├── eslint-config/          # Shared ESLint configuration
│   └── typescript-config/      # Shared tsconfig bases
├── tests/
│   ├── e2e/                    # Opaque-box E2E test suite (Tiers 1-4, 56 tests)
│   └── playwright/             # Responsive UI tests (390px vs 1280px)
├── docker-compose.yml          # PostgreSQL 16 Alpine container
├── turbo.json                  # Turborepo task pipelines
├── pnpm-workspace.yaml         # pnpm workspace definition
└── package.json                # Root package configuration
```
