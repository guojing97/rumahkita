# Handoff Report: Milestone 5 Worker Remediation & Resilience Hardening

**Agent:** Worker M5 Remediation 2 (`worker_m5_remediation_2`)  
**Target:** Orchestrator (`70f30c57-3b98-4e37-8e6c-d4b8d72ee082`)  
**Scope:** `apps/worker/**` architectural remediation, lifecycle promise safety, clock skew immunity, zombie sweeping, adaptive polling, test suite hardening  
**Date:** 2026-10-28  
**Handoff Type:** Hard Handoff  

---

## 1. Observation

### 1.1 Pre-Remediation Baseline Defect
1. **Verbatim Test Failure:**  
   Command: `pnpm --filter @rumahkita/worker test`  
   Observed Output:
   ```text
   ✖ failing tests:

   test at src/__tests__/worker-adversarial-challenge.test.ts:588:5
   ✖ survives poller database failure without crashing daemon iteration loop (0.89375ms)
     Error: FATAL: Database connection terminated abruptly (connection reset by peer)
         at Object.claimBatch (/Users/mac/Projects/03-Labs/RumahKita/apps/worker/src/__tests__/worker-adversarial-challenge.test.ts:593:17)
         at <anonymous> (/Users/mac/Projects/03-Labs/RumahKita/apps/worker/src/daemon.ts:141:48)
         at NotificationWorker.pollOnce (/Users/mac/Projects/03-Labs/RumahKita/apps/worker/src/daemon.ts:158:5)
         at TestContext.<anonymous> (/Users/mac/Projects/03-Labs/RumahKita/apps/worker/src/__tests__/worker-adversarial-challenge.test.ts:606:22)
   ```
2. **Pre-Remediation Code Inspection in `apps/worker/src/daemon.ts`:**  
   - In `pollOnce()` (lines 135–163):
     `this.activeBatchPromise = null` was placed inside an anonymous IIFE's `finally` block, but `this.activeBatchPromise = batchPromise` was assigned *after* the IIFE was created and evaluated. When `claimBatch` threw, `this.activeBatchPromise` was set to a rejected promise after the IIFE finished, and throwing from `await batchPromise` bypassed resetting `this.activeBatchPromise` to null.
   - In `shutdown()` (lines 184–198):
     `Promise.race([this.activeBatchPromise, timeoutPromise])` awaited the rejected promise with no `.catch()` handler and no `try/catch` wrapper. The unhandled rejection aborted `shutdown()`, preventing `await this.queryClient.end()` and `this.removeSignalHandlers()` from executing.
   - In `scheduleNextPoll()` (lines 113–127):
     Static timeout of `this.pollIntervalMs` (5000ms) was used regardless of batch fullness, causing severe backlog drain latency under event spikes.

3. **Pre-Remediation Code Inspection in `apps/worker/src/polling/outbox-poller.ts`:**  
   - Host `Date.now()` and JavaScript `new Date()` were used to calculate `now` and `leaseExpiry`, leaving multi-worker clusters vulnerable to host clock drift.
   - Expired `PROCESSING` rows where `attempts >= maxAttempts` (from hard-crashes during the final attempt) evaluated `attempts < maxAttempts` to false and were permanently stranded as unmanaged zombies.

---

## 2. Logic Chain

1. **Step 1 (Daemon Lifecycle Fix):**  
   In `apps/worker/src/daemon.ts`:
   - Enclosed `return await batchPromise;` inside an outer `try ... finally` in `pollOnce()`:
     ```typescript
     this.activeBatchPromise = batchPromise;
     try {
       return await batchPromise;
     } finally {
       this.activeBatchPromise = null;
       this.isProcessingBatch = false;
     }
     ```
     This guarantees that `this.activeBatchPromise` and `this.isProcessingBatch` are unconditionally reset to `null` and `false` on any normal exit or thrown exception.
   - In `shutdown()`:
     Guarded `Promise.race` with `this.activeBatchPromise.catch(() => {})`, wrapped the race in `try/catch`, cleared the timeout timer via `clearTimeout` in `finally`, and guaranteed that database connection pool termination (`await this.queryClient.end()`) and signal listener unregistration (`this.removeSignalHandlers()`) always execute.
   - In `scheduleNextPoll()`:
     Implemented adaptive backlog drainage: when `claimedCount >= this.batchSize` and not shutting down, schedule the next iteration with `0ms` delay (`this.scheduleNextPoll(0)`).

2. **Step 2 (Outbox Poller Clock Skew & Zombie Sweeper Fix):**  
   In `apps/worker/src/polling/outbox-poller.ts`:
   - Added an atomic pre-claim sweeper in `claimBatch()`:
     ```typescript
     await tx
       .update(schema.notificationEvents)
       .set({
         status: 'FAILED',
         lastError: 'Execution timed out and exceeded maximum retry attempts',
         nextRetryAt: null,
       })
       .where(
         and(
           eq(schema.notificationEvents.status, 'PROCESSING'),
           sql`${schema.notificationEvents.attempts} >= ${schema.notificationEvents.maxAttempts}`,
           lte(schema.notificationEvents.nextRetryAt, sql`NOW()`)
         )
       );
     ```
   - Replaced host `now` with PostgreSQL `NOW()` in candidate selection (`lte(schema.notificationEvents.nextRetryAt, sql`NOW()`)`) and lease interval calculation (`sql`NOW() + (${leaseDurationMs} || ' milliseconds')::interval``), giving the worker daemon 100% clock skew immunity.

