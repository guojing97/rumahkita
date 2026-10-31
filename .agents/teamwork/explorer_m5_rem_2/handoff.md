# Handoff Report: Investigation of `apps/worker` Adversarial Test Failure

**Agent:** Explorer M5 Rem 2 (`explorer_m5_rem_2`)  
**Target:** Orchestrator (`70f30c57-3b98-4e37-8e6c-d4b8d72ee082`)  
**Date:** 2026-10-28  
**Handoff Type:** Hard  
**Status:** Investigation Complete (Read-Only)  

---

## 1. Observation

### 1.1 Source Code Inspection
1. `apps/worker/src/__tests__/worker-adversarial-challenge.test.ts` (lines 588–620):
   ```typescript
   588:     it('survives poller database failure without crashing daemon iteration loop', async () => {
   589:       let claimCalls = 0;
   590:       const failingPoller = {
   591:         claimBatch: () => {
   592:           claimCalls++;
   593:           throw new Error('FATAL: Database connection terminated abruptly (connection reset by peer)');
   594:         },
   595:       } as any;
   ...
   605:       let threwError = false;
   606:       try {
   607:         await worker.pollOnce();
   608:       } catch (err: any) {
   609:         threwError = true;
   610:         assert.ok(
   611:           /Database connection terminated abruptly/.test(err.message),
   612:           `Expected database connection error, got ${err.message}`
   613:         );
   614:       }
   615: 
   616:       assert.equal(threwError, true, 'pollOnce must propagate database rejection for logging');
   617:       assert.equal(worker.getInFlightStatus(), false, 'inFlight flag must be reset to false after crash');
   618: 
   619:       await worker.shutdown();
   620:     });
   ```
2. `apps/worker/src/daemon.ts` (lines 135–162):
   ```typescript
   135:   public async pollOnce(): Promise<number> {
   136:     if (this.isShuttingDown) return 0;
   137: 
   138:     this.isProcessingBatch = true;
   139:     const batchPromise = (async () => {
   140:       try {
   141:         const events = await this.outboxPoller.claimBatch(this.db, this.batchSize);
   ...
   154:       } finally {
   155:         this.isProcessingBatch = false;
   156:         this.activeBatchPromise = null;
   157:       }
   158:     })();
   159: 
   160:     this.activeBatchPromise = batchPromise;
   161:     return await batchPromise;
   162:   }
   ```
3. `apps/worker/src/daemon.ts` (lines 171–210):
   ```typescript
   184:     if (this.activeBatchPromise) {
   185:       console.log('[RumahKita Worker] Awaiting in-flight batch execution to finish...');
   186:       const timeoutPromise = new Promise<'timeout'>((resolve) =>
   187:         setTimeout(() => resolve('timeout'), timeoutMs)
   188:       );
   189: 
   190:       const result = await Promise.race([this.activeBatchPromise, timeoutPromise]);
   ...
   198:     }
   199: 
   200:     // Teardown database connection
   201:     try {
   202:       await this.queryClient.end();
   ...
   208:     this.removeSignalHandlers();
   ```

### 1.2 Tool Execution Commands & Verbatim Outputs
1. **Full Worker Test Suite Run (`pnpm --filter @rumahkita/worker test`):**
   ```text
   $ tsx --test "src/__tests__/**/*.test.ts"
   ...
   ℹ tests 64
   ℹ suites 14
   ℹ pass 63
   ℹ fail 1
   ℹ cancelled 0
   ℹ skipped 0
   ℹ todo 0
   ℹ duration_ms 10764.713481

   ✖ failing tests:

   test at src/__tests__/worker-adversarial-challenge.test.ts:588:5
   ✖ survives poller database failure without crashing daemon iteration loop (0.869485ms)
     Error: FATAL: Database connection terminated abruptly (connection reset by peer)
         at Object.claimBatch (/Users/mac/Projects/03-Labs/RumahKita/apps/worker/src/__tests__/worker-adversarial-challenge.test.ts:593:17)
         at <anonymous> (/Users/mac/Projects/03-Labs/RumahKita/apps/worker/src/daemon.ts:141:48)
         at NotificationWorker.pollOnce (/Users/mac/Projects/03-Labs/RumahKita/apps/worker/src/daemon.ts:158:5)
         at TestContext.<anonymous> (/Users/mac/Projects/03-Labs/RumahKita/apps/worker/src/__tests__/worker-adversarial-challenge.test.ts:606:22)
   ```
