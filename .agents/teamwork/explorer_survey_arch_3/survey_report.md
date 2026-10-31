# Architectural & Monorepo Infrastructure Specification Report
**Project:** RumahKita — Household Finance & Inventory MVP  
**Domain:** Architecture, Monorepo Infrastructure, Pipelines, Contracts, Worker, Docker, Testing  
**Author:** Explorer 3 (Architecture & Monorepo Infrastructure Explorer)  
**Date:** 2026-10-27  
**Status:** Approved for Architecture Baseline (Milestone 0)

---

## 1. Executive Summary & Architecture Overview

RumahKita is architected as a high-integrity, modular monorepo driven by **Turborepo** and **pnpm workspaces**. It delivers a private household finance and inventory management system for two household members (Owner and Member) with strict multi-tenancy (`household_id` isolation), transactional atomicity for inventory-financial updates, outbox-based asynchronous notification delivery, and an accessible neo-brutalism design system.

### System Architecture Diagram

```mermaid
graph TD
    subgraph Client Tier
        Browser["User Browser (Desktop / Mobile 390px)"]
    end

    subgraph Monorepo: apps/
        Web["apps/web<br/>Next.js 14+ App Router<br/>(BFF Proxy, Server Components, Client Forms)"]
        API["apps/api<br/>NestJS REST API (/api/v1)<br/>(Auth, Domain Services, Guards)"]
        Worker["apps/worker<br/>Notification Daemon<br/>(Outbox Poller, Retry, Adapters)"]
    end

    subgraph Monorepo: packages/
        Contracts["packages/contracts<br/>(Shared Zod Schemas & TS Types)"]
        DB["packages/db<br/>(Drizzle ORM, 18 Tables, Migrations, Seeds)"]
        UI["packages/ui<br/>(shadcn/ui + Neo-brutalism Components)"]
        ESLintConfig["packages/eslint-config"]
        TSConfig["packages/typescript-config"]
    end

    subgraph Infrastructure Tier
        PG[("PostgreSQL 16 Dev<br/>(Docker Compose)")]
        SMTP["SMTP / Resend Stub"]
        WA["WhatsApp Cloud API Stub"]
    end

    Browser -->|"HTTP / HTTPS (Cookies)"| Web
    Web -->|"BFF Internal Proxy /api -> /api/v1"| API
    Web -.->|"Imports"| Contracts
    Web -.->|"Imports"| UI
    API -.->|"Imports"| Contracts
    API -.->|"Imports"| DB
    Worker -.->|"Imports"| DB
    Worker -.->|"Imports"| Contracts
    API -->|"Drizzle Client (Transactions)"| PG
    Worker -->|"SELECT FOR UPDATE SKIP LOCKED"| PG
    Worker -->|"Send Alert"| SMTP
    Worker -->|"Send Alert"| WA
```

---

## 2. Monorepo Structure & Package Dependencies

The repository uses **pnpm workspaces** with strict package isolation and **Turborepo** for build caching and pipeline execution.

### Directory Tree Layout

