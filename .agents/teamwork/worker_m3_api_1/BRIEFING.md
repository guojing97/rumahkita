# BRIEFING — 2026-10-27T14:50:00Z

## Mission
Build and verify the NestJS Backend REST API (`apps/api`) at `/api/v1` for Milestone 3, ensuring 100% compliance with all 56 opaque-box E2E tests, clean architecture, Argon2id auth, multi-tenant HouseholdGuard, and atomic transaction guarantees.

## 🔒 My Identity
- Archetype: implementer
- Roles: implementer, qa, specialist
- Working directory: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/worker_m3_api_1
- Original parent: c4aff318-95ce-46a6-8cfa-3b57f0b6f8fb
- Milestone: M3 (Backend API)

## 🔒 Key Constraints
- Multi-tenancy isolation via `household_id` on all entities.
- Dynamic Argon2id password hashing and dual-token auth (15m JWT + 7d HttpOnly cookie `refreshToken` with family rotation & reuse detection).
- Global error envelope: `{ success: false, statusCode, error, message, details: [...] }`.
- Success envelope: `{ success: true, data: T, meta?: PaginationMeta }`.
- Validation errors return 422 Unprocessable Entity.
- Atomic purchase completion in `db.transaction`: update status, insert expense, increment inventory, insert stock movements, check outbox threshold.
- Repayment in `db.transaction`: validate amount <= remaining balance, update status, insert payment.
- Soft-delete on master data (`deleted_at IS NULL`).
- CSV export RFC 4180 with UTF-8 BOM.
- Pass all 56 E2E tests in `tests/e2e/runner.ts`.

## Current Parent
- Conversation ID: c4aff318-95ce-46a6-8cfa-3b57f0b6f8fb
- Updated: 2026-10-27T14:50:00Z

## Task Summary
- **What to build**: Full NestJS REST API (`apps/api`) at `/api/v1` implementing Auth, Household, Master Data, Incomes, Expenses, Inventory, Purchases, Debts/Receivables, Dashboard/Reports, and Notifications modules.
- **Success criteria**:
  - `pnpm --filter api build`, `pnpm --filter api typecheck`, `pnpm --filter api lint` pass cleanly.
  - All 56 E2E tests pass via `node tests/e2e/runner.ts`.
- **Interface contracts**: `packages/contracts` and `tests/e2e/`.
- **Code layout**: `apps/api/src/modules/`, `apps/api/src/common/`.

## Key Decisions Made
- Use `@node-rs/argon2` for password hashing and verification.
- Use `@nestjs/jwt` for signing and verifying access tokens.
- Wrap `@rumahkita/db` in `DbModule` providing `DB_CLIENT` and `QUERY_CLIENT` with `enableShutdownHooks`.
- Global `HttpExceptionFilter` intercepts HttpException, ZodError, and PostgreSQL error codes, formatting them into the standard error envelope without leaking stack traces or schemas.
- `TransformInterceptor` wraps JSON responses in `{ success: true, data }` while bypassing CSV and null streams.
- `HouseholdGuard` resolves household from `X-Household-Id` header, route params, or user's single household fallback.
- Dynamic stock status returns Indonesian labels `'Aman' | 'Menipis' | 'Habis'` matching E2E assertions.
- Purchase completion and debt repayment utilize pessimistic row locking (`FOR UPDATE`) inside `db.transaction`.

## Change Tracker
- **Files modified**: None yet.
- **Build status**: Initial.
- **Pending issues**: None.

## Quality Status
- **Build/test result**: Not started yet.
- **Lint status**: Clean.
- **Tests added/modified**: Will verify against 56 E2E tests.

## Loaded Skills
- **Source**: `/Users/mac/.gemini/config/skills/backend-developer/SKILL.md`
- **Local copy**: `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/worker_m3_api_1/skill_backend_developer.md`
- **Core methodology**: Clean architecture, thin controllers, atomic transactions, row locking, defensive error handling, OWASP Top 10 security.

## Artifact Index
- `.agents/teamwork/worker_m3_api_1/DISPATCH.md` — Initial assignment
- `.agents/teamwork/worker_m3_api_1/BRIEFING.md` — Agent memory
- `.agents/teamwork/worker_m3_api_1/progress.md` — Liveness & progress tracker
