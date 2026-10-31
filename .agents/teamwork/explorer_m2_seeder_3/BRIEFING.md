# BRIEFING — 2026-10-27T13:59:00Z

## Mission
Specify the comprehensive and idempotent database seeder (`packages/db/src/seed.ts`) for RumahKita Milestone 2.

## 🔒 My Identity
- Archetype: explorer
- Roles: seeder_spec_author, initial_data_domain_specialist
- Working directory: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m2_seeder_3
- Original parent: c4aff318-95ce-46a6-8cfa-3b57f0b6f8fb
- Milestone: Milestone 2: Database Schema with Drizzle ORM

## 🔒 Key Constraints
- Read-only investigation — do NOT implement or modify source code
- Files for content delivery, Messages for coordination
- Ensure idempotent upserts or cleanup logic for repeated `pnpm --filter db db:seed` runs
- Align with E2E credentials, PRD, and Drizzle schema designs

## Current Parent
- Conversation ID: c4aff318-95ce-46a6-8cfa-3b57f0b6f8fb
- Updated: 2026-10-27T13:58:17Z

## Investigation State
- **Explored paths**:
  - `ORIGINAL_REQUEST.md`, `PROJECT.md`, `Doc/prd.md` (§4, §6, §8, §9, §11)
  - `TEST_READY.md`, `tests/e2e/config.ts`, `tests/e2e/client/auth-helper.ts`, `tests/e2e/tier1-feature-coverage/`
  - `packages/contracts/src/` (auth, finance, debts, inventory, notifications)
  - `packages/db/src/index.ts`, `packages/db/package.json`
  - `explorer_m2_schema_1/schema_spec.md`, `explorer_m2_migration_2/`
- **Key findings**:
  - Strict E2E credentials: `budi@rumahkita.local`, `ani@rumahkita.local`, `joko@rumahkita.local` with password `Password123!`.
  - Joko Anwar must belong strictly to a secondary household (`Keluarga Anwar`) to pass Tier 3 cross-household 403 test (`T3.7`).
  - Passwords must be Argon2id hashes, not plaintext. `@node-rs/argon2` provides zero-native-build N-API hashing with verified RFC 9106 PHC fallback.
  - Idempotency requires deterministic UUIDs (`SEED_IDS`) and `onConflictDoUpdate` / `onConflictDoNothing` so `pnpm --filter db db:seed` can run repeatedly without collision.
  - Initial inventory items must cover all 3 statuses (`Aman`, `Menipis ⚠`, `Habis ✕`) to populate dashboard alerts.
  - Database connection `queryClient` must be explicitly closed via `await queryClient.end()` in `finally` to prevent hanging CLI.
- **Unexplored areas**: None. Seeder blueprint is fully formulated.

## Key Decisions Made
- Used `@node-rs/argon2` for N-API prebuilt binary performance and portability.
- Provided verified precomputed Argon2id string constant as a resilient fallback.
- Specified 2 households: Primary (`Keluarga Cemara`) and Secondary (`Keluarga Anwar`).
- Defined deterministic UUID dictionary `SEED_IDS` for all initial entities.
- Specified realistic initial transactions and debt payments for vibrant initial dashboard metrics.

## Artifact Index
- `DISPATCH.md` — Incoming task dispatches
- `BRIEFING.md` — Persistent situational memory
- `progress.md` — Heartbeat and task progress log
- `seeder_spec.md` — Complete, production-ready specification of `packages/db/src/seed.ts`
- `handoff.md` — 5-component handoff report for parent orchestrator