```text
RumahKita/
├── .agents/                    # Agent metadata & teamwork records
├── .github/                    # CI/CD workflows (GitHub Actions)
├── apps/
│   ├── api/                    # NestJS RESTful backend API
│   │   ├── src/
│   │   │   ├── common/         # Guards, interceptors, filters, decorators
│   │   │   ├── config/         # Environment & configuration modules
│   │   │   ├── modules/        # Auth, Household, Finance, Inventory, Purchase, Debt, Reports
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── test/               # Integration & API tests
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── web/                    # Next.js 14+ App Router frontend
│   │   ├── app/                # App Router routes & API BFF route handlers
│   │   ├── components/         # Page-level components & feature widgets
│   │   ├── hooks/              # Custom React hooks (auth, query, media)
│   │   ├── lib/                # API client, number formatting (id-ID)
│   │   ├── public/             # Static assets, fonts
│   │   ├── package.json
│   │   ├── tailwind.config.ts
│   │   └── tsconfig.json
│   └── worker/                 # Notification background worker
│       ├── src/
│       │   ├── adapters/       # Email & WhatsApp delivery adapters
│       │   ├── poller/         # Outbox consumer loop & locking
│       │   ├── services/       # Retry backoff, deduplication checker
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   ├── contracts/              # Shared Zod schemas, DTOs, inferred TS types
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   ├── finance/
│   │   │   ├── inventory/
│   │   │   ├── purchase/
│   │   │   ├── debt/
│   │   │   ├── reports/
│   │   │   ├── notifications/
│   │   │   ├── common/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── db/                     # Drizzle ORM schemas, migrations, seeders
│   │   ├── drizzle/            # Generated migration SQL files & meta snapshots
│   │   ├── src/
│   │   │   ├── schema/         # Modular table definitions (18 tables)
│   │   │   ├── client.ts       # Database connection & pooling
│   │   │   ├── migrate.ts      # Programmatic migration runner
│   │   │   ├── seed.ts         # Dev seeder (2 users, household, master categories)
│   │   │   └── index.ts
│   │   ├── drizzle.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── ui/                     # Shared UI library (shadcn/ui + neo-brutalism)
│   │   ├── src/
│   │   │   ├── components/     # Button, Card, Badge, Table, Dialog, Form, Input
│   │   │   ├── tokens/         # Neo-brutalism CSS variables & colors
│   │   │   ├── lib/            # utils (cn, clsx, tailwind-merge)
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── eslint-config/          # Shared ESLint configuration
│   │   ├── package.json
│   │   └── index.js
│   └── typescript-config/      # Base TypeScript configurations
│       ├── base.json
│       ├── nextjs.json
│       ├── nest.json
│       ├── package.json
│       └── react-library.json
├── docker-compose.yml          # PostgreSQL 16 local environment
├── pnpm-workspace.yaml         # pnpm workspace definition
├── turbo.json                  # Turborepo task pipeline definition
├── package.json                # Root package.json
├── .env.example                # Root environment template
├── .gitignore
├── .npmrc
└── .nvmrc
```

### Dependency Graph Matrix

| Project | Consumes | Type |
|---|---|---|
| `apps/web` | `@rumahkita/contracts`, `@rumahkita/ui`, `@rumahkita/typescript-config`, `@rumahkita/eslint-config` | Application |
| `apps/api` | `@rumahkita/contracts`, `@rumahkita/db`, `@rumahkita/typescript-config`, `@rumahkita/eslint-config` | Application |
| `apps/worker` | `@rumahkita/contracts`, `@rumahkita/db`, `@rumahkita/typescript-config`, `@rumahkita/eslint-config` | Application |
| `packages/db` | `@rumahkita/typescript-config`, `@rumahkita/eslint-config` | Package |
| `packages/contracts` | `@rumahkita/typescript-config`, `@rumahkita/eslint-config` | Package (Pure TS + Zod) |
| `packages/ui` | `@rumahkita/typescript-config`, `@rumahkita/eslint-config` | Package (React + Tailwind) |

### Workspace Configuration Files

#### `pnpm-workspace.yaml`
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

#### `.npmrc`
```ini
auto-install-peers=true
shamefully-hoist=false
strict-peer-dependencies=false
```

#### Root `package.json`
```json
{
  "name": "rumahkita-monorepo",
  "private": true,
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "test": "turbo test",
    "test:e2e": "turbo test:e2e",
    "db:generate": "pnpm --filter @rumahkita/db db:generate",
    "db:migrate": "pnpm --filter @rumahkita/db db:migrate",
    "db:push": "pnpm --filter @rumahkita/db db:push",
    "db:seed": "pnpm --filter @rumahkita/db db:seed",
    "db:studio": "pnpm --filter @rumahkita/db db:studio",
    "docker:up": "docker compose up -d",
    "docker:down": "docker compose down",
    "clean": "turbo clean && rimraf node_modules"
  },
  "devDependencies": {
    "turbo": "^2.1.0",
    "prettier": "^3.3.3",
    "rimraf": "^6.0.1",
    "typescript": "^5.6.2"
  },
  "packageManager": "pnpm@9.12.0",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

---

## 3. Turborepo Pipelines Specification (`turbo.json`)

Turborepo orchestrates execution order, caching, and environment variable hashing across all packages.

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [
    "**/.env.*local",
    "tsconfig.json"
  ],
  "globalEnv": [
    "NODE_ENV",
    "DATABASE_URL",
    "JWT_SECRET",
    "REFRESH_TOKEN_SECRET"
  ],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [
        ".next/**",
        "!.next/cache/**",
        "dist/**"
      ]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "test:e2e": {
      "cache": false
    },
    "@rumahkita/db#db:generate": {
      "cache": false
    },
    "@rumahkita/db#db:migrate": {
      "cache": false
    },
    "@rumahkita/db#db:seed": {
      "cache": false
    }
  }
}
```

