# Architectural Specification: NestJS Backend API (`apps/api`)
**Milestone**: Milestone 3 — Backend API (`/api/v1`)  
**Author**: Explorer 1 (NestJS Architecture Explorer)  
**Date**: 2026-10-27  
**Status**: APPROVED ARCHITECTURAL BLUEPRINT  

---

## 1. Executive Summary & Architectural Goals

The RumahKita Backend API is a high-reliability, multi-tenant RESTful service implemented with **NestJS 10+**, **Drizzle ORM**, and **PostgreSQL 16**. It acts as the business engine for household finance and inventory tracking, serving web clients (Next.js BFF proxy) and conforming to strict opaque-box integration tests.

### Primary Architectural Invariants
1. **Multi-Tenant Isolation**: Every financial and inventory record is partitioned by `household_id`. Every query and mutation MUST verify household membership; unauthorized cross-household access returns HTTP `403 Forbidden` (or `404 Not Found`).
2. **Defensive Error Handling & Contract Enveloping**:
   - Success responses wrap payloads in `{ success: true, data: T, meta?: PaginationMeta }`.
   - Error responses strictly conform to `{ success: false, statusCode: number, error: string, message: string, details?: Array<{ field?: string, issue: string }> }`.
   - Zero leakage: PostgreSQL error codes, internal stack traces, and database schemas are never exposed to clients.
3. **Transaction Safety & Atomicity**: Multi-entity mutations (such as purchase completion: expense + stock movement + inventory update) are executed inside atomic PostgreSQL transactions (`db.transaction`) with pessimistic row locking (`FOR UPDATE`) and idempotency key support.
4. **Outbox-Based Event Sourcing**: Stock threshold crossings (transitioning from `Safe` to `Low` or `Out`) produce deduplicated transactional outbox events in `notification_events` for consumption by the worker daemon.
5. **Exact E2E Compatibility**: The API adheres 100% to the expectations of the 56 opaque-box tests in `tests/e2e/`.

---

## 2. Target File & Module Structure

```text
apps/api/src/
├── main.ts                                  # App bootstrap, CORS, CookieParser, global pipes, filters, Swagger
├── app.module.ts                            # Root module importing all core & feature modules
├── common/                                  # Shared cross-cutting concerns
│   ├── constants/
│   │   └── tokens.ts                        # DI tokens (DB_CLIENT, QUERY_CLIENT)
│   ├── decorators/
│   │   ├── current-user.decorator.ts        # @CurrentUser()
│   │   ├── current-household.decorator.ts   # @CurrentHousehold(), @CurrentHouseholdId()
│   │   ├── roles.decorator.ts               # @Roles('owner' | 'member')
│   │   ├── public.decorator.ts              # @Public() bypasses JWT guard
│   │   └── idempotency-key.decorator.ts     # @IdempotencyKey()
│   ├── filters/
│   │   └── http-exception.filter.ts         # Global exception filter (Zod, Postgres, HttpException)
│   ├── guards/
│   │   ├── jwt-auth.guard.ts                # Bearer JWT verification & user resolution
│   │   ├── household.guard.ts               # Tenant household membership guard
│   │   └── roles.guard.ts                   # Role-based access control (owner vs member)
│   ├── interceptors/
│   │   ├── transform.interceptor.ts         # Envelopes responses into { success: true, data, meta }
│   │   └── logging.interceptor.ts           # Observability, request timing, sanitization
│   └── pipes/
│       └── zod-validation.pipe.ts           # Isomorphic schema validation against @rumahkita/contracts
├── modules/
│   ├── db/                                  # Database Module
│   │   ├── db.module.ts                     # Global module providing DB_CLIENT with graceful shutdown
│   │   └── db.provider.ts                   # createDatabaseClient wrapper & types
│   ├── auth/                                # Authentication Module
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts               # /auth/login, /auth/refresh, /auth/logout, /auth/logout-all, password reset
│   │   ├── auth.service.ts                  # Argon2id verification, JWT generation, token family reuse detection
│   │   └── strategies/
│   │       └── jwt.strategy.ts              # Passport JWT strategy or lightweight verification
│   ├── household/                           # Household Profile & Members Module
│   │   ├── household.module.ts
│   │   ├── household.controller.ts          # GET /household
│   │   └── household.service.ts
│   ├── master-data/                         # Categories & Income Sources Module
│   │   ├── master-data.module.ts
│   │   ├── income-sources.controller.ts     # /income-sources (CRUD)
│   │   ├── categories.controller.ts         # /income-categories & /expense-categories (CRUD)
│   │   └── master-data.service.ts
│   ├── incomes/                             # Incomes Module
│   │   ├── incomes.module.ts
│   │   ├── incomes.controller.ts            # /incomes (CRUD, date filters, pagination)
│   │   └── incomes.service.ts
│   ├── expenses/                            # Expenses Module
│   │   ├── expenses.module.ts
│   │   ├── expenses.controller.ts           # /expenses (CRUD, category filter, pagination)
│   │   └── expenses.service.ts
│   ├── inventory/                           # Inventory & Stock Adjustments Module
│   │   ├── inventory.module.ts
│   │   ├── inventory.controller.ts          # /items (CRUD, stock status), /items/:id/stock-adjustments
│   │   └── inventory.service.ts             # Atomicity, FOR UPDATE locks, outbox event generation
│   ├── purchases/                           # Purchases Module
│   │   ├── purchases.module.ts
│   │   ├── purchases.controller.ts          # /purchases (drafts, items, complete, cancel)
│   │   └── purchases.service.ts             # Atomic completion, idempotency key replay, stock increment
│   ├── debts/                               # Debts & Receivables Module
│   │   ├── debts.module.ts
│   │   ├── debts.controller.ts              # /debts-receivables, /debts-receivables/:id/payments
│   │   └── debts.service.ts                 # Balance check, payment deductions, overdue status computation
│   ├── reports/                             # Dashboard & Reports Module
│   │   ├── reports.module.ts
│   │   ├── reports.controller.ts            # /dashboard, /reports/monthly, /reports/yearly, /reports/export/csv
│   │   └── reports.service.ts               # Financial aggregations, 12-month zero continuity, RFC 4180 CSV
│   └── notifications/                       # Notification Settings Module
│       ├── notifications.module.ts
│       ├── notifications.controller.ts      # /settings/notifications (GET, PUT)
│       └── notifications.service.ts
```

