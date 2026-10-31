# Handoff Report: Worker Daemon Lifecycle & Shutdown Defect Remediation

**Agent:** Explorer M5 Rem 1 (`explorer_m5_rem_1`)  
**Target:** Orchestrator (`70f30c57-3b98-4e37-8e6c-d4b8d72ee082`)  
**Scope:** Root cause investigation, asynchronous failure trace, and exact fix formulation for `apps/worker/src/daemon.ts`  
**Date:** 2026-10-28  
**Type:** Hard Handoff  

---

## 1. Observation

### 1.1 Direct Source Code Inspection
- File: `/Users/mac/Projects/03-Labs/RumahKita/apps/worker/src/daemon.ts`
  - Lines 138–158:
    ```typescript
    this.isProcessingBatch = true;
    const batchPromise = (async () => {
      try {
        const events = await this.outboxPoller.claimBatch(this.db, this.batchSize);
        if (events.length === 0) {
          return 0;
        }

        console.log(`[RumahKita Worker] Claimed ${events.length} notification event(s) for processing.`);

        // Process all claimed events concurrently outside of DB transaction locks
        await Promise.allSettled(
          events.map((event) => this.eventProcessor.processEvent(this.db, event))
        );

        return events.length;
      } finally {
        this.isProcessingBatch = false;
        this.activeBatchPromise = null;
      }
    })();

    this.activeBatchPromise = batchPromise;
    return await batchPromise;
    ```
  - Lines 184–198:
    ```typescript
    // Wait for in-flight batch to drain within timeout
    if (this.activeBatchPromise) {
      console.log('[RumahKita Worker] Awaiting in-flight batch execution to finish...');
      const timeoutPromise = new Promise<'timeout'>((resolve) =>
        setTimeout(() => resolve('timeout'), timeoutMs)
      );

      const result = await Promise.race([this.activeBatchPromise, timeoutPromise]);
      if (result === 'timeout') {
        console.warn(
          `[RumahKita Worker] Shutdown drain exceeded timeout of ${timeoutMs}ms. Forcing exit.`
        );
      } else {
        console.log('[RumahKita Worker] In-flight batch successfully drained.');
      }
    }
    ```
  - Lines 201–209:
    ```typescript
    // Teardown database connection
    try {
      await this.queryClient.end();
      console.log('[RumahKita Worker] Database connections closed cleanly.');
    } catch (err) {
      console.error('[RumahKita Worker] Error closing database connections:', err);
    }

    this.removeSignalHandlers();
    console.log('[RumahKita Worker] Notification daemon stopped gracefully.');
    ```

### 1.2 Verbatim Test Failure
Command: `pnpm --filter @rumahkita/worker test`
Verbatim Output:
```text
ℹ tests 64
ℹ suites 14
ℹ pass 63
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10703.154463

✖ failing tests:

test at src/__tests__/worker-adversarial-challenge.test.ts:588:5
✖ survives poller database failure without crashing daemon iteration loop (1.216208ms)
  Error: FATAL: Database connection terminated abruptly (connection reset by peer)
      at Object.claimBatch (/Users/mac/Projects/03-Labs/RumahKita/apps/worker/src/__tests__/worker-adversarial-challenge.test.ts:593:17)
      at <anonymous> (/Users/mac/Projects/03-Labs/RumahKita/apps/worker/src/daemon.ts:141:48)
      at NotificationWorker.pollOnce (/Users/mac/Projects/03-Labs/RumahKita/apps/worker/src/daemon.ts:158:5)
      at TestContext.<anonymous> (/Users/mac/Projects/03-Labs/RumahKita/apps/worker/src/__tests__/worker-adversarial-challenge.test.ts:606:22)
/Users/mac/Projects/03-Labs/RumahKita/apps/worker:
[ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL] @rumahkita/worker@0.0.0 test: `tsx --test "src/__tests__/**/*.test.ts"`
Exit status 1
```

### 1.3 Verbatim Empirical Reproduction
Command:
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
Output:
```text
Caught in pollOnce: FATAL: Database connection terminated abruptly
[RumahKita Worker] Draining in-flight tasks and shutting down...
[RumahKita Worker] Awaiting in-flight batch execution to finish...
Shutdown threw: FATAL: Database connection terminated abruptly
```

---

## 2. Logic Chain