---

## 4. Shared Contracts Architecture (`packages/contracts`)

`packages/contracts` is the **single source of truth** for runtime validation schemas and TypeScript types. Because it is isomorphic (no Node.js-only or browser-only APIs), it is imported directly by `apps/web` (React Hook Form + Zod), `apps/api` (NestJS Validation Pipe / DTOs), and `apps/worker`.

### Domain Schemas & Types

#### 1. Common Types & Enums
- **Pagination**:
  ```typescript
  export const paginationQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('desc'),
  });

  export const paginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
    z.object({
      data: z.array(itemSchema),
      meta: z.object({
        page: z.number().int(),
        limit: z.number().int(),
        total: z.number().int(),
        totalPages: z.number().int(),
      }),
    });
  ```
- **Monetary Representation**:
  In accordance with PRD §8, currency is strictly integer Rupiah stored as `numeric(14,0)`:
  ```typescript
  export const idrAmountSchema = z.coerce
    .number()
    .int('Nominal harus berupa bilangan bulat')
    .positive('Nominal harus lebih dari 0')
    .max(999_999_999_999, 'Nominal melebihi batas wajar');
  ```
- **Standard API Response Envelopes**:
  ```typescript
  export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
  }

  export interface ApiErrorResponse {
    success: false;
    statusCode: number;
    error: string;
    message: string | string[];
    details?: Record<string, string[]>;
  }
  ```

#### 2. Auth Domain
- `loginSchema`: `email` (valid email), `password` (min 8 chars)
- `loginResponseSchema`: `accessToken` (string), `user` (id, email, fullName, role, householdId)
- `inviteMemberSchema`: `email` (string), `role` (enum: `OWNER`, `MEMBER`)
- `forgotPasswordSchema`: `email` (string)
- `resetPasswordSchema`: `token` (string), `newPassword` (min 8 chars)

#### 3. Finance Domain (Incomes, Expenses, Master Data)
- `createIncomeSourceSchema`: `name` (min 2, max 50), `description` (optional)
- `createCategorySchema`: `name` (min 2, max 50), `type` (`INCOME` | `EXPENSE`), `icon` (optional)
- `createIncomeSchema`:
  - `date`: `z.string().date()` (YYYY-MM-DD)
  - `amount`: `idrAmountSchema`
  - `sourceId`: `z.string().uuid()`
  - `categoryId`: `z.string().uuid().optional()`
  - `notes`: `z.string().max(500).optional()`
- `createExpenseSchema`:
  - `date`: `z.string().date()`
  - `amount`: `idrAmountSchema`
  - `categoryId`: `z.string().uuid()` (mandatory)
  - `paymentMethod`: `z.enum(['CASH', 'TRANSFER', 'E_WALLET', 'OTHER']).optional()`
  - `notes`: `z.string().max(500).optional()`

#### 4. Inventory Domain
- `stockStatusEnum`: `z.enum(['SAFE', 'LOW', 'OUT'])` (Indonesian localized labels in UI: `Aman ✓`, `Menipis ⚠`, `Habis ✕`)
- `createItemSchema`:
  - `name`: `z.string().min(2).max(100)`
  - `category`: `z.string().max(50).optional()`
  - `unit`: `z.string().min(1).max(20)` (e.g. `pcs`, `kg`, `liter`, `pack`)
  - `quantityOnHand`: `z.coerce.number().int().min(0).default(0)`
  - `lowStockThreshold`: `z.coerce.number().int().min(0).default(2)`
  - `location`: `z.string().max(100).optional()`
  - `notes`: `z.string().max(500).optional()`
