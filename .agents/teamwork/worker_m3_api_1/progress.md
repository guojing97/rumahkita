# Progress: Milestone 3 — Backend API

Last visited: 2026-10-27T14:50:30Z

## Phase 1: Planning & Setup
- [x] Read dispatch, requirements, blueprints, and skills
- [x] Inspect E2E test cases & API client expectations
- [x] Initialize briefing and progress trackers
- [ ] Install missing dependencies in `apps/api/package.json`

## Phase 2: Common & Database Foundation
- [ ] Implement `DbModule` / `DbService` / providers with `@rumahkita/db`
- [ ] Implement Common Constants & Tokens (`DB_CLIENT`, `QUERY_CLIENT`)
- [ ] Implement Common Decorators (`@CurrentUser`, `@CurrentHousehold`, `@Roles`, `@Public`, `@IdempotencyKey`)
- [ ] Implement `ZodValidationPipe` and `HttpExceptionFilter`
- [ ] Implement `TransformInterceptor` and `LoggingInterceptor`
- [ ] Implement `JwtAuthGuard`, `HouseholdGuard`, `RolesGuard`
- [ ] Update `main.ts` with cookie-parser, CORS, prefix, Swagger, global pipes & filters

## Phase 3: Auth & Household Modules
- [ ] Implement `AuthModule` (Argon2id, dual-token JWT, family rotation, reuse detection)
- [ ] Implement `HouseholdModule` (`/household`, `/households`)

## Phase 4: Domain Modules
- [ ] Implement `FinanceModule` (income-sources, income-categories, expense-categories, incomes, expenses)
- [ ] Implement `InventoryModule` (items, stock adjustments, status calculation, outbox event generation)
- [ ] Implement `PurchasesModule` (drafts, atomic completion transaction, linked expense, stock increment, idempotency key)
- [ ] Implement `DebtsModule` (debts-receivables, repayment transaction, overdue calculation)
- [ ] Implement `ReportsModule` (dashboard summary, monthly/yearly reports, Indonesian CSV export)
- [ ] Implement `NotificationsModule` (notification preferences)

## Phase 5: Verification & Quality Assurance
- [ ] Verify database connection and seed data
- [ ] Check `pnpm --filter api build` and `pnpm --filter api typecheck`
- [ ] Run full E2E test suite `node tests/e2e/runner.ts`
- [ ] Fix any edge cases or failures
- [ ] Produce comprehensive handoff report
