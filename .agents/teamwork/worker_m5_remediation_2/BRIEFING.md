# BRIEFING — 2026-10-28T05:47:00Z

## Mission
Remediate `apps/worker` lifecycle and resilience issues: promise rejection handling in daemon shutdown, atomic zombie sweeper for expired outbox tasks, adaptive polling backlog drainage, and postgres NOW() clock skew immunity.

## 🔒 My Identity
- Archetype: implementer
- Roles: implementer, qa
- Working directory: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/worker_m5_remediation_2
- Original parent: 70f30c57-3b98-4e37-8e6c-d4b8d72ee082
- Milestone: M5 Remediation 2

## 🔒 Key Constraints
- Exclusive file ownership: `apps/worker/**`
- Mandatory Integrity: No hardcoding test results or creating facade implementations.
- Verify all worker unit tests (including `worker-adversarial-challenge.test.ts`) and full E2E suite pass.

## Current Parent
- Conversation ID: 70f30c57-3b98-4e37-8e6c-d4b8d72ee082
- Updated: not yet

## Task Summary
- **What to build**: Fix `daemon.ts` (pollOnce try/finally, shutdown promise rejection handling and timeout cleanup, adaptive scheduling in scheduleNextPoll) and `outbox-poller.ts` (clock skew immunity with SQL `NOW()`, atomic pre-claim zombie sweeper for maxAttempts exceeded).
- **Success criteria**: 0 build/lint/typecheck errors, 100% pass on worker tests (including adversarial suite), 100% pass on E2E tests (56/56).
- **Interface contracts**: `PROJECT.md` / `ORIGINAL_REQUEST.md`
- **Code layout**: `apps/worker/**`

## Key Decisions Made
- [Remediation] Fixed asynchronous promise rejection leak in `NotificationWorker.pollOnce()` with outer `try ... finally` block.
- [Remediation] Safeguarded `shutdown()` by attaching `.catch(() => {})` to `this.activeBatchPromise` inside `Promise.race`, wrapping in `try/catch`, clearing the timeout timer with `clearTimeout`, and ensuring database connection pool teardown and signal unregistration execute unconditionally.
- [Remediation] Added adaptive burst polling in `scheduleNextPoll()` using 0ms delay when a batch is full (`claimedCount >= batchSize`).
- [Remediation] Added atomic pre-claim zombie sweeper in `OutboxPoller.claimBatch()` updating expired `PROCESSING` rows where `attempts >= maxAttempts` directly to `status = 'FAILED'`, `lastError = 'Execution timed out and exceeded maximum retry attempts'`, and `nextRetryAt = null`.
- [Remediation] Replaced host `Date.now()` with PostgreSQL `NOW()` SQL expressions for clock skew immunity in outbox polling.

## Artifact Index
- `.agents/teamwork/worker_m5_remediation_2/DISPATCH.md` — Assigned instructions
- `.agents/teamwork/worker_m5_remediation_2/BRIEFING.md` — Agent working memory
- `.agents/teamwork/worker_m5_remediation_2/progress.md` — Liveness heartbeat and progress tracking
- `.agents/teamwork/worker_m5_remediation_2/handoff.md` — 5-component handoff report

## Change Tracker
- **Files modified**:
  - `apps/worker/src/daemon.ts`: Adaptive burst polling, guaranteed promise cleanup in `pollOnce`, and rejection-immune graceful `shutdown`.
  - `apps/worker/src/polling/outbox-poller.ts`: Atomic pre-claim zombie sweeper, PostgreSQL `NOW()` clock skew immunity.
  - `apps/worker/src/__tests__/concurrency-stress.test.ts`: TEST-4 assertions updated for zombie sweeper verification; table truncate isolation.
  - `apps/worker/src/__tests__/poller-and-concurrency.test.ts`: Sweeper unit test coverage added and mocks updated.
  - `apps/worker/src/__tests__/helpers/worker-child.ts`: Lint fix for `no-constant-condition`.
  - `apps/worker/src/__tests__/worker-adversarial-challenge.test.ts`: Cleaned up unused imports/variables, asserted `claimCalls === 1`.
- **Build status**: PASS (0 errors, 0 warnings across typecheck, build, lint, and all test suites)
- **Pending issues**: None

## Quality Status
- **Build/test result**: 65/65 worker unit tests PASS (100%), 56/56 E2E tests PASS (100%)
- **Lint status**: 0 violations, 0 warnings
- **Tests added/modified**: `concurrency-stress.test.ts:TEST-4` (zombie sweeper verification), `poller-and-concurrency.test.ts` (sweeper unit test)