---

## 3. App Bootstrap & Lifecycle Architecture (`apps/api/src/main.ts`)

### 3.1 Bootstrap Configuration Design
```typescript
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // 1. Enable Shutdown Hooks for graceful database disconnection
  app.enableShutdownHooks();

  // 2. Cookie Parser for reading HttpOnly refreshToken
  app.use(cookieParser());

  // 3. Global REST API Prefix: /api/v1
  const apiPrefix = process.env.API_PREFIX || 'api/v1';
  app.setGlobalPrefix(apiPrefix, {
    exclude: ['health'], // /health is accessible directly
  });

  // 4. CORS Configuration
  const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or opaque E2E runner)
      if (!origin || origin === allowedOrigin || origin === 'http://localhost:3001') {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in development
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Household-Id', 'Idempotency-Key', 'Accept'],
    exposedHeaders: ['Content-Disposition'],
  });

  // 5. Global Interceptors & Exception Filters
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // 6. OpenAPI / Swagger Setup at /api/docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('RumahKita REST API')
    .setDescription('Private Household Finance & Inventory Management REST API')
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .addApiKey({ type: 'apiKey', name: 'X-Household-Id', in: 'header' }, 'household-id')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  // 7. Dynamic Port Binding (Default 3001 to align with E2E runner default)
  const port = process.env.API_PORT || process.env.PORT || 3001;
  await app.listen(port);
  console.log(`[RumahKita API] Running at http://localhost:${port}/${apiPrefix}`);
  console.log(`[RumahKita API] Swagger Docs at http://localhost:${port}/api/docs`);
}