- `stockAdjustmentSchema`:
  - `quantityDelta`: `z.coerce.number().int()` (cannot result in final quantity < 0)
  - `reason`: `z.enum(['SPOILAGE', 'CONSUMPTION', 'COUNT_CORRECTION', 'LOSS', 'DONATION', 'OTHER'])`
  - `notes`: `z.string().min(3, 'Alasan koreksi stok wajib diisi').max(255)`

#### 5. Purchases Domain
- `purchaseItemInputSchema`:
  - `itemId`: `z.string().uuid()`
  - `quantity`: `z.coerce.number().int().positive()`
  - `unitPrice`: `idrAmountSchema`
- `createPurchaseSchema`:
  - `date`: `z.string().date()`
  - `storeName`: `z.string().max(100).optional()`
  - `categoryId`: `z.string().uuid()` (mandatory for generating the linked expense)
  - `paymentMethod`: `z.enum(['CASH', 'TRANSFER', 'E_WALLET', 'OTHER']).optional()`
  - `items`: `z.array(purchaseItemInputSchema).min(1, 'Minimal satu item pembelian')`
  - `notes`: `z.string().max(500).optional()`
- `completePurchaseSchema`:
  - `idempotencyKey`: `z.string().uuid()` (prevents duplicate submission)

#### 6. Debts & Receivables Domain
- `debtTypeEnum`: `z.enum(['PAYABLE', 'RECEIVABLE'])` (Hutang vs Piutang)
- `createDebtReceivableSchema`:
  - `type`: `debtTypeEnum`
  - `partyName`: `z.string().min(2).max(100)`
  - `description`: `z.string().max(255).optional()`
  - `principalAmount`: `idrAmountSchema`
  - `dueDate`: `z.string().date().optional()`
  - `notes`: `z.string().max(500).optional()`
- `createDebtPaymentSchema`:
  - `date`: `z.string().date()`
  - `amount`: `idrAmountSchema`
  - `notes`: `z.string().max(255).optional()`

#### 7. Dashboard & Reports Domain
- `dashboardQuerySchema`:
  - `period`: `z.enum(['THIS_MONTH', 'LAST_MONTH', 'THIS_YEAR', 'CUSTOM']).default('THIS_MONTH')`
  - `startDate`: `z.string().date().optional()`
  - `endDate`: `z.string().date().optional()`
- `reportFilterSchema`:
  - `year`: `z.coerce.number().int().min(2020).max(2099)`
  - `month`: `z.coerce.number().int().min(1).max(12).optional()`

---

## 5. Notification Worker Architecture (`apps/worker`)

The notification worker delivers asynchronous alerts when inventory drops below configured thresholds or is depleted.

### 5.1 Outbox Table Pattern & Concurrency Control

Events are written to `notification_events` inside the PostgreSQL database. The worker daemon executes a resilient polling loop.

#### Polling Query with `FOR UPDATE SKIP LOCKED`
To support zero duplicate deliveries and prevent race conditions between potential multiple worker instances, worker jobs select events using PostgreSQL row-level locks:

```sql
SELECT id, household_id, event_type, payload, attempts, max_attempts
FROM notification_events
WHERE status IN ('PENDING', 'FAILED')
  AND attempts < max_attempts
  AND (next_retry_at IS NULL OR next_retry_at <= NOW())
ORDER BY created_at ASC
LIMIT 10
FOR UPDATE SKIP LOCKED;
```

#### Event State Machine

```mermaid
stateDiagram-v2
    [*] --> PENDING: Created on Safe->Low Transition
    PENDING --> PROCESSING: Worker Locks Row
    PROCESSING --> SENT: Channel Deliveries Succeeded
    PROCESSING --> FAILED: Channel Error / Network Timeout
    FAILED --> PROCESSING: Retry Backoff Elapsed (attempts < 5)
    FAILED --> EXHAUSTED: attempts >= 5 (Dead Letter)
    SENT --> [*]
    EXHAUSTED --> [*]
```