3. **Step 3 (Test Suite Alignment & Hardening):**  
   - In `apps/worker/src/__tests__/concurrency-stress.test.ts`:
     Updated TEST-4 assertions to verify that expired `PROCESSING` rows at `maxAttempts` are both guarded from reclamation and swept to `status: 'FAILED'`, `lastError: 'Execution timed out and exceeded maximum retry attempts'`, and `nextRetryAt: null`. Cleaned up table truncation in `before`, `beforeEach`, and `after` to isolate test runs.
   - In `apps/worker/src/__tests__/poller-and-concurrency.test.ts`:
     Added dedicated unit test `sweeps expired PROCESSING events at maxAttempts to FAILED status` and updated mock transaction expectations for the pre-claim sweeper.
   - In `apps/worker/src/__tests__/helpers/worker-child.ts`:
     Replaced `while (true)` with controlled boolean loop to resolve the `no-constant-condition` ESLint violation.
   - In `apps/worker/src/__tests__/worker-adversarial-challenge.test.ts`:
     Removed unused imports, added assertion `assert.equal(claimCalls, 1)`, and prefixed unused parameters with underscore.

---

## 3. Caveats

- **No caveats.** The implementation contains zero dummy, facade, or hardcoded logic. All changes maintain genuine transactional state against PostgreSQL and enforce strict async lifecycle guarantees.

---

## 4. Conclusion

All objectives specified in the dispatch assignment have been fully implemented, verified, and audited:
1. `apps/worker` builds and typechecks cleanly with 0 errors.
2. All ESLint rules pass with 0 errors and 0 warnings.
3. All 65 worker unit and adversarial challenge tests pass cleanly (100% pass rate).
4. The adversarial lifecycle challenge (`worker-adversarial-challenge.test.ts:588`) now passes cleanly in <1ms without unhandled rejections.
5. All 56 E2E tests across Tiers 1–4 pass cleanly with 100% success rate against the live backend API.

---

## 5. Verification Method

### 5.1 Verification Commands and Results

1. **TypeScript Typecheck:**
   ```bash
   pnpm --filter @rumahkita/worker typecheck
   ```
   **Output:**
   ```text
   $ tsc --noEmit
   (Exit code: 0)
   ```

2. **Package Build:**
   ```bash
   pnpm --filter @rumahkita/worker build
   ```
   **Output:**
   ```text
   $ tsc
   (Exit code: 0)
   ```

3. **ESLint Validation:**
   ```bash
   pnpm --filter @rumahkita/worker lint
   ```
   **Output:**
   ```text
   $ eslint "src/**/*.ts"
   (Exit code: 0, 0 errors, 0 warnings)
   ```

4. **Targeted Adversarial Suite Verification:**
   ```bash
   pnpm --filter @rumahkita/worker exec tsx --test "src/__tests__/worker-adversarial-challenge.test.ts"
   ```
   **Output:**
   ```text
   ✔ Group 5: Daemon Loop Resilience Under Extreme Hostility
     ✔ survives poller database failure without crashing daemon iteration loop (0.746442ms)
     ✔ survives 100% poison pill batch: handles 20 concurrent failing events cleanly (1.62822ms)
     ✔ absorbs secondary database failure during error-recording without unhandled rejections (0.516385ms)
   ℹ tests 24
   ℹ suites 6
   ℹ pass 24
   ℹ fail 0
   (Exit code: 0)
   ```

5. **Full Worker Test Suite Run:**
   ```bash
   pnpm --filter @rumahkita/worker test
   ```
   **Output:**
   ```text
   ℹ tests 65
   ℹ suites 14
   ℹ pass 65
   ℹ fail 0
   ℹ cancelled 0
   ℹ skipped 0
   ℹ todo 0
   ℹ duration_ms 5240.553741
   (Exit code: 0)
   ```

6. **Targeted Reproduction Script Verification:**
   ```bash
   node -e '
   const { NotificationWorker } = require("./apps/worker/dist/daemon");
   async function test() {
     const failingPoller = { claimBatch: () => { throw new Error("FATAL: Database connection terminated abruptly"); } };
     const worker = new NotificationWorker({ db: {}, queryClient: { end: () => Promise.resolve() }, outboxPoller: failingPoller, pollIntervalMs: 50 });
     try { await worker.pollOnce(); } catch (e) { console.log("Caught in pollOnce:", e.message); }
     try { await worker.shutdown(); } catch (e) { console.log("Shutdown threw:", e.message); }
   }
   test();'
   ```
   **Output:**
   ```text
   Caught in pollOnce: FATAL: Database connection terminated abruptly
   [RumahKita Worker] Draining in-flight tasks and shutting down...
   [RumahKita Worker] Database connections closed cleanly.
   [RumahKita Worker] Notification daemon stopped gracefully.
   (Exit code: 0)
   ```

7. **Opaque-Box E2E Runner (56/56 Tests Passing):**
   ```bash
   API_BASE_URL=http://localhost:4000/api/v1 node tests/e2e/runner.ts
   ```
   **Output:**
   ```text
   ℹ tests 56
   ℹ suites 19
   ℹ pass 56
   ℹ fail 0
   ℹ cancelled 0
   ℹ skipped 0
   ℹ todo 0
   ℹ duration_ms 7586.942495

   ============================================================
    [PASS] All test suites completed successfully.
   (Exit code: 0)
   ```

### 5.2 Invalidation Conditions
- Any occurrence of unhandled promise rejection during `NotificationWorker.shutdown()`.
- Any failure in `worker-adversarial-challenge.test.ts:588`.
- Any regression in worker unit tests or E2E tests.
- Re-emergence of zombie rows in `status = 'PROCESSING'` where `attempts >= maxAttempts`.
