# Handoff Report — Explorer 3 (Architecture & Monorepo Infrastructure)

## 1. Observation
- Inspected `/Users/mac/Projects/03-Labs/RumahKita/ORIGINAL_REQUEST.md` (lines 19–53): Requirements explicitly require Turborepo + pnpm workspaces with three apps (`web` Next.js, `api` NestJS, `worker` notification consumer), shared packages (`db` Drizzle ORM, `contracts` Zod/TS, `ui` shadcn/neo-brutalism, `eslint-config`, `typescript-config`), Docker Compose PostgreSQL dev environment, atomic purchase completion, outbox worker polling with safe $\to$ low/out transition deduplication, and acceptance criteria.
- Inspected `/Users/mac/.gemini/antigravity-cli/brain/13245091-e296-474c-b5a5-5860f1bb35db/plan.md` (lines 32–139, 442–486): Defines 5 execution phases (P0 to P4), 13 subagents, and Drizzle schema patterns (`auditColumns`, `softDelete`, PostgreSQL integer Rupiah `numeric(14,0)`, UUID PKs).
- Inspected `/Users/mac/Projects/03-Labs/RumahKita/Doc/prd.md` (lines 332–435, 467–482): 18 database entities specified; `/api/v1` base path; Argon2id password hashing; 15-minute JWT + 7-day refresh cookie; `FOR UPDATE SKIP LOCKED` or outbox pattern for `notification_events`; strict `household_id` scoping on all queries.
- Inspected `/Users/mac/Projects/03-Labs/RumahKita/Doc/design.md` (lines 25–75): Neo-brutalism visual tokens (`--bg: #FFFDF7`, `--ink: #171717`, `--primary: #C8F169`, 2px solid border, 4px 4px 0 hard shadow, Space Grotesk / Inter typography, tabular numerals).
- Inspected `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/orchestrator_1/plan.md` (lines 1–30): Dual-track execution where Track A is independent E2E Testing (Tiers 1–4) and Track B is Milestone 1–5 implementation.

## 2. Logic Chain
1. Based on the requirements in `ORIGINAL_REQUEST.md` (R1) and `plan.md` (Phase 0), the monorepo architecture requires strict separation of concerns into `apps/` and `packages/` orchestrated by `turbo.json` and `pnpm-workspace.yaml`.
2. Because validation schemas must be shared seamlessly between client forms (React Hook Form) and server DTOs (NestJS), `packages/contracts` must be isomorphic TypeScript and Zod without any Node-specific or browser-specific dependencies.
3. Because PRD §6.10 mandates that notifications must not fire repeatedly on every subsequent check once an item is already low, the worker deduplication logic must evaluate threshold state transitions: notification events are only created when an item transitions from `Safe` ($> \text{threshold}$) to `Low` / `Out` ($\le \text{threshold}$).
4. Because multiple worker instances or concurrent API calls could cause race conditions, the worker outbox poller must use `SELECT ... FOR UPDATE SKIP LOCKED` inside a PostgreSQL transaction to lock pending events.
5. In order to decouple testing from implementation details as mandated by Track A, the E2E test harness must treat the API as an opaque box via HTTP, running against a dedicated test database, with full coverage across Tier 1 (features), Tier 2 (boundaries), Tier 3 (cross-feature interactions), and Tier 4 (full user workflows).

## 3. Caveats
- Production deployment infrastructure (Kubernetes / Helm / AWS ECS / Vercel) was not specified in the MVP scope; focus is on local Docker Compose PostgreSQL and pnpm dev tooling.
- External delivery adapters (Resend API and Meta WhatsApp Business Cloud API) are specified to use mock/logging stubs in development mode so that external credentials are not a blocker for local development and CI testing.
- Database soft-delete is applied to master data entities; business transactions use immutable status cancellation where specified in PRD §8.

## 4. Conclusion
The comprehensive architectural specification has been documented in `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_survey_arch_3/survey_report.md`. It provides complete definitions for:
- Monorepo folder layout, workspace configuration (`pnpm-workspace.yaml`, `.npmrc`, root `package.json`), and package dependency graphs.
- `turbo.json` pipeline configuration across build, dev, lint, typecheck, test, and db commands.
- Domain-driven shared contracts (`packages/contracts`) with Zod schemas and TypeScript types for all 7 application modules.
- Notification worker architecture (`apps/worker`) with outbox polling, state machine, deduplication algorithm, channel adapters, and exponential retry backoff.
- PostgreSQL 16 Alpine Docker Compose environment configuration.
- Shared environment variable matrix (`.env.example`) and startup schema validation.
- End-to-end testing infrastructure design covering Opaque-Box API tests, Playwright UI tests, and all 4 test tiers (T1–T4).
- Sequenced milestone implementation plan (M1–M5).

The architecture is complete, verified against all reference documents, and ready to guide Milestone 1 implementation.

## 5. Verification Method
- **Inspect Specification File**:
  `view_file /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_survey_arch_3/survey_report.md`
- **Verify Coverage**:
  Ensure all sections required by the dispatch prompt (Monorepo structure, Turbo pipelines, Contracts, Worker architecture, Docker, Environment variables, E2E test tiers) are present and fully articulated.
- **Invalidation Condition**:
  The report would be invalidated if any required PRD §9 entity, API endpoint, or acceptance criterion was omitted or incompatible with the Turborepo + pnpm workspaces stack.