### 5.2 Safe -> Low/Out Transition Logic (Deduplication)

Per PRD §6.10 & Acceptance Criteria, notifications must **not** spam users on every stock decrement if an item is already low.

```typescript
export interface StockThresholdEvaluation {
  shouldNotify: boolean;
  eventType: 'LOW_STOCK' | 'OUT_OF_STOCK' | null;
}

export function evaluateStockThresholdTransition(
  previousQuantity: number,
  newQuantity: number,
  threshold: number
): StockThresholdEvaluation {
  // Case 1: Out of stock transition
  if (previousQuantity > 0 && newQuantity === 0) {
    return { shouldNotify: true, eventType: 'OUT_OF_STOCK' };
  }

  // Case 2: Safe to Low stock transition
  if (previousQuantity > threshold && newQuantity <= threshold && newQuantity > 0) {
    return { shouldNotify: true, eventType: 'LOW_STOCK' };
  }

  // Case 3: Already low or out, and further reduced: DO NOT NOTIFY
  // Case 4: Stock replenished back above threshold: DO NOT NOTIFY
  return { shouldNotify: false, eventType: null };
}
```

### 5.3 Channel Adapters & Interfaces

```typescript
export interface NotificationRecipient {
  userId: string;
  email?: string;
  whatsappNumber?: string;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
}

export interface DeliveryResult {
  channel: 'EMAIL' | 'WHATSAPP';
  success: boolean;
  error?: string;
  messageId?: string;
}

export interface NotificationChannelAdapter {
  send(
    event: NotificationEventPayload,
    recipient: NotificationRecipient
  ): Promise<DeliveryResult>;
}
```

1. **Email Adapter (`EmailAdapter`)**:
   - Integration with Resend or SMTP.
   - For MVP dev/test: Logs formatted email payload to console and saves mock delivery record.
   - Body format: Clear HTML/text template with item name, current stock, threshold, and link to restock.
2. **WhatsApp Adapter (`WhatsAppAdapter`)**:
   - Integration with Meta WhatsApp Business Cloud API.
   - For MVP dev/test: Formats and logs to console:
     `[WhatsApp Stub] To: +628123456789 | Peringatan Stok RumahKita: Beras (5 kg) tersisa 1 kg (ambang batas: 2 kg). Harap segera restock.`

### 5.4 Retry Backoff Algorithm

When an adapter fails, an exponential backoff with jitter is applied:

$$\text{delaySeconds} = \min\left(1800, 10 \times 2^{\text{attempts}-1}\right) + \text{jitter}(0, 5)$$

- Attempt 1 failure: retry after ~10 seconds
- Attempt 2 failure: retry after ~20 seconds
- Attempt 3 failure: retry after ~40 seconds
- Attempt 4 failure: retry after ~80 seconds
- Attempt 5 failure: marked as `FAILED` / `EXHAUSTED`, no further automatic retry.

---

## 6. Docker Compose Configuration for PostgreSQL

The local development environment uses PostgreSQL 16 Alpine via Docker Compose.

### `docker-compose.yml`

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: rumahkita-postgres
    restart: unless-stopped
    ports:
      - '${POSTGRES_PORT:-5432}:5432'
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-rumahkita}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-rumahkita_dev_password}
      POSTGRES_DB: ${POSTGRES_DB:-rumahkita}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER:-rumahkita} -d ${POSTGRES_DB:-rumahkita}']
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - rumahkita-network

volumes:
  pgdata:
    name: rumahkita_pgdata

networks:
  rumahkita-network:
    name: rumahkita-network
    driver: bridge
```

---

## 7. Environment Variables & Configuration Sharing

### 7.1 Master `.env.example` Matrix

```bash
# ==============================================================================
# RumahKita Environment Configuration Template
# ==============================================================================

# Node Environment
NODE_ENV=development

# ------------------------------------------------------------------------------
# PostgreSQL Database Configuration
# ------------------------------------------------------------------------------
POSTGRES_USER=rumahkita
POSTGRES_PASSWORD=rumahkita_dev_password
POSTGRES_DB=rumahkita
POSTGRES_PORT=5432
DATABASE_URL=postgresql://rumahkita:rumahkita_dev_password@localhost:5432/rumahkita