2. **Individual Suite Audits:**
   - `adapters.test.ts`, `retry.test.ts`, `poller-and-concurrency.test.ts`, `event-processor.test.ts`, `daemon-lifecycle.test.ts`:
     Command: `pnpm --filter @rumahkita/worker exec tsx --test "src/__tests__/adapters.test.ts" "src/__tests__/retry.test.ts" "src/__tests__/poller-and-concurrency.test.ts" "src/__tests__/event-processor.test.ts" "src/__tests__/daemon-lifecycle.test.ts"`
     Result: `ℹ tests 30, ℹ pass 30, ℹ fail 0, exit code 0`
   - `concurrency-stress.test.ts`:
     Command: `pnpm --filter @rumahkita/worker exec tsx --test "src/__tests__/concurrency-stress.test.ts"`
     Result: `ℹ tests 10, ℹ pass 10, ℹ fail 0, duration_ms 7394.21663, exit code 0`
   - `worker-adversarial-challenge.test.ts`:
     Command: `pnpm --filter @rumahkita/worker exec tsx --test "src/__tests__/worker-adversarial-challenge.test.ts"`
     Result: `ℹ tests 24, ℹ pass 23, ℹ fail 1 (at line 588)`

3. **Synchronous Execution Order Proof:**
   Verified with Node.js reproduction script that when `claimBatch` throws synchronously inside `(async () => { ... })()`:
   - IIFE `finally` block runs immediately (`activeBatchPromise = null`).
   - IIFE returns rejected promise `batchPromise`.
   - Line 160 overwrites `this.activeBatchPromise = batchPromise`.
   - `shutdown()` awaits `Promise.race([this.activeBatchPromise, timeoutPromise])` and throws `FATAL: Database connection terminated abruptly`.

---

## 2. Logic Chain

1. **Observation 1.1.1** establishes that the failing test defines a poller whose `claimBatch` synchronously throws `Error('FATAL: Database connection terminated abruptly (connection reset by peer)')`.
2. **Observation 1.1.2** reveals that `pollOnce()` executes `claimBatch` inside an anonymous async IIFE `batchPromise = (async () => { ... })()`.
3. In JavaScript execution semantics, when a function throws synchronously before any `await` expression yields, the async IIFE runs synchronously until that throw and enters its `finally` block (lines 154–157), where `this.activeBatchPromise = null` is executed.
4. The async IIFE returns the rejected `batchPromise` to the outer `pollOnce()` scope. Line 160 (`this.activeBatchPromise = batchPromise;`) executes *after* the IIFE's `finally` block, thereby re-assigning the rejected promise back into `this.activeBatchPromise`.
5. In **Observation 1.1.1**, the test harness catches the error thrown by `await worker.pollOnce()` at lines 606–614, and verifies that `threwError === true` and `worker.getInFlightStatus() === false`. Both assertions succeed.
6. The test harness then executes `await worker.shutdown()` at line 619.
7. In **Observation 1.1.3**, `shutdown()` inspects `this.activeBatchPromise`. Because `this.activeBatchPromise` was leaked as a rejected promise in Step 4, line 190 executes `Promise.race([this.activeBatchPromise, timeoutPromise])`.
8. `Promise.race` immediately rejects with the unhandled rejection from `this.activeBatchPromise`. Because line 190 lacks a `try/catch` wrapper and `this.activeBatchPromise` lacks a `.catch()` rejection handler, `shutdown()` throws, aborting before closing database connections (line 202) or removing signal listeners (line 208).
9. The rejection escapes `worker.shutdown()` at line 619. Because line 619 is not within a `try/catch` block, the Node test runner fails the test as recorded in **Observation 1.2.1**.
10. In **Observation 1.2.2**, all other 63 tests across the remaining test suites pass cleanly, demonstrating that the PostgreSQL row-locking protocol, retry formulas, adapter validations, and poison pill handling are fully functional, and that this failure is strictly localized to the lifecycle promise management in `NotificationWorker`.

---

## 3. Caveats

