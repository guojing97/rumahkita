## 2026-10-27T14:00:51Z
You are Worker 3 for Milestone 2: Database Schema with Drizzle ORM of the RumahKita project.

Working Directory: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/worker_m2_db_1
Authoritative Request: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/ORIGINAL_REQUEST.md
Master Project Index: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/PROJECT.md
Domain Skill Path: /Users/mac/.gemini/config/skills/backend-developer/SKILL.md

Explorer Blueprints to implement:
- Schema Specification: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m2_schema_1/schema_spec.md
- Migration & Tooling Specification: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m2_migration_2/migration_spec.md
- Seeder Specification: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m2_seeder_3/seeder_spec.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Write Ownership:
1. `packages/db/src/schema/*`:
   - Implement all 18 PostgreSQL tables across 8 domain files: `auth.ts`, `household.ts`, `finance.ts`, `inventory.ts`, `purchase.ts`, `debt.ts`, `notification.ts`, `audit.ts`.
   - Implement `common.ts` (`auditColumns`, `softDeleteColumn`, `idrNumeric`), `relations.ts` (circular-dependency-free Drizzle relations), and `index.ts` (re-exporting all schemas and relations).
   - Invariants: UUID primary keys (`defaultRandom()`), `numeric(14,0)` IDR currency, audit columns, soft delete `deleted_at` on master data, `household_id` foreign key and index on all business tables, `pgEnum`s aligned with shared contracts.
2. `packages/db/drizzle.config.ts`:
   - Configure Drizzle Kit (`dialect: 'postgresql'`, `schema: './src/schema/index.ts'`, `out: './drizzle'`, credentials from `DATABASE_URL`).
3. `packages/db/src/index.ts`:
   - Export schema, relations, db client instance factory, and TypeScript types.
4. `packages/db/package.json`:
   - Add scripts: `"db:generate"`, `"db:migrate"`, `"db:migrate:kit"`, `"db:push"`, `"db:studio"`, `"db:seed"`.
   - Add devDependencies: `dotenv`, `tsx`.
5. `packages/db/src/migrate.ts`:
   - Implement programmatic migration runner using `drizzle-orm/postgres-js/migrator` with explicit teardown (`client.end()`).
6. `packages/db/src/seed.ts`:
   - Implement idempotent database seeder per `seeder_spec.md` (2 households, 3 users with Argon2id hashed `Password123!`, master data, sample inventory items with status Aman/Menipis/Habis, debts/receivables, and transactions).
7. Execute Database Verifications:
   - Run `pnpm --filter db db:generate` to generate initial migration SQL files in `packages/db/drizzle/`.
   - Ensure PostgreSQL Docker container is running (`docker compose up -d` or `pnpm docker:up`).
   - Run `pnpm --filter db db:migrate` to apply migrations.
   - Run `pnpm --filter db db:seed` to seed sample data.
   - Run `pnpm --filter db db:seed` a second time to verify idempotency.
   - Run `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`.

Deliverables:
- Write handoff report with verbatim terminal output to:
  `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/worker_m2_db_1/handoff.md`
- Send completion message to parent orchestrator.