# ------------------------------------------------------------------------------
# Backend API (apps/api)
# ------------------------------------------------------------------------------
API_PORT=4000
API_PREFIX=api/v1
CORS_ORIGIN=http://localhost:3000

# JWT & Authentication Secrets (PRD §11)
JWT_ACCESS_SECRET=dev_jwt_access_secret_super_secret_32_chars_min!
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=dev_jwt_refresh_secret_super_secret_32_chars_min!
JWT_REFRESH_EXPIRES_IN=7d

# Cookie Security
COOKIE_DOMAIN=localhost
COOKIE_SECURE=false

# ------------------------------------------------------------------------------
# Frontend Web (apps/web)
# ------------------------------------------------------------------------------
WEB_PORT=3000
# Internal URL for Next.js BFF server-side proxy
INTERNAL_API_URL=http://localhost:4000/api/v1
# Public URL for browser-side requests
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# ------------------------------------------------------------------------------
# Notification Worker (apps/worker)
# ------------------------------------------------------------------------------
WORKER_POLL_INTERVAL_MS=5000
WORKER_MAX_CONCURRENCY=5

# External Channel Providers (Stubbed for MVP development)
RESEND_API_KEY=re_dev_stub_key_12345
SMTP_HOST=localhost
SMTP_PORT=1025
WHATSAPP_API_TOKEN=wa_dev_stub_token_12345
WHATSAPP_PHONE_NUMBER_ID=100000000000000
```

### 7.2 Configuration Sharing & Startup Validation

Each app (`api`, `web`, `worker`) implements a strict schema validator at startup using Zod:

```typescript
// Example: apps/api/src/config/env.schema.ts
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  API_PORT: z.coerce.number().default(4000),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
});

export type Env = z.infer<typeof envSchema>;
```
If any required variable is omitted, the application fails immediately upon bootstrapping with a clear human-readable error, preventing silent failures.

---

## 8. End-to-End Testing Infrastructure Design

Following the Orchestrator's **Dual-Track Execution** model, testing is decoupled into an **Independent Opaque-Box E2E Testing Track** (Track A).

### 8.1 Testing Architecture & Test Runner

```mermaid
flowchart TD
    subgraph Test Runner Harness
        Runner["Test Runner (Playwright + Vitest)"]
        Fixtures["Deterministic Fixture Generator (Seed / Factory)"]
        DBCleaner["DB Transaction Cleaner / Test DB Reset"]
    end

    subgraph Target Under Test
        WebRunning["apps/web (http://localhost:3000)"]
        APIRunning["apps/api (http://localhost:4000/api/v1)"]
        WorkerRunning["apps/worker"]
        PGTest["PostgreSQL Test DB"]
    end

    Runner -->|"Opaque HTTP Calls"| APIRunning
    Runner -->|"Browser Actions (Playwright)"| WebRunning
    Fixtures -->|"Seed Scenarios"| PGTest
    DBCleaner -->|"Clean State"| PGTest
    APIRunning --> PGTest
    WorkerRunning --> PGTest
