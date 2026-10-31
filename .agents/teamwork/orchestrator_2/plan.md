# Orchestration Plan — Generation 2

## Objective
Finalize and rigorously gate Milestone 3 (Backend API), then execute Milestone 4 (Frontend Web) and Milestone 5 (Notification Worker & Final E2E Hardening).

## Phase 1: Milestone 3 Completion & Gating
1. **Worker Dispatch**: Spawn `teamwork_preview_worker` (`worker_m3_api_2`) to:
   - Check and align schema/type definitions between `packages/db`, `packages/contracts`, and `apps/api`.
   - Ensure PostgreSQL is running (`pnpm docker:up` or verifying container) and migrations/seeds applied.
   - Run typecheck and build for `apps/api` (`pnpm --filter api build`).
   - Run live NestJS API and verify all 56 E2E tests pass via `API_BASE_URL=http://localhost:4000/api/v1 node tests/e2e/runner.ts`.
   - Deliver `handoff.md` with complete evidence.
2. **Review & Adversarial Gate**:
   - Spawn 2 Reviewers (`teamwork_preview_reviewer`): Verify correctness, multi-tenant guard security, atomic transaction logic, and test pass.
   - Spawn 2 Challengers (`teamwork_preview_challenger`): Adversarially probe API endpoints (household isolation, negative amounts, idempotent purchase completion, expired tokens).
   - Spawn Forensic Auditor (`teamwork_preview_auditor`): Run integrity forensics checks against cheating or hardcoded responses.
   - Gate evaluation in `GATE_STATUS.md`.

## Phase 2: Milestone 4 Execution (Frontend Web)
1. **Explorer Survey**: 3 Explorers analyze Next.js App Router layout, Neo-brutalism design tokens (`packages/ui`), TanStack tables, Recharts, and BFF proxy.
2. **Worker Implementation**: `teamwork_preview_worker` builds web app, pages, and components.
3. **Review & Gate**: 2 Reviewers, 2 Challengers (Playwright UI tests at 390px and 1280px), 1 Auditor.

## Phase 3: Milestone 5 Execution (Worker & Final Hardening)
1. **Worker Daemon**: `apps/worker` outbox polling daemon (`notification_events` with `FOR UPDATE SKIP LOCKED`).
2. **Phase 1 Acceptance**: 100% of 56 E2E tests pass.
3. **Phase 2 Hardening**: Tier 5 adversarial tests by Challenger.
4. **Final Gate & Completion**: Full forensic audit, report to parent Sentinel.
