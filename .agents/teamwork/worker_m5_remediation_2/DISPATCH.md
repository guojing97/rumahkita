## 2026-10-27T22:46:50Z

You are Worker M5 Remediation 2.
Your working directory is:
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/worker_m5_remediation_2

You MUST read the authoritative user request first:
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/ORIGINAL_REQUEST.md

Also read:
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/PROJECT.md
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m5_rem_1/analysis.md
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m5_rem_1/handoff.md
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m5_rem_2/handoff.md
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m5_rem_3/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Exclusive File Ownership:
`apps/worker/**`

Objective:
Apply the architectural remediation and resilience improvements identified by the remediation explorers in `apps/worker`:

1. Fix Lifecycle & Rejected Promise Handling in `apps/worker/src/daemon.ts`:
   - In `pollOnce()`:
     Ensure `this.activeBatchPromise` is set before or cleanly managed, and wrap the evaluation in a `try ... finally` block so `this.activeBatchPromise = null` and `this.isProcessingBatch = false` are guaranteed under all circumstances (even when `claimBatch` throws immediately or asynchronously).
   - In `shutdown()`:
     Attach `.catch(() => {})` to `this.activeBatchPromise` when running `Promise.race([this.activeBatchPromise.catch(() => {}), timeoutPromise])`. Wrap the race in a `try/catch` block, clear timeout timer with `clearTimeout`, ensure `this.activeBatchPromise = null`, and guarantee that database connections (`this.queryClient.end()`) and signal handlers (`this.removeSignalHandlers()`) are cleanly terminated without throwing unhandled rejections.
   - In `scheduleNextPoll()`:
     Implement adaptive scheduling: if `claimedCount >= this.batchSize` and not shutting down, schedule the next iteration with `0ms` delay to drain queue backlogs without waiting for the full idle poll interval.

2. Resilience & Zombie Sweeper in `apps/worker/src/polling/outbox-poller.ts`:
   - Replace Node.js host `Date.now()` with PostgreSQL `NOW()` expressions for clock skew immunity.
   - In `claimBatch()`: add an atomic pre-claim sweeper updating expired `PROCESSING` rows where `attempts >= maxAttempts` directly to `status = 'FAILED'`, `nextRetryAt = null`, and `lastError = 'Execution timed out and exceeded maximum retry attempts'` so crashed final-attempt events do not become untracked permanent zombies.

3. Verification:
   - Run typecheck: `pnpm --filter @rumahkita/worker typecheck`
   - Run build: `pnpm --filter @rumahkita/worker build`
   - Run lint: `pnpm --filter @rumahkita/worker lint`
   - Run unit tests: `pnpm --filter @rumahkita/worker test` (Verify 100% pass across all tests, specifically verifying `worker-adversarial-challenge.test.ts:588` now passes cleanly!).
   - Verify E2E suite: `API_BASE_URL=http://localhost:4000/api/v1 node tests/e2e/runner.ts` (All 56/56 tests passing).

Output Requirements:
Write your implementation details and test execution outputs to:
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/worker_m5_remediation_2/handoff.md

Completion Criteria:
1. `apps/worker` fully remediated and builds with 0 errors.
2. All 64+ worker unit tests pass cleanly (including adversarial challenge suite).
3. All 56 E2E tests pass (100% pass rate).
4. Full command logs and evidence documented in `handoff.md`.
When done, notify me via send_message.