bootstrap();
```

### 3.2 Global Validation Pipe (`ZodValidationPipe`)
The pipe validates incoming HTTP body, query, and params against Zod schemas from `@rumahkita/contracts`. On failure, it throws an unprocessable entity exception formatted for the error filter:

```typescript
import { PipeTransform, ArgumentMetadata, Injectable, UnprocessableEntityException, BadRequestException } from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema?: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    const targetSchema = this.schema;
    if (!targetSchema) return value;

    const result = targetSchema.safeParse(value);
    if (!result.success) {
      const details = result.error.errors.map((err) => ({
        field: err.path.join('.'),
        issue: err.message,
      }));
      // Standardize 422 for validation rejections per acceptance criteria
      throw new UnprocessableEntityException({
        message: 'Validation failed',
        details,
      });
    }

    return result.data;
  }
}
```

### 3.3 Global Error Envelope Filter (`HttpExceptionFilter`)
Adheres strictly to the contract error envelope format:
```json
{
  "success": false,
  "statusCode": 422,
  "error": "Unprocessable Entity",
  "message": "Validation failed",
  "details": [
    { "field": "nominal", "issue": "Nominal harus lebih dari 0" }
  ]
}
```

```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response, Request } from 'express';
import { ZodError } from 'zod';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'Internal Server Error';
    let message = 'Terjadi kesalahan pada server';
    let details: Array<{ field?: string; issue: string }> = [];

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
        error = exception.name.replace('Exception', '');
      } else if (typeof res === 'object' && res !== null) {
        const obj = res as any;
        message = obj.message || exception.message;
        error = obj.error || exception.name.replace('Exception', '');
        if (Array.isArray(obj.details)) {
          details = obj.details;
        } else if (Array.isArray(obj.message)) {
          details = obj.message.map((m: string) => ({ issue: m }));
          message = 'Validation failed';
        }
      }
    } else if (exception instanceof ZodError) {
      statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
      error = 'Unprocessable Entity';
      message = 'Validation failed';
      details = exception.errors.map((e) => ({
        field: e.path.join('.'),
        issue: e.message,
      }));
    } else if ((exception as any)?.code) {
      // PostgreSQL Error Mapping (Never leak raw SQL or schema)
      const pgCode = (exception as any).code;
      if (pgCode === '23505') {
        // Unique violation
        statusCode = HttpStatus.CONFLICT;
        error = 'Conflict';
        message = 'Data sudah terdaftar dalam sistem';
      } else if (pgCode === '23514') {
        // Check constraint violation
        statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
        error = 'Unprocessable Entity';
        message = 'Nilai data melanggar batasan bisnis database';
      } else if (pgCode === '23503') {
        // Foreign key violation
        statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
        error = 'Unprocessable Entity';
        message = 'Relasi data tidak ditemukan atau tidak valid';
      } else {
        this.logger.error(`PostgreSQL Error [${pgCode}]: ${(exception as any).message}`, (exception as any).stack);
      }
    } else {
      this.logger.error(`Unhandled Exception: ${(exception as any)?.message}`, (exception as any)?.stack);
    }

    response.status(statusCode).json({
      success: false,
      statusCode,
      error,
      message,
      ...(details.length > 0 ? { details, errors: details } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
```

### 3.4 Global Response Transform Interceptor
Standardizes success payloads while preserving raw responses (such as CSV text streams):
```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const res = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((data) => {
        // Bypass envelope for binary streams, CSV exports, or null responses
        if (data === null || data === undefined) return data;
        if (typeof data === 'string' && res.getHeader('content-type')?.includes('text/csv')) {
          return data;
        }

        // If data already contains a formatted structure with meta
        if (typeof data === 'object' && 'data' in data && 'meta' in data) {
          return {
            success: true,
            data: data.data,
            meta: data.meta,
          };
        }

        // Standard envelope
        return {
          success: true,
          data,
        };
      })
    );
  }
}
```

---

## 4. Database Module Architecture (`apps/api/src/modules/db/`)

The database module wraps `@rumahkita/db` as a first-class NestJS provider with lifecycle awareness.

### 4.1 Injection Tokens & Provider Definition
```typescript
// apps/api/src/common/constants/tokens.ts
export const DB_CLIENT = Symbol('DB_CLIENT');
export const QUERY_CLIENT = Symbol('QUERY_CLIENT');
```

```typescript
// apps/api/src/modules/db/db.provider.ts
import { Provider } from '@nestjs/common';
import { createDatabaseClient, DbClient } from '@rumahkita/db';
import { DB_CLIENT, QUERY_CLIENT } from '../../common/constants/tokens.js';

export const databaseProviders: Provider[] = [
  {
    provide: 'DB_CONNECTION',
    useFactory: () => {
      const client = createDatabaseClient({
        connectionString: process.env.DATABASE_URL,
        maxConnections: Number(process.env.DB_POOL_MAX || 15),
      });
      return client;
    },
  },
  {
    provide: DB_CLIENT,
    useFactory: (conn: ReturnType<typeof createDatabaseClient>): DbClient => conn.db,
    inject: ['DB_CONNECTION'],
  },
  {
    provide: QUERY_CLIENT,
    useFactory: (conn: ReturnType<typeof createDatabaseClient>) => conn.queryClient,
    inject: ['DB_CONNECTION'],
  },
];
```

### 4.2 Module & Graceful Shutdown
```typescript
// apps/api/src/modules/db/db.module.ts
import { Global, Module, OnApplicationShutdown, Inject } from '@nestjs/common';
import { databaseProviders } from './db.provider.js';
import { QUERY_CLIENT } from '../../common/constants/tokens.js';