1. **Read-Only Explorer Scope:** In accordance with the Explorer mandate, no production files or test files were modified during this investigation.
2. **PostgreSQL Container Dependency:** Concurrency integration tests in `concurrency-stress.test.ts` require the local PostgreSQL Docker container to be running (port 5432). All 10 tests passed against the active container.
3. **Database Connection Pool Teardown:** The failure in `shutdown()` leaves the database connection pool open in failed iterations. Fixing this lifecycle defect is critical to prevent connection exhaustion in long-running worker deployments.

---

## 4. Conclusion

The worker failure at `src/__tests__/worker-adversarial-challenge.test.ts:588` is caused by two compounding lifecycle defects in `apps/worker/src/daemon.ts`:
1. **Promise Leak in `pollOnce()` (lines 135–162):** Assigning `this.activeBatchPromise = batchPromise` outside the async IIFE after its `finally` block has already run leaks rejected promises into daemon state on synchronous errors.
2. **Unhandled Rejection in `shutdown()` (lines 184–198):** Racing `this.activeBatchPromise` against `timeoutPromise` without a `.catch()` handler or `try/catch` block causes `shutdown()` to crash and leak database connection pools and signal handlers when in-flight batches fail.

### Required Code Fix (Communicated for Implementer)
In `apps/worker/src/daemon.ts`:
1. Enclose the body of `pollOnce()` in an outer `try ... finally` block:
   ```typescript
   public async pollOnce(): Promise<number> {
     if (this.isShuttingDown) return 0;

     this.isProcessingBatch = true;
     try {
       const batchPromise = (async () => {
         const events = await this.outboxPoller.claimBatch(this.db, this.batchSize);
         if (events.length === 0) return 0;
         console.log(`[RumahKita Worker] Claimed ${events.length} notification event(s) for processing.`);
         await Promise.allSettled(
           events.map((event) => this.eventProcessor.processEvent(this.db, event))
         );
         return events.length;
       })();

       this.activeBatchPromise = batchPromise;
       return await batchPromise;
     } finally {
       this.isProcessingBatch = false;
       this.activeBatchPromise = null;
     }
   }
   ```
2. In `shutdown()`, swallow batch errors during drain so that teardown always completes:
   ```typescript
   if (this.activeBatchPromise) {
     console.log('[RumahKita Worker] Awaiting in-flight batch execution to finish...');
     const timeoutPromise = new Promise<'timeout'>((resolve) =>
       setTimeout(() => resolve('timeout'), timeoutMs)
     );

     try {
       const result = await Promise.race([
         this.activeBatchPromise.catch((err) => {
           console.warn('[RumahKita Worker] In-flight batch failed during shutdown drain:', err);
           return 'error' as const;
         }),
         timeoutPromise,
       ]);
       if (result === 'timeout') {
         console.warn(
           `[RumahKita Worker] Shutdown drain exceeded timeout of ${timeoutMs}ms. Forcing exit.`
         );
       } else {
         console.log('[RumahKita Worker] In-flight batch settled.');
       }
     } catch (err) {
       console.warn('[RumahKita Worker] Error while awaiting in-flight batch drain:', err);
     }
   }
   ```

---

## 5. Verification Method

To independently verify the fix:

1. **Verify Line 588 Adversarial Test:**
   ```bash
   pnpm --filter @rumahkita/worker exec tsx --test "src/__tests__/worker-adversarial-challenge.test.ts"
   ```
   *Expected:* All 24 tests pass (0 failures), exit code 0.

2. **Verify Full Worker Test Suite:**
   ```bash
   pnpm --filter @rumahkita/worker test
   ```
   *Expected:* All 64 tests pass across 14 suites, exit code 0.

3. **Verify Typecheck and Build:**
   ```bash
   pnpm --filter @rumahkita/worker typecheck
   pnpm --filter @rumahkita/worker build
   ```
   *Expected:* Zero TypeScript errors, clean compilation into `dist/`.

4. **Invalidation Conditions:**
   - Any failure in `worker-adversarial-challenge.test.ts:588` or unhandled rejections during `shutdown()`.
   - `this.activeBatchPromise` remaining non-null after `pollOnce()` rejects.
   - Any regression in `concurrency-stress.test.ts` (10 tests).