1. **Premise 1 (Execution Timing):** In ECMAScript, an async function body executes synchronously until the first `await` keyword or throw statement. If an expression before or within `await` throws synchronously (such as a simulated connection crash inside `claimBatch`), execution immediately enters the IIFE's `finally` block before returning the rejected promise to the caller.
   *(Verified by Observation 1.1 & 1.3).*
2. **Premise 2 (Promise Overwrite):** In `apps/worker/src/daemon.ts`, `this.activeBatchPromise = null` is located inside the IIFE's `finally` block (line 156). Because line 160 (`this.activeBatchPromise = batchPromise;`) executes *after* the IIFE returns its rejected promise, `this.activeBatchPromise` is overwritten with the rejected promise.
   *(Directly verified by Observation 1.1 & 1.3).*
3. **Premise 3 (Dangling State):** At line 161 (`return await batchPromise;`), the rejected promise throws immediately out of `pollOnce()`. Because there is no enclosing `try ... finally` block around line 161, `this.activeBatchPromise` is never reset to `null`. It remains permanently set to a rejected promise.
   *(Directly verified by Observation 1.1, 1.2, & 1.3).*
4. **Premise 4 (Shutdown Crash):** In `shutdown()` at line 184, `if (this.activeBatchPromise)` evaluates to `true`. `Promise.race([this.activeBatchPromise, timeoutPromise])` at line 190 immediately rejects with the cached error from `this.activeBatchPromise` because no `.catch()` handler was attached.
   *(Directly verified by Observation 1.1 & 1.3).*
5. **Premise 5 (Resource Leak):** Because `Promise.race` in `shutdown()` has no `try / catch` envelope, the unhandled rejection aborts execution, bypassing lines 201–209 (`await this.queryClient.end()` and `this.removeSignalHandlers()`).
   *(Directly verified by Observation 1.1 & 1.3).*
6. **Conclusion:** Enclosing the await in `pollOnce()` within `try ... finally { this.activeBatchPromise = null; this.isProcessingBatch = false; }` and guarding `Promise.race` in `shutdown()` with `this.activeBatchPromise.catch(() => {})`, `try / catch`, and `clearTimeout` eliminates the race condition, prevents unhandled rejections, and guarantees clean resource disposal.
   *(Direct logical conclusion supported by empirical patch testing).*

---

## 3. Caveats

1. **Read-Only Explorer Constraint:** In accordance with team rules, this agent did not modify `apps/worker/src/daemon.ts` directly. The fix was verified via prototype extension and empirical unit test harnesses in memory. The Worker agent (`worker_m5_worker_1`) must apply the code diff to `apps/worker/src/daemon.ts`.
2. **Database Mock vs Real Network Partition:** While simulated via thrown errors in unit tests, in production, transient PostgreSQL connection drops (e.g. RDS failover or socket resets) behave identically: the query throws/rejects, triggering the exact same lifecycle pathway.

---

## 4. Conclusion

The daemon failure is caused by an asynchronous state cleanup order bug in `pollOnce()` combined with unguarded awaiting in `shutdown()`.

### Prescribed Remediation for the Worker Agent:
In `apps/worker/src/daemon.ts`:
1. In `pollOnce()` (lines 135–163):
   Remove `this.activeBatchPromise = null` from the inner IIFE `finally` block. Wrap `return await batchPromise;` with an outer `try ... finally` that sets `this.activeBatchPromise = null;` and `this.isProcessingBatch = false;`.
2. In `shutdown()` (lines 171–210):
   Wrap `this.activeBatchPromise.catch(() => {})` in `Promise.race`, enclose in `try / catch`, clear `timeoutTimer` in `finally`, and explicitly reset `this.activeBatchPromise = null;`.

Detailed technical documentation and the full file replacement are saved in:
`/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m5_rem_1/analysis.md`.

---

## 5. Verification Method

### 5.1 Project Test Command
After Worker applies the changes:
```bash
pnpm --filter @rumahkita/worker test
```
**Success Criteria:**
- 64 tests pass across 14 test suites.
- 0 failures.
- Exit status code: 0.

### 5.2 Specific Regression Command
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
**Success Criteria:**
- Output shows `Shutdown threw:` does NOT appear.
- "Database connections closed cleanly." and "Notification daemon stopped gracefully." are logged.
- Process exits with code 0.

### 5.3 Invalidation Conditions
- Any occurrence of `UnhandledPromiseRejection` or uncaught exception during `worker.shutdown()`.
- `this.activeBatchPromise` remaining non-null after `pollOnce()` finishes.
- Any failure in `pnpm --filter @rumahkita/worker test`.