@Global()
@Module({
  providers: [...databaseProviders],
  exports: [...databaseProviders],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(QUERY_CLIENT) private readonly queryClient: any) {}

  async onApplicationShutdown(signal?: string) {
    console.log(`[DbModule] Closing PostgreSQL connection pool (signal: ${signal})...`);
    await this.queryClient.end();
  }
}
```

### 4.3 Safe Transaction & Row-Locking Pattern
NestJS service methods inject `@Inject(DB_CLIENT) private readonly db: DbClient` and execute atomic transactions directly:
```typescript
// Pattern for critical business workflows (e.g. stock deduction / debt payment)
await this.db.transaction(async (tx) => {
  // 1. Pessimistic lock row to avoid race condition
  const [lockedItem] = await tx
    .select()
    .from(schema.items)
    .where(and(eq(schema.items.id, itemId), eq(schema.items.householdId, householdId)))
    .for('update');

  if (!lockedItem) {
    throw new NotFoundException('Barang tidak ditemukan');
  }

  const newQty = lockedItem.quantityOnHand + delta;
  if (newQty < 0) {
    throw new UnprocessableEntityException('Pengurangan melebihi stok yang ada');
  }

  // 2. Update parent
  await tx
    .update(schema.items)
    .set({ quantityOnHand: newQty })
    .where(eq(schema.items.id, itemId));

  // 3. Log movement
  await tx.insert(schema.stockMovements).values({
    householdId,
    itemId,
    quantityDelta: delta,
    resultingQuantity: newQty,
    reason: 'manual_correction',
    notes: reason,
    createdBy: userId,
  });
});
```

---

## 5. Security, Authentication & Multi-Tenancy Architecture

### 5.1 Dual-Token Pattern & Token Family Rotation
- **Access Token**: Short-lived (15 minutes), signed with `JWT_SECRET`. Contains claims `{ sub: userId, email, householdId, role }`.
- **Refresh Token**: Long-lived (7 days), stored in an `HttpOnly`, `SameSite=Lax`, `Path=/` cookie named `refreshToken`.
- **Token Family Reuse Detection**:
  1. Every issued refresh token is hashed (SHA-256) and recorded in `refresh_sessions` with a `family_id` (UUID).
  2. When `/auth/refresh` is called:
     - If the token hash exists and `is_revoked === false` and `expires_at > now()`:
       - The current session is marked `is_revoked = true`.
       - A new session is generated with a new token under the **same `family_id`**.
       - New cookie and access token are returned.
     - If the token hash is already revoked or expired:
       - **REPLAY ATTACK DETECTED**: Revoke ALL sessions belonging to this `family_id`.
       - Clear cookie and reject with HTTP 401 Unauthorized.

### 5.2 Password Security
Passwords are hashed using **Argon2id** via `@node-rs/argon2` with RFC 9106 recommended parameters:
- `memoryCost`: 65536 KB (64 MB)
- `timeCost`: 3 iterations
- `parallelism`: 4 threads
- Direct verification: `await argon2.verify(user.passwordHash, plainPassword)`

### 5.3 Guards & Tenant Isolation Pipeline

1. **`JwtAuthGuard`**:
   - Extracts Bearer token from `Authorization` header.
   - Bypasses routes decorated with `@Public()`.
   - Validates signature and expiration; attaches `{ id: sub, email, householdId, role }` to `req.user`.
   - If missing or invalid: throws `UnauthorizedException` (401).

2. **`HouseholdGuard`**:
   - Ensures `req.user.householdId` exists and resolves the household entity.
   - Sets `req.household = { id, name, role }`.
   - In controllers and services, every SELECT, UPDATE, and DELETE query MUST include:
     `eq(schema.<table_name>.householdId, req.household.id)`
   - Any attempt to access a resource whose `household_id !== req.household.id` returns `403 Forbidden` (or `404 Not Found`).

3. **`RolesGuard`**:
   - Reads metadata set by `@Roles('owner' | 'member')`.
   - Verifies `req.household.role` against required roles.
   - If unauthorized: throws `ForbiddenException` (403).

### 5.4 Common Decorators
- `@CurrentUser()`: `(data, ctx) => ctx.switchToHttp().getRequest().user`
- `@CurrentHousehold()`: `(data, ctx) => ctx.switchToHttp().getRequest().household`
- `@CurrentHouseholdId()`: `(data, ctx) => ctx.switchToHttp().getRequest().household.id`
- `@Public()`: `SetMetadata('isPublic', true)`
- `@Roles(...roles: ('owner' | 'member')[])`: `SetMetadata('roles', roles)`
- `@IdempotencyKey()`: `(data, ctx) => ctx.switchToHttp().getRequest().headers['idempotency-key']`

---

## 6. Domain Feature Modules Specification

### 6.1 Authentication Module (`/api/v1/auth`)
| Route | Method | Auth | Body / Params | Expected Response | Error Statuses |
|---|---|---|---|---|---|
| `/auth/login` | POST | Public | `LoginInput` `{ email, password }` | 200 `{ accessToken, user: { id, email, fullName }, household: { id, name, role } }` + Cookie `refreshToken` | 401 (invalid credentials), 422 (format error) |
| `/auth/refresh` | POST | Public (Cookie) | Reads cookie `refreshToken` | 200 `{ accessToken }` + Rotated Cookie `refreshToken` | 401 (expired, revoked, or reused token) |
| `/auth/logout` | POST | Public / Token | Reads cookie or token | 200 `{ message: 'Logged out successfully' }` + Cleared cookie | 200 |
| `/auth/logout-all` | POST | Bearer | none | 200 `{ message: 'All sessions logged out' }` | 401 |
| `/auth/password/forgot` | POST | Public | `{ email }` | 200 `{ message: 'Password reset link sent if account exists' }` | 422 |
| `/auth/password/reset` | POST | Public | `{ token, newPassword }` | 200 `{ message: 'Password reset successful' }` | 400, 422 |

### 6.2 Household Module (`/api/v1/household`)
| Route | Method | Auth | Response Payload |
|---|---|---|---|
| `/household` | GET | Bearer | 200 `{ id, name, currency: 'IDR', timezone: 'Asia/Jakarta', members: [{ id, userId, role, email, fullName, joinedAt }] }` |

### 6.3 Master Data Module (`/api/v1/*`)
- `/income-sources`:
  - `GET`: Lists active income sources for household (`deleted_at IS NULL`).
  - `POST`: Creates income source (201). Name must be unique per household.
  - `PUT /:id`: Updates source name, description, `isActive` (200).
  - `DELETE /:id`: Soft delete (`deleted_at = now()`) (200 or 204).
- `/income-categories`:
  - `GET`, `POST` (201), `PUT /:id` (200), `DELETE /:id` (200/204).
- `/expense-categories`:
  - `GET`, `POST` (201, accepts `budgetLimit`), `PUT /:id` (200), `DELETE /:id` (200/204).

### 6.4 Incomes Module (`/api/v1/incomes`)
- `POST /incomes`:
  - Validates `date`, `nominal > 0`, `sourceId` (UUID, must belong to household).
  - Handles nominal up to `999,999,999,999`. Nominal `<= 0` returns 422.
  - Returns 201 `{ id, nominal, date, sourceId, categoryId, notes }`.
- `GET /incomes`:
  - Query: `page`, `limit`, `startDate`, `endDate`, `sourceId`, `categoryId`.
  - Filters by `householdId` and `deleted_at IS NULL`.
  - Returns 200 `{ data: [...], meta: { page, limit, total, totalPages } }`.
- `PUT /incomes/:id`: Updates fields (200). Cross-household returns 403/404.
- `DELETE /incomes/:id`: Soft delete (200/204).

### 6.5 Expenses Module (`/api/v1/expenses`)
- `POST /expenses`:
  - Validates `date`, `nominal > 0`, `categoryId` (**mandatory**, returns 422 if omitted), `paymentMethod` (`'cash' | 'transfer' | 'credit_card' | 'ewallet'`).
  - Returns 201 `{ id, nominal, categoryId, paymentMethod, notes }`.
- `GET /expenses`:
  - Query: `page`, `limit`, `categoryId`, `startDate`, `endDate`.
  - Returns 200 `{ data: [...], meta: { page, limit, total, totalPages } }`.
- `PUT /expenses/:id`: Updates fields (200).
- `DELETE /expenses/:id`: Soft delete (200/204).

### 6.6 Inventory Module (`/api/v1/items`)
- `POST /items`:
  - Validates `name`, `unit`, `quantityOnHand` (>= 0), `lowStockThreshold` (>= 0).
  - Evaluates dynamic stock status:
    - `quantityOnHand <= 0` -> `'Habis'`
    - `quantityOnHand <= lowStockThreshold` -> `'Menipis'`
    - `quantityOnHand > lowStockThreshold` -> `'Aman'`
  - Returns 201 `{ id, name, unit, quantityOnHand, lowStockThreshold, status: 'Aman' | 'Menipis' | 'Habis' }`.
- `GET /items`:
  - Query: `status`, `category`, `search`, `page`, `limit`.
  - Returns 200 `{ data: [...with status], meta }`.
- `GET /items/:id`: Returns single item with status.
- `POST /items/:id/stock-adjustments`:
  - Body: `{ delta: number (non-zero), reason: string (min 3 chars) }`.
  - Missing or invalid reason -> 422.
  - `quantityOnHand + delta < 0` -> 422 ("Stock cannot go below zero").
  - Inside PostgreSQL transaction with `SELECT ... FOR UPDATE`:
    1. Lock item row.
    2. Compute `newQuantity = quantityOnHand + delta`.
    3. Update `items.quantityOnHand`.
    4. Insert `stock_movements`: `{ quantityDelta: delta, resultingQuantity: newQuantity, reason: 'manual_correction', notes: reason }`.
    5. Evaluate threshold transition using `evaluateStockThresholdTransition(prev, new, threshold)`.
    6. If `shouldNotify`: insert into `notification_events` outbox with channel preferences.
  - Returns 200 `{ newQuantity, status: 'Aman' | 'Menipis' | 'Habis', movementId }`.
- `GET /items/:id/stock-adjustments`:
  - Returns 200 `{ data: [{ quantityDelta, resultingQuantity, reason, notes, createdAt }] }`.

### 6.7 Purchases Module (`/api/v1/purchases`)
- `POST /purchases`:
  - Body: `{ date, vendor?, expenseCategoryId, paymentMethod, notes?, items: [{ itemId?, itemName, quantity, unitPrice }] }`.
  - Computes `totalAmount = sum(item.quantity * item.unitPrice)`.
  - Creates record in `purchases` with status `'draft'` and child items in `purchase_items`.
  - Returns 201 `{ id, status: 'draft', totalAmount, items: [...] }`.
- `POST /purchases/:id/complete`:
  - Headers: `Idempotency-Key` (optional string).
  - Idempotency & State Rules:
    - If purchase status is already `'completed'`:
      - If `idempotencyKey` matches `purchase.idempotencyKey`: return 200 with cached result.
      - If no idempotency key or different key: return HTTP 400 Bad Request ("Purchase is already completed").
  - Atomic Transaction (`db.transaction`):
    1. Lock purchase row with `FOR UPDATE`. Verify status is `'draft'`.
    2. Create corresponding `expenses` row:
       - `nominal: purchase.totalAmount`
       - `categoryId: purchase.expenseCategoryId`
       - `purchaseId: purchase.id`
       - `date: purchase.date`
       - `paymentMethod: purchase.paymentMethod`
       - `notes: purchase.notes || 'Pembelian ' + (purchase.vendor || '')`
    3. For every item with `itemId !== null`:
       - Lock item with `FOR UPDATE`.
       - `newQuantity = item.quantityOnHand + purchaseItem.quantity`.
       - Update `items.quantityOnHand = newQuantity`.
       - Insert `stock_movements`: `{ quantityDelta: quantity, resultingQuantity: newQuantity, reason: 'purchase', referenceId: purchase.id, notes: 'Pembelian dari ' + purchase.vendor }`.
    4. Update purchase status to `'completed'`, `completedAt = new Date()`, `idempotencyKey = headerKey`.
  - Returns 200 `{ id, status: 'completed', expenseId, totalAmount, completedAt }`.
- `POST /purchases/:id/cancel`:
  - Body: `{ reason }`. Status transitions to `'cancelled'`. Returns 200.

### 6.8 Debts & Receivables Module (`/api/v1/debts-receivables`)
- `POST /debts-receivables`:
  - Body: `{ type: 'payable' | 'receivable', partyName, description?, principalAmount, dueDate?, notes? }`.
  - Initializes `remainingBalance = principalAmount`, `status = 'open'`.
  - Returns 201 `{ id, type, principalAmount, remainingBalance, status: 'open', dueDate }`.
- `GET /debts-receivables/:id`:
  - Dynamically computes status:
    - If `remainingBalance == 0` -> `'settled'`
    - Else if `dueDate && dueDate < today` -> `'overdue'`
    - Else if `remainingBalance < principalAmount` -> `'partially_paid'`
    - Else -> `'open'`
  - Returns 200 with calculated status and payment history.
- `POST /debts-receivables/:id/payments`:
  - Body: `{ paymentDate, amount > 0, paymentMethod?, notes? }`.
  - Amount `<= 0` returns 422.
  - Inside PostgreSQL transaction with `SELECT ... FOR UPDATE`:
    - If `amount > remainingBalance`: return 422 ("Payment exceeds remaining balance").
    - `newBalance = remainingBalance - amount`.
    - `newStatus = newBalance === 0 ? 'settled' : 'partially_paid'`.
    - Insert `debt_receivable_payments`.
    - Update `debts_receivables` with `remainingBalance = newBalance` and `status = newStatus`.
  - Returns 200 `{ paymentId, remainingBalance: newBalance, status: newStatus }`.

### 6.9 Reports & Dashboard Module (`/api/v1/reports`, `/api/v1/dashboard`)
- `GET /dashboard`:
  - Query: `period` (`'this_month' | 'last_month' | 'this_year' | 'custom'`). Preprocess case-insensitively.
  - Aggregates income, expense (including purchase expenses), and `netCashFlow = income - expense`.
  - Fetches `recentTransactions` (latest 10 merged incomes & expenses sorted desc by date).
  - Fetches `lowStockItems` (`quantityOnHand <= lowStockThreshold`). Format: `{ id, name, unit, currentStock: quantityOnHand, lowStockThreshold, status: 'Menipis' | 'Habis' }`.
  - Response matches both root and nested test assertions:
    ```json
    {
      "success": true,
      "data": {
        "period": "THIS_MONTH",
        "startDate": "2026-10-01",
        "endDate": "2026-10-31",
        "totalIncome": 15000000,
        "totalExpense": 1100000,
        "netCashFlow": 13900000,
        "summaryCards": {
          "totalIncome": 15000000,
          "totalExpense": 1100000,
          "netCashFlow": 13900000
        },
        "recentTransactions": [...],
        "lowStockItems": [...]
      }
    }
    ```
- `GET /reports/monthly`:
  - Query: `year`, `month`.
  - Returns 200 `{ year, month, totalIncome, totalExpense, netCashFlow, expenseByCategory: [...], incomeBySource: [...], dailyTrend: [...] }`.
- `GET /reports/yearly`:
  - Query: `year`.
  - Returns exactly 12 calendar months with zero continuity. If no transactions exist for a month, income = 0, expense = 0, net = 0.
  - Returns both `monthlyTrends` and `monthlyTrend` alias in response data:
    ```json
    {
      "year": 2026,
      "totalIncome": 15000000,
      "totalExpense": 1100000,
      "netCashFlow": 13900000,
      "monthlyTrends": [
        { "month": 1, "monthName": "Januari", "income": 0, "expense": 0, "net": 0 },
        ...
        { "month": 10, "monthName": "Oktober", "income": 15000000, "expense": 1100000, "net": 13900000 },
        ...
        { "month": 12, "monthName": "Desember", "income": 0, "expense": 0, "net": 0 }
      ]
    }
    ```
- `GET /reports/export/csv`:
  - Query: `type` (`'transactions' | 'incomes' | 'expenses'`).
  - Response Headers:
    - `Content-Type: text/csv; charset=utf-8`
    - `Content-Disposition: attachment; filename="transaksi-rumahkita.csv"`
  - Body: RFC 4180 compliant CSV stream with header line:
    `Tanggal,Tipe,Kategori/Sumber,Nominal,Metode Pembayaran,Catatan`

### 6.10 Notifications Settings Module (`/api/v1/settings/notifications`)
- `GET /settings/notifications`: Returns preferences for authenticated user/household `{ emailEnabled, emailAddress, whatsappEnabled, whatsappNumber }`.
- `PUT /settings/notifications`: Updates notification channels and addresses (200).

---

## 7. E2E Test Compatibility Matrix & Verification Guide

This matrix maps every single test in `tests/e2e/` to the architectural mechanism fulfilling it:

| Test ID | Test Name | Key Assertions / Requirements | Architectural Fulfill Mechanism |
|---|---|---|---|
| **T1.1** | Login valid credentials | 200 OK, `accessToken`, `user.email`, `household.id`, `Set-Cookie: refreshToken` | `AuthController.login`, Argon2id match, cookie `refreshToken` HttpOnly |
| **T1.2** | Login invalid password | 401 Unauthorized, `success: false`, `message` present | `AuthService.login` verifies Argon2id hash; throws `UnauthorizedException` |
| **T1.3** | Token refresh rotation | 200 OK, new `accessToken`, rotated `refreshToken` cookie != initial | `AuthController.refresh`, marks old session revoked, generates new session |
| **T1.4** | Logout revokes session | 200 OK on logout; subsequent refresh returns 401 | `AuthController.logout` sets `is_revoked = true` on session row |
| **T1.5** | Logout-all | 200 OK, terminates all user sessions | `AuthController.logoutAll` sets `is_revoked = true` on `userId = req.user.id` |
| **T1.6** | Forgot password generic | 200 OK, `success: true` without leaking existence | `AuthController.forgotPassword` returns constant 200 |
| **T1.7** | Household profile | 200 OK, `data.id`, `data.members` array >= 1 | `HouseholdController.getHousehold`, joins `household_members` with `users` |
| **T1.8-T1.10** | Master data CRUD | 201 on create, 200 on list/update, 200/204 on soft delete | `MasterDataController`, soft delete sets `deleted_at = now()` |
| **T1.11-T1.14** | Incomes CRUD & filter | 201 on create, nominal matches, date range filter, pagination meta | `IncomesController`, pagination helper returning `data` and `meta` |
| **T1.15-T1.17** | Expenses CRUD & filter | 201 on create, categoryId mandatory, category filter | `ExpensesController`, Zod validation schema requiring `categoryId` |
| **T1.18-T1.20** | Inventory & status | Status evaluates to `'Aman'`, `'Menipis'`, `'Habis'`; adjustments delta -2 updates qty & logs movement | `InventoryService.calculateStatus` returning Indonesian labels |
| **T1.21-T1.22** | Purchases draft & cancel | Server computes `totalAmount`, cancel sets status `'cancelled'` | `PurchasesService.create` sums `quantity * unitPrice` |
| **T1.23-T1.24** | Debts & payments | Balance equals principal initially; partial payment decrements balance | `DebtsService.recordPayment` updates remaining balance atomically |
| **T1.25** | Dashboard summary | Returns `summaryCards.totalIncome`, `totalExpense`, `netCashFlow`, `recentTransactions`, `lowStockItems` | `ReportsService.getDashboard` maps metrics into both root and `summaryCards` |
| **T1.26** | Monthly report | Returns category breakdowns and cash flow | `ReportsService.getMonthlyReport` group by category & source |
| **T1.27** | Yearly report | Returns exactly 12 months with zero continuity in `monthlyTrends` | `ReportsService.getYearlyReport` generates 12 calendar slots |
| **T1.28** | CSV export | 200 OK, `Content-Type: text/csv`, `attachment` disposition, RFC 4180 CSV body | `ReportsService.exportCsv` writes formatted CSV rows directly |
| **T2.1-T2.3** | Income/Expense nominal <= 0 | 422 Unprocessable Entity, `success: false` | `ZodValidationPipe` checks `.positive()`; throws 422 |
| **T2.4** | Expense missing category | 422 Unprocessable Entity | `createExpenseSchema` requires `categoryId.uuid()` |
| **T2.5** | Max IDR nominal boundary | 201 Created for 999,999,999,999 without overflow | Drizzle `numeric(14,0)` handles 12-digit integers cleanly |
| **T2.6** | Adjustment missing reason | 422 Unprocessable Entity | `stockAdjustmentSchema` requires `reason.min(3)` |
| **T2.7** | Stock below zero check | 422 Unprocessable Entity, stock remains untouched | `InventoryService` checks `newQty < 0` before mutating DB |
| **T2.8-T2.9** | Boundary thresholds | Stock == 0 -> `'Habis'`, stock == threshold -> `'Menipis'` | Status calculation `<=` threshold logic |
| **T2.10-T2.11** | Debt payment over balance / <= 0 | 422 Unprocessable Entity | `DebtsService` validates `amount <= remainingBalance` and `amount > 0` |
| **T2.12** | Debt exact settlement | Status transitions to `'settled'`, balance = 0 | `DebtsService` sets `newStatus = 'settled'` when balance reaches 0 |
| **T2.13** | Debt overdue computation | Status returns `'overdue'` when `dueDate < today` & balance > 0 | `DebtsService` checks `dueDate < today` |
| **T2.14-T2.15** | Missing/forged JWT | 401 Unauthorized, `success: false` | `JwtAuthGuard` checks Bearer signature |
| **T2.16 & T3.7** | Cross-household isolation | Access to another household's record returns 403 or 404 | `HouseholdGuard` enforces `household_id` match on every query |
| **T2.17** | Token reuse detection | Replaying old refresh token revokes entire token family (401) | `AuthService.refresh` checks family revocation and revokes family on reuse |
| **T2.18** | Future year yearly report | Preserves 12 months with 0-value representation | `ReportsService` zero-fill template loop |
| **T2.19** | Malformed date string | 400 or 422 on invalid date query | Zod date regex `/^\d{4}-\d{2}-\d{2}$/` |
| **T3.1** | Atomic purchase completion | Creates 1 expense, increments stock, logs movement | `PurchasesService.complete` wraps all mutations in `db.transaction` |
| **T3.2** | Idempotent purchase replay | Replaying with same `Idempotency-Key` returns 200 without double stock | Checks stored `purchase.idempotencyKey` and returns existing result |
| **T3.3** | Purchase double completion without key | 400 Bad Request if already completed | Checks `purchase.status === 'completed'` |
| **T3.4** | Multi-stage debt lifecycle | Open -> PartiallyPaid -> Settled | Monotonic balance reduction in `DebtsService` |
| **T3.5-T3.6** | Outbox threshold transitions | Safe->Low triggers event; already-low suppresses duplicate | `evaluateStockThresholdTransition` prevents alert spam |
| **T4.1** | Full monthly operational cycle | Reconciles salary, fixed expense, grocery purchase, stock, debt, report | Comprehensive data integration across all modules |
| **T4.2** | Multi-member collaboration | Owner and Member access identical household state seamlessly | Clean household membership resolution in `JwtAuthGuard` |

---

## 8. Dependencies to Add to `apps/api/package.json`

To execute this architecture cleanly, the backend implementation agent will add the following production dependencies:

```json
{
  "dependencies": {
    "@node-rs/argon2": "^2.2.2",
    "@nestjs/jwt": "^10.2.0",
    "cookie-parser": "^1.4.7",
    "swagger-ui-express": "^5.0.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/cookie-parser": "^1.4.8",
    "@types/swagger-ui-express": "^4.1.7"
  }
}
```

---

## 9. Implementation Roadmap for Backend Developer Agent

1. **Step 1: Core Foundation & Infrastructure**:
   - Update `apps/api/package.json` dependencies and run `pnpm install`.
   - Implement `apps/api/src/common/` (tokens, decorators, `HttpExceptionFilter`, `TransformInterceptor`, `LoggingInterceptor`, `ZodValidationPipe`).
   - Implement `apps/api/src/modules/db/` (`DbModule`, `db.provider.ts`) wrapping `createDatabaseClient()`.
   - Update `apps/api/src/main.ts` with cookie parser, CORS, prefix `/api/v1`, Swagger, shutdown hooks.
2. **Step 2: Authentication & Household**:
   - Implement `AuthModule` (Argon2id hashing, dual-token JWT, refresh token family rotation, `JwtAuthGuard`, `HouseholdGuard`).
   - Implement `HouseholdModule` (`GET /household` with member list).
3. **Step 3: Master Data, Incomes, and Expenses**:
   - Implement `MasterDataModule` (income sources, income categories, expense categories with budget limits).
   - Implement `IncomesModule` (nominal validation, date filtering, pagination).
   - Implement `ExpensesModule` (mandatory category validation, payment method).
4. **Step 4: Inventory & Stock Management**:
   - Implement `InventoryModule` (status calculation `'Aman'|'Menipis'|'Habis'`, row-locking stock adjustments, non-negative stock constraint, outbox notification event insertion).
5. **Step 5: Purchases & Atomic Completion**:
   - Implement `PurchasesModule` (draft calculation, `POST /purchases/:id/complete` transaction with idempotency key, linked expense creation, stock increments).
6. **Step 6: Debts & Payments**:
   - Implement `DebtsModule` (status calculation `'open'|'partially_paid'|'settled'|'overdue'`, payment balance validation, atomic deduction).
7. **Step 7: Reports, Dashboard & CSV**:
   - Implement `ReportsModule` (`/dashboard` with `summaryCards` & alerts, `/reports/monthly`, `/reports/yearly` with 12-month zero continuity, `/reports/export/csv` RFC 4180 text stream).
   - Implement `NotificationsModule` (`/settings/notifications`).
8. **Step 8: Verification**:
   - Run `node tests/e2e/runner.ts` against the live backend server to verify 100% test pass across all 4 tiers.
