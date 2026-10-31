## 2026-10-27T14:47:54Z
You are Worker 4 (NestJS Backend API Worker) for Milestone 3: Backend API (NestJS REST API /api/v1).
Your working directory is `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/worker_m3_api_1`.

MANDATORY FIRST STEP:
Read `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/ORIGINAL_REQUEST.md` and `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/PROJECT.md`.
Read the architectural blueprint at `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m3_arch_1/arch_spec.md`.
Read the auth blueprint at `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m3_auth_2/auth_spec.md`.
Read the business domain blueprint at `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m3_domain_3/domain_spec.md`.
Read the backend developer skill at `/Users/mac/.gemini/config/skills/backend-developer/SKILL.md`.
Inspect `tests/e2e/runner.ts` and `tests/e2e/cases/` to ensure full compliance with the 56 E2E tests.

MANDATORY INTEGRITY WARNING:
> DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

WRITE OWNERSHIP:
You have exclusive write ownership of `apps/api/` (all files in `apps/api/src/`, `apps/api/package.json`, `apps/api/test/`).

TASKS:
1. Dependencies:
   Install required packages in `apps/api/` (`@nestjs/swagger`, `swagger-ui-express`, `cookie-parser`, `@types/cookie-parser`, `@nestjs/jwt`, `passport`, `passport-jwt`, `@types/passport-jwt`, `@node-rs/argon2`, etc.).
2. Database Module:
   Implement `DbModule` / `DbService` injecting `@rumahkita/db` connection pool and exposing `db` client with transaction support.
3. App Bootstrap (`apps/api/src/main.ts`):
   - Global prefix `/api/v1`
   - `cookie-parser` for HttpOnly `refreshToken` cookie
   - CORS with credentials for `http://localhost:3000`
   - Global `ZodValidationPipe`
   - Global `HttpExceptionFilter` adhering to error envelope: `{ success: false, statusCode, error, message, details: [...] }`
   - Swagger / OpenAPI documentation at `/api/docs`
   - Listen on `process.env.PORT || 3001` (to align with E2E test runner default)
4. Auth & Multi-Tenancy Modules (`apps/api/src/modules/auth/`, `household/`):
   - Dynamic Argon2id password hashing & verification
   - Dual-token auth: 15m JWT access token + 7d HttpOnly cookie `refreshToken` stored as SHA-256 in `refresh_sessions` with token family rotation
   - `JwtAuthGuard` & `HouseholdGuard`: checks `X-Household-Id` header (and fallback if single household), verifies active membership in `household_members`, returns 403 Forbidden for cross-household access
   - `RolesGuard` (`@Roles('owner')`)
   - Endpoints: `/api/v1/auth/register`, `/login`, `/refresh`, `/logout`, `/me`, `/password/forgot`, `/password/reset`
   - Household endpoints: `/api/v1/household` (profile + members), `/households`, `/households/:id`, `/households/:id/members`, `/households/:id/invite`
5. Domain Modules (`apps/api/src/modules/`):
   - `FinanceModule`:
     - `income-sources` and `income-categories` CRUD with soft-delete
     - `expense-categories` CRUD with IDR budget limits (`budget_limit`) and soft-delete
     - `incomes`: CRUD, query filters (`startDate`, `endDate`, `sourceId`, `categoryId`)
     - `expenses`: CRUD, query filters (`startDate`, `endDate`, `categoryId`)
   - `InventoryModule`:
     - `items`: CRUD with soft-delete, unit, stock status calculation (`Aman`, `Menipis`, `Habis`)
     - `stock-movements`: audit log, manual adjustment endpoint `POST /api/v1/items/:id/adjust` requiring reason
   - `PurchaseModule`:
     - `purchases`: drafts CRUD, line items, idempotency key unique constraint
     - Atomic completion `POST /api/v1/purchases/:id/complete` executed inside `db.transaction`:
       1. Transition purchase status: `DRAFT` -> `COMPLETED`
       2. Insert into `expenses`
       3. For each line item: increment `items.quantity_on_hand` and insert `stock_movements` with reason `'purchase'`
       4. Check stock threshold transition: emit outbox event to `notification_events` if transitioned from safe to low/out
   - `DebtModule`:
     - `debts-receivables`: CRUD (`principal_amount`, `remaining_balance`, `due_date`, `status`)
     - Repayment endpoint `POST /api/v1/debts-receivables/:id/payments`: in transaction, insert payment, decrement balance, update status (`settled` if remaining_balance == 0, else `partially_paid`)
   - `DashboardModule` & `ReportModule`:
     - `GET /api/v1/dashboard/summary`: monthly cash flow, category breakdown, budget utilization, items count (Aman/Menipis/Habis), debts/receivables
     - `GET /api/v1/reports/monthly` & `GET /api/v1/reports/yearly`
     - `GET /api/v1/reports/export/csv`: formatted Indonesian CSV
   - `NotificationModule`:
     - `GET /api/v1/notifications/preferences` & `PUT /api/v1/notifications/preferences`
6. Quality & Verification:
   - Run `pnpm --filter api build` and `pnpm --filter api typecheck` and `pnpm --filter api lint`
   - Run monorepo checks: `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`
   - Ensure PostgreSQL Docker container is running, seed data is present (`pnpm --filter db db:seed`), run `pnpm --filter api start &` (or test runner) and execute E2E test suite:
     `API_BASE_URL=http://localhost:3001/api/v1 node tests/e2e/runner.ts` (or `node tests/e2e/runner.ts`)
   - Verify that test cases pass.
7. Write your detailed handoff report to `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/worker_m3_api_1/handoff.md`.
Communicate your completion back to the parent orchestrator via send_message.
