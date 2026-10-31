# Handoff Report: NestJS Architecture Explorer (Milestone 3)

## 1. Observation
- **Workspace State & Scaffolding**:
  - `apps/api/package.json` currently has minimal dependencies: `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/swagger`, `@rumahkita/contracts`, `@rumahkita/db`, `reflect-metadata`, `rxjs`. Missing dependencies: `cookie-parser`, `@types/cookie-parser`, `@node-rs/argon2`, `@nestjs/jwt`, `swagger-ui-express`, `zod`.
  - `apps/api/src/main.ts` sets prefix `api/v1`, CORS for `http://localhost:3000`, and listens on port 4000.
  - `tests/e2e/config.ts` line 8 defines default `API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3001/api/v1'`. Port 3001 must be the default port or respected from `process.env.API_PORT`.
  - `packages/db/src/index.ts` exports `createDatabaseClient()`, which returns `{ db, queryClient }`. The PostgreSQL client supports `.end()` for connection closure.
  - `packages/db/src/schema/` contains 18 tables with UUID primary keys, check constraints on monetary/quantity columns, and indexes on `household_id`.
  - `packages/contracts/src/common/api-response.ts` defines `ApiResponse<T>` and `ApiErrorResponse` (`{ success: false, statusCode, error, message, errors?: [{ field, message }] }`).
  - `PROJECT.md` lines 89-96 specifies error envelope format `{ statusCode, error, message, details: [{ field, issue }] }`.
  - `tests/e2e/tier1-feature-coverage/auth.test.ts` lines 26-27 tests for cookie named `refreshToken`: `client.cookieJar.getCookie('refreshToken')`.
  - `tests/e2e/tier1-feature-coverage/inventory.test.ts` lines 42, 51, 60 asserts status is `'Aman'`, `'Menipis'`, `'Habis'`:
    `assert.strictEqual(itemAman.body.data.status, 'Aman')`
  - `tests/e2e/tier1-feature-coverage/dashboard-reports.test.ts` lines 20-23 tests `res.body.data.summaryCards` having `totalIncome`, `totalExpense`, `netCashFlow`. Line 55 tests `res.body.data.monthlyTrends` (plural) having length 12.
  - `tests/e2e/tier2-boundary-corner/financial-boundaries.test.ts` lines 22, 37, 49, 70 verifies that nominal <= 0 or missing `categoryId` returns HTTP status `422 Unprocessable Entity` with `res.body.success === false`.
  - `tests/e2e/tier3-cross-feature/purchase-inventory-expense-atomicity.test.ts` tests `POST /purchases/:id/complete` with header `'Idempotency-Key'`, creating an expense, incrementing item stock, and idempotently returning 200 on repeated execution.

## 2. Logic Chain
1. *From E2E test inspection (`auth.test.ts` and `api-client.ts`)*:
   Clients store and read HttpOnly cookie `refreshToken`. Therefore, `main.ts` must register `cookie-parser` middleware before routing requests.
2. *From contracts and test assertions (`financial-boundaries.test.ts`, `inventory-boundaries.test.ts`, `debt-boundaries.test.ts`)*:
   Validation errors on invalid input (nominal <= 0, missing category, missing reason, negative stock) must return HTTP 422 with `success: false`. Thus, `ZodValidationPipe` and `HttpExceptionFilter` must intercept `ZodError` and business rule exceptions, returning status 422 with both `details` and `errors` fields to satisfy both contracts and `PROJECT.md`.
3. *From database client analysis (`packages/db/src/index.ts`)*:
   `createDatabaseClient()` produces a connection pool via `postgres`. NestJS must manage this in a global `DbModule` implementing `OnApplicationShutdown` to prevent dangling connections during worker / app tear down.
4. *From atomicity and isolation requirements (`purchase-inventory-expense-atomicity.test.ts`, `security-boundaries.test.ts`, `cross-household-isolation.test.ts`)*:
   Every business controller must be guarded by `JwtAuthGuard` and `HouseholdGuard` to ensure no tenant can read or mutate another tenant's records. Multi-row mutations (purchase completion, stock deductions, debt payments) must execute inside `db.transaction()` using `SELECT ... FOR UPDATE` row locks to eliminate concurrency race conditions.
5. *From dashboard and report test assertions (`dashboard-reports.test.ts`, `date-and-limits.test.ts`)*:
   The dashboard endpoint must supply `summaryCards` containing `totalIncome`, `totalExpense`, and `netCashFlow` alongside `recentTransactions` and `lowStockItems`. The yearly report must return 12 slots under `monthlyTrends` with zero-fill continuity.

## 3. Caveats
- No application source code in `apps/api/src/` has been modified during this exploration phase (strictly adherence to read-only exploration).
- The developer implementing Milestone 3 must run `pnpm --filter @rumahkita/api add @node-rs/argon2 @nestjs/jwt cookie-parser swagger-ui-express zod` and `pnpm --filter @rumahkita/api add -D @types/cookie-parser @types/swagger-ui-express`.

## 4. Conclusion
The architectural specification has been fully designed and compiled into `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m3_arch_1/arch_spec.md`. It provides:
1. Complete app bootstrap and lifecycle design (`apps/api/src/main.ts`) with cookie parser, CORS, Zod validation pipe, global error envelope filter, and OpenAPI Swagger documentation.
2. Global database module (`apps/api/src/modules/db/`) wrapping `createDatabaseClient()`, supporting connection pooling, graceful shutdown, and transactional row locking.
3. Module hierarchy and authorization pipeline (`JwtAuthGuard`, `HouseholdGuard`, `RolesGuard`, `@CurrentUser()`, `@CurrentHousehold()`, `@Roles()`, `TransformInterceptor`, `LoggingInterceptor`).
4. Full E2E test compatibility matrix covering all 56 tests across Tiers 1-4.

## 5. Verification Method
1. Inspect the architectural specification document:
   `view_file /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m3_arch_1/arch_spec.md`
2. Validate against Monorepo Build:
   `pnpm --filter @rumahkita/api build` (existing build passes)
3. Validate E2E Test Compatibility:
   Inspect `tests/e2e/config.ts` and test cases against Section 7 of `arch_spec.md`. When implemented, run:
   `node tests/e2e/runner.ts`