```

### 8.2 Test Tiers Specification

#### Tier 1: Feature Coverage (≥5 Tests Per Feature)
1. **Auth & Household**:
   - T1.1. Login with valid credentials returns 200, JWT access token, and sets `HttpOnly` refresh cookie.
   - T1.2. Login with invalid password returns 401 Unauthorized.
   - T1.3. POST `/auth/refresh` with valid cookie issues new rotated token pair.
   - T1.4. POST `/auth/logout` invalidates session; subsequent refresh attempt fails with 401.
   - T1.5. Cross-household data access attempt returns 403 Forbidden.
2. **Incomes**:
   - T1.6. Create income with valid data creates database record and returns 201.
   - T1.7. Create income with nominal $\le 0$ returns 422 Unprocessable Entity.
   - T1.8. Query incomes with date range filter returns only matching records.
   - T1.9. Incomes list pagination meta (page, limit, total, totalPages) is mathematically accurate.
   - T1.10. Idempotency key reuse on income creation returns cached response without duplicate row.
3. **Expenses**:
   - T1.11. Create expense with valid category and payment method succeeds.
   - T1.12. Create expense without mandatory category returns 422.
   - T1.13. Search expenses by keyword in notes filters correctly.
   - T1.14. Soft-delete / cancel expense preserves audit trail with `deleted_at`.
   - T1.15. Linked purchase expense is immutable to direct deletion.
4. **Inventory**:
   - T1.16. Create item with unit, initial stock, and threshold returns 201.
   - T1.17. Stock adjustment with valid reason updates quantity and appends stock movement log.
   - T1.18. Stock adjustment without mandatory reason field returns 422.
   - T1.19. Negative stock adjustment exceeding available inventory returns 422.
   - T1.20. Status calculation accurately returns `Aman` when $> \text{threshold}$, `Menipis` when $\le \text{threshold}$, and `Habis` when $= 0$.
5. **Purchases**:
   - T1.21. Create purchase draft computes item subtotals correctly on server.
   - T1.22. Purchase complete transaction creates 1 expense, increases inventory stock, and logs stock movements.
   - T1.23. Simulated failure during purchase complete rolls back all changes (0 rows created).
   - T1.24. Cancel completed purchase triggers documented reversal stock movement.
   - T1.25. Client-supplied total mismatch is overridden by server calculation.
6. **Debts & Receivables**:
   - T1.26. Create payable debt initializes remaining balance equal to principal.
   - T1.27. Recording partial payment reduces remaining balance by payment amount.
   - T1.28. Payment amount exceeding remaining balance returns 422.
   - T1.29. Debt past due date with remaining balance $> 0$ automatically returns status `Overdue`.
   - T1.30. Settling total balance sets status to `Settled`.
7. **Reports & Dashboard**:
   - T1.31. Dashboard total income equals sum of individual income records in period.
   - T1.32. Dashboard total expense equals sum of direct expenses + completed purchase expenses.
   - T1.33. Net cash flow equals total income minus total expense.
   - T1.34. Yearly report includes 12 calendar months with 0-value representation for inactive months.
   - T1.35. CSV export endpoint streams valid CSV RFC-4180 format with appropriate headers.
8. **Notifications**:
   - T1.36. Safe $\to$ Low transition inserts event into `notification_events`.
   - T1.37. Second purchase on already-low item produces no duplicate event.
   - T1.38. Worker picks pending event and marks status `PROCESSING` then `SENT`.
   - T1.39. User disabling email channel in preferences suppresses email adapter dispatch.
   - T1.40. Simulated channel network timeout triggers exponential retry backoff.

#### Tier 2: Boundary & Corner Cases (≥5 Tests Per Feature)
- T2.1. Maximum IDR amount boundary: 999,999,999,999 Rupiah handles without numeric overflow.
- T2.2. Stock adjustment reducing quantity to exactly 0 succeeds and marks status `Habis`.
- T2.3. Stock threshold boundary: stock equals threshold exactly triggers `Menipis` status and alert.
- T2.4. Date filters across midnight UTC vs Asia/Jakarta (UTC+7) boundary.
- T2.5. Leap year date filter (February 29) handled seamlessly.
- T2.6. Refresh token reuse attack: replaying an already-consumed refresh token immediately revokes the entire token family.
- T2.7. Payment amount equal to exact remaining balance down to 1 Rupiah transitions debt to `Settled`.
- T2.8. Empty string input for optional notes is normalized to null.

#### Tier 3: Cross-Feature Interactions
- T3.1. **Atomic Purchase Flow**:
  Executing `POST /purchases/:id/complete` with 3 items simultaneously:
  1. Inserts into `expenses` (linked to `purchase_id`).
  2. Inserts 3 rows into `stock_movements`.
  3. Updates 3 rows in `items` table.
  4. Evaluates thresholds and inserts into `notification_events` if an item crossed threshold.
  5. If an unhandled DB exception occurs at step 4, steps 1–3 are completely rolled back.
- T3.2. **Debt Payment vs Cash Flow**:
  Paying a debt updates the debt balance without double-counting as an operational expense in the monthly cash flow report unless specifically configured.
- T3.3. **Cross-Household Data Guard**:
  User A (Household 1) attempting to fetch, update, or delete User B's (Household 2) records gets 403 Forbidden across all endpoints.
- T3.4. **Auth Expiration & Auto-Refresh**:
  Expired access token triggers BFF refresh endpoint; browser transparently completes request with rotated credentials.

#### Tier 4: Real-World Persona Scenarios
- T4.1. **End-to-End Household Journey**:
  1. Owner logs in, creates household, and invites Member (Spouse).
  2. Member logs in using invitation credentials.
  3. Owner logs salary income (`Gaji`, Rp 15,000,000).
  4. Member configures inventory items: `Beras 5kg` (stock: 5, min: 2), `Minyak 2L` (stock: 3, min: 2).
  5. Member records purchase of `Gula 1kg` and `Kopi 250g` -> completes purchase -> expense and items recorded.
  6. Member records manual consumption of `Beras` reducing stock from 3 to 1 -> threshold crossed -> worker processes outbox alert.
  7. Owner logs family debt payable (`Pinjaman Renovasi`, Rp 5,000,000, due in 30 days) and records first payment of Rp 1,000,000.
  8. Both users review the Dashboard, inspect income vs expense chart, and export monthly CSV report.
  9. Verify CSV content matches exact transactional totals.

### 8.3 Playwright UI Testing Specification
- **Viewports Tested**:
  - Mobile Small: 360px $\times$ 740px
  - Mobile Standard: 390px $\times$ 844px (iPhone 14)
  - Tablet: 768px $\times$ 1024px
  - Desktop: 1280px $\times$ 800px & 1440px $\times$ 900px
- **UI Assertions**:
  - Add expense flow completes with sticky action buttons on 390px viewport without horizontal scrolling.
  - Transactions list displays as cards on mobile and as TanStack Table on desktop.
  - Neo-brutalism design tokens verified: border 2px solid `#171717`, hard shadow `4px 4px 0 #171717`, font Space Grotesk on headings, tabular numbers on IDR values.
  - Form validation errors render adjacent to the relevant input field with visible labels.

---

## 9. Implementation Sequence & Milestone Mapping

To ensure deterministic execution by implementation subagents, the technical milestones are sequenced as follows:

| Milestone | Deliverable Scope | Acceptance Gate |
|---|---|---|
| **M1: Monorepo Foundation** | Turborepo, pnpm workspace, `apps/` stubs, `packages/` scaffolding, Docker Compose PostgreSQL, root config. | `pnpm install && pnpm dev` starts all apps cleanly. |
| **M2: Database Schema & Drizzle ORM** | 18 PostgreSQL tables, UUID PKs, `numeric(14,0)`, pgEnums, audit columns, migrations, dev seeder. | `pnpm --filter @rumahkita/db db:migrate && pnpm --filter @rumahkita/db db:seed` executes cleanly. |
| **M3: Backend API (NestJS)** | `/api/v1` REST endpoints, JWT auth + refresh cookies, Argon2id, HouseholdGuard, CRUD, atomic purchase transactions, debts, reports, Swagger. | All Tier 1 & Tier 2 API tests pass 100%. |
| **M4: Frontend (Next.js App Router)** | Neo-brutalism design system (`packages/ui`), login, dashboard, income/expense/item/debt pages, mobile bottom nav, desktop sidebar, TanStack Table + Recharts. | Playwright responsive viewport tests pass across 390px and 1280px. |
| **M5: Notification Worker & E2E Hardening** | Outbox consumer daemon, threshold transition deduplication, email/WhatsApp adapters, retry backoff, full Tier 1–4 E2E test suite. | 100% of Tier 1-4 tests passing, zero regression, auditor verification approval. |

---

## 10. Conclusion

The architecture specified above provides a rock-solid, production-grade foundation for the RumahKita MVP. By enforcing shared contracts via `packages/contracts`, isolating data via PostgreSQL `household_id` constraints, ensuring transactional atomicity across finance and inventory, and separating outbox notification delivery into an asynchronous worker daemon, the system satisfies all PRD and design requirements with high reliability and developer velocity.
