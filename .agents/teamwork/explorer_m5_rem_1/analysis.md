# Technical Analysis: Worker Daemon Lifecycle & Shutdown Defect Remediation

**Target File:** `apps/worker/src/daemon.ts`  
**Investigating Agent:** Explorer M5 Rem 1 (`explorer_m5_rem_1`)  
**Context:** Milestone 5 Remediation — Resolution of Challenger 2 Finding (Adversarial Worker Challenge)  
**Date:** 2026-10-28  

---

## 1. Executive Summary

During Milestone 5 Phase 2 adversarial stress testing, Challenger 2 discovered a critical asynchronous lifecycle bug in `NotificationWorker` (`apps/worker/src/daemon.ts`). When `OutboxPoller.claimBatch()` fails due to a database network partition, connection reset, or query rejection:
1. `pollOnce()` sets `this.activeBatchPromise` to a rejected promise *after* its internal `finally` block has already executed.
2. `this.activeBatchPromise` remains permanently non-null and references this rejected promise.
3. When `NotificationWorker.shutdown()` is called subsequently (or during an in-flight error), `Promise.race([this.activeBatchPromise, timeoutPromise])` awaits the rejected promise without error suppression (`.catch()`) or a surrounding `try/catch` block.
4. `shutdown()` crashes with an unhandled rejection, aborting execution before reaching database pool cleanup (`await this.queryClient.end()`) and signal handler unregistration (`this.removeSignalHandlers()`).
5. As a result, `pnpm --filter @rumahkita/worker test` fails at `src/__tests__/worker-adversarial-challenge.test.ts:588` with Exit Code 1, and production deployments risk resource exhaustion (orphaned database pool sockets and dangling OS signal listeners) under transient database errors.

This analysis provides the exact execution trace, empirical verification, architectural invariant requirements, and ready-to-apply drop-in replacement code for the Worker agent.

---

## 2. Asynchronous Execution Trace & Root Cause

### 2.1 The Flawed Implementation in `apps/worker/src/daemon.ts`

Lines 135–163:
```typescript
  public async pollOnce(): Promise<number> {
    if (this.isShuttingDown) return 0;

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
  }
```

Lines 183–198 in `shutdown()`:
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

    // Teardown database connection
    try {
      await this.queryClient.end();
      console.log('[RumahKita Worker] Database connections closed cleanly.');
    } catch (err) {
      console.error('[RumahKita Worker] Error closing database connections:', err);
    }

    this.removeSignalHandlers();
```

### 2.2 Execution Order Failure Analysis

#### Failure Path A: Synchronous / Immediate Throw in `claimBatch`
When `this.outboxPoller.claimBatch(...)` throws synchronously (or when an error occurs before asynchronous suspension):
1. The async IIFE `(async () => { ... })()` begins immediate synchronous evaluation up to the first suspension or throw.
2. `claimBatch()` throws `FATAL: Database connection terminated abruptly`.
3. The IIFE's `try` block immediately unwinds into its `finally` block (lines 154–157):
   - `this.isProcessingBatch = false;`
   - `this.activeBatchPromise = null;` (at this moment, `this.activeBatchPromise` was already `null`).
4. The async IIFE finishes and returns a rejected `Promise`.
5. The calling execution frame in `pollOnce()` continues to line 160:
   - `this.activeBatchPromise = batchPromise;`
   **Crucial Defect:** Line 160 executes *after* the IIFE's `finally` block has run! `this.activeBatchPromise` is overwritten with the rejected promise.
6. Line 161 executes:
   - `return await batchPromise;`
   Because `batchPromise` is rejected, `await` throws the database exception out of `pollOnce()`.
7. Because there is NO `try ... finally` wrapping line 161, `this.activeBatchPromise` is **never reset to null**.
8. State after `pollOnce()` throws:
   - `this.isProcessingBatch = false`
   - `this.activeBatchPromise = Promise { <rejected> Error: FATAL: Database connection... }`

#### Failure Path B: Shutdown Awaiting In-Flight Rejected Batch
Suppose `pollOnce()` is running asynchronously and `shutdown()` is called while `claimBatch` or event processing is still pending:
1. `shutdown()` checks `if (this.activeBatchPromise)` — this is truthy because `activeBatchPromise` is active.
2. `shutdown()` creates `timeoutPromise`.
3. `shutdown()` runs `const result = await Promise.race([this.activeBatchPromise, timeoutPromise])`.
4. While awaiting the race, `this.outboxPoller.claimBatch()` rejects with a database network error.
5. In JavaScript, `Promise.race([p1, p2])` settles with the state of whichever promise settles first. Because `p1` (`activeBatchPromise`) rejects, `Promise.race` immediately **rejects** with the same database error.
6. Because `Promise.race` has no surrounding `try/catch` block and `this.activeBatchPromise` does not have a `.catch()` rejection handler attached, `shutdown()` throws an unhandled rejection and immediately terminates execution.
7. Lines 200–210 are skipped:
   - `await this.queryClient.end();` is **never reached** (PostgreSQL connection pool sockets leaked).
   - `this.removeSignalHandlers();` is **never reached** (process SIGTERM/SIGINT event listeners leaked).

#### Failure Path C: Shutdown Called After Failed Poll
Even when `pollOnce()` has already completed and thrown (as in `worker-adversarial-challenge.test.ts:588`):
1. `pollOnce()` caught and logged by outer harness.
2. `await worker.shutdown()` is called.
3. Because of Failure Path A, `this.activeBatchPromise` is still holding the rejected promise from the earlier failed poll!
4. `shutdown()` sees `this.activeBatchPromise` is non-null.
5. It runs `await Promise.race([this.activeBatchPromise, timeoutPromise])`.
6. Since `this.activeBatchPromise` was already settled as rejected, `Promise.race` immediately rejects on the very next microtask turn.
7. `shutdown()` aborts and crashes before cleaning up connections and signal handlers.

---

## 3. Empirical Verification of the Defect

### 3.1 Isolated Reproduction
Running the reproduction script against the compiled daemon:
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

### 3.2 Full Test Suite Failure Log
Running `pnpm --filter @rumahkita/worker test`:
```text
✖ failing tests:

test at src/__tests__/worker-adversarial-challenge.test.ts:588:5
✖ survives poller database failure without crashing daemon iteration loop (1.216208ms)
  Error: FATAL: Database connection terminated abruptly (connection reset by peer)
      at Object.claimBatch (/Users/mac/Projects/03-Labs/RumahKita/apps/worker/src/__tests__/worker-adversarial-challenge.test.ts:593:17)
      at <anonymous> (/Users/mac/Projects/03-Labs/RumahKita/apps/worker/src/daemon.ts:141:48)
      at NotificationWorker.pollOnce (/Users/mac/Projects/03-Labs/RumahKita/apps/worker/src/daemon.ts:158:5)
      at TestContext.<anonymous> (/Users/mac/Projects/03-Labs/RumahKita/apps/worker/src/__tests__/worker-adversarial-challenge.test.ts:606:22)
```

---

## 4. Architectural Remediation Strategy

To achieve 100% test pass rate and leak-free lifecycle resilience under all error conditions, the following 4 engineering invariants must be enforced in `apps/worker/src/daemon.ts`:

### Invariant 1: Guaranteed State Cleanup in `pollOnce()`
`pollOnce()` must enclose the await on `batchPromise` in an outer `try ... finally` block. When `pollOnce()` finishes (whether normally or by throwing an error), both `this.activeBatchPromise` and `this.isProcessingBatch` must be unconditionally reset:
```typescript
    this.activeBatchPromise = batchPromise;
    try {
      return await batchPromise;
    } finally {
      this.activeBatchPromise = null;
      this.isProcessingBatch = false;
    }
```
This guarantees that regardless of whether `claimBatch` throws synchronously or asynchronously, `this.activeBatchPromise` will never hold a stale promise once `pollOnce()` exits.

### Invariant 2: Non-Rejection Drain in `shutdown()`
In `shutdown()`, when draining `this.activeBatchPromise`, the promise passed to `Promise.race()` must be guarded with `.catch(() => {})`:
```typescript
const result = await Promise.race([
  this.activeBatchPromise.catch(() => {}),
  timeoutPromise,
]);
```
If the in-flight batch fails or rejects during shutdown, `.catch(() => {})` converts the rejection into a resolved `undefined`, allowing `Promise.race` to settle cleanly rather than throwing an unhandled rejection.

### Invariant 3: Defensive Wrap and Timeout Timer Cleanup
The `Promise.race` in `shutdown()` must be wrapped in `try/catch` for defense-in-depth, and any scheduled timeout timer must be cleared via `clearTimeout` in a `finally` block to prevent lingering timer handles on the Node.js event loop:
```typescript
    if (this.activeBatchPromise) {
      console.log('[RumahKita Worker] Awaiting in-flight batch execution to finish...');
      let timeoutTimer: NodeJS.Timeout | null = null;
      const timeoutPromise = new Promise<'timeout'>((resolve) => {
        timeoutTimer = setTimeout(() => resolve('timeout'), timeoutMs);
      });

      try {
        const result = await Promise.race([
          this.activeBatchPromise.catch(() => {}),
          timeoutPromise,
        ]);
        if (result === 'timeout') {
          console.warn(
            `[RumahKita Worker] Shutdown drain exceeded timeout of ${timeoutMs}ms. Forcing exit.`
          );
        } else {
          console.log('[RumahKita Worker] In-flight batch successfully drained.');
        }
      } catch (err) {
        console.error('[RumahKita Worker] Error while awaiting in-flight batch during shutdown:', err);
      } finally {
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
        }
        this.activeBatchPromise = null;
      }
    }
```

### Invariant 4: Unconditional Teardown Execution
With Invariants 1–3 in place, `shutdown()` is guaranteed to proceed to lines:
```typescript
    // Teardown database connection
    try {
      await this.queryClient.end();
      console.log('[RumahKita Worker] Database connections closed cleanly.');
    } catch (err) {
      console.error('[RumahKita Worker] Error closing database connections:', err);
    }

    this.removeSignalHandlers();
```
Both database pool connections and OS process signal listeners are cleanly released without leaks.

---

## 5. Exact Replacement Code for the Worker Agent

Below is the complete, production-ready replacement for `apps/worker/src/daemon.ts`.

```typescript
import { createDatabaseClient, DbClient } from '@rumahkita/db';
import postgres from 'postgres';
import { OutboxPoller } from './polling/outbox-poller';
import { EventProcessor } from './processors/event-processor';

export interface NotificationWorkerOptions {
  db?: DbClient;
  queryClient?: postgres.Sql;
  outboxPoller?: OutboxPoller;
  eventProcessor?: EventProcessor;
  pollIntervalMs?: number;
  batchSize?: number;
  shutdownTimeoutMs?: number;
}

export class NotificationWorker {
  private isRunning = false;
  private isProcessingBatch = false;
  private activeBatchPromise: Promise<number> | null = null;
  private timer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  private readonly db: DbClient;
  private readonly queryClient: postgres.Sql;
  private readonly outboxPoller: OutboxPoller;
  private readonly eventProcessor: EventProcessor;
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;
  private readonly shutdownTimeoutMs: number;

  private boundSignalHandler: (() => Promise<void>) | null = null;

  constructor(options: NotificationWorkerOptions = {}) {
    if (options.db && options.queryClient) {
      this.db = options.db;
      this.queryClient = options.queryClient;
    } else {
      const client = createDatabaseClient({ maxConnections: 5 });
      this.db = client.db;
      this.queryClient = client.queryClient;
    }

    this.outboxPoller = options.outboxPoller || new OutboxPoller({ batchSize: options.batchSize });
    this.eventProcessor = options.eventProcessor || new EventProcessor();

    this.pollIntervalMs =
      options.pollIntervalMs ||
      Number(process.env.WORKER_POLL_INTERVAL_MS) ||
      5000;

    this.batchSize =
      options.batchSize ||
      Number(process.env.WORKER_BATCH_SIZE) ||
      Number(process.env.WORKER_MAX_CONCURRENCY) ||
      10;

    this.shutdownTimeoutMs = options.shutdownTimeoutMs || 10000;
  }

  public getRunningStatus(): boolean {
    return this.isRunning;
  }

  public getInFlightStatus(): boolean {
    return this.isProcessingBatch;
  }

  /**
   * Starts the polling loop and registers OS signal listeners for graceful shutdown.
   */
  public start(): void {
    if (this.isRunning || this.isShuttingDown) return;
    this.isRunning = true;

    console.log(
      `[RumahKita Worker] Notification daemon started. Polling interval: ${this.pollIntervalMs}ms, Batch size: ${this.batchSize}`
    );

    this.scheduleNextPoll();
  }

  /**
   * Registers SIGTERM and SIGINT listeners for graceful shutdown.
   */
  public setupSignalHandlers(): void {
    if (this.boundSignalHandler) return;

    this.boundSignalHandler = async () => {
      console.log('[RumahKita Worker] Termination signal received. Initiating graceful shutdown...');
      await this.shutdown();
      process.exit(0);
    };

    process.once('SIGTERM', this.boundSignalHandler);
    process.once('SIGINT', this.boundSignalHandler);
  }

  /**
   * Removes signal handlers (useful for testing or programmatic teardown).
   */
  public removeSignalHandlers(): void {
    if (this.boundSignalHandler) {
      process.removeListener('SIGTERM', this.boundSignalHandler);
      process.removeListener('SIGINT', this.boundSignalHandler);
      this.boundSignalHandler = null;
    }
  }

  /**
   * Schedules the next polling iteration using recursive setTimeout.
   * This guarantees polling iterations never overlap even under heavy processing load.
   */
  private scheduleNextPoll(): void {
    if (!this.isRunning || this.isShuttingDown) return;

    this.timer = setTimeout(async () => {
      try {
        await this.pollOnce();
      } catch (error) {
        console.error('[RumahKita Worker] Error during outbox poll iteration:', error);
      } finally {
        if (this.isRunning && !this.isShuttingDown) {
          this.scheduleNextPoll();
        }
      }
    }, this.pollIntervalMs);
  }

  /**
   * Executes a single polling iteration:
   * 1. Claims a batch of pending events using FOR UPDATE SKIP LOCKED.
   * 2. Concurrently dispatches events outside the DB transaction.
   * 3. Returns the number of events processed.
   */
  public async pollOnce(): Promise<number> {
    if (this.isShuttingDown) return 0;

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
      }
    })();

    this.activeBatchPromise = batchPromise;
    try {
      return await batchPromise;
    } finally {
      this.activeBatchPromise = null;
      this.isProcessingBatch = false;
    }
  }

  /**
   * Graceful shutdown:
   * 1. Halts polling ingestion.
   * 2. Clears pending timer.
   * 3. Waits for in-flight batch execution to settle (up to shutdownTimeoutMs).
   * 4. Closes database connection pool cleanly.
   */
  public async shutdown(timeoutMs: number = this.shutdownTimeoutMs): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    this.isRunning = false;

    console.log('[RumahKita Worker] Draining in-flight tasks and shutting down...');

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    // Wait for in-flight batch to drain within timeout
    if (this.activeBatchPromise) {
      console.log('[RumahKita Worker] Awaiting in-flight batch execution to finish...');
      let timeoutTimer: NodeJS.Timeout | null = null;
      const timeoutPromise = new Promise<'timeout'>((resolve) => {
        timeoutTimer = setTimeout(() => resolve('timeout'), timeoutMs);
      });

      try {
        const result = await Promise.race([
          this.activeBatchPromise.catch(() => {}),
          timeoutPromise,
        ]);
        if (result === 'timeout') {
          console.warn(
            `[RumahKita Worker] Shutdown drain exceeded timeout of ${timeoutMs}ms. Forcing exit.`
          );
        } else {
          console.log('[RumahKita Worker] In-flight batch successfully drained.');
        }
      } catch (err) {
        console.error('[RumahKita Worker] Error while awaiting in-flight batch during shutdown:', err);
      } finally {
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
        }
        this.activeBatchPromise = null;
      }
    }

    // Teardown database connection
    try {
      await this.queryClient.end();
      console.log('[RumahKita Worker] Database connections closed cleanly.');
    } catch (err) {
      console.error('[RumahKita Worker] Error closing database connections:', err);
    }

    this.removeSignalHandlers();
    console.log('[RumahKita Worker] Notification daemon stopped gracefully.');
  }
}
```

---

## 6. Verification and Invalidation Criteria

### 6.1 Worker Test Suite Verification
After applying the fix, run:
```bash
pnpm --filter @rumahkita/worker test
```
**Expected Outcome:**
- 64 tests pass across 14 suites (100% pass).
- `src/__tests__/worker-adversarial-challenge.test.ts:588` passes in ~1ms.
- Exit status code: 0.

### 6.2 Targeted Reproduction Script Verification
Execute:
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
**Expected Outcome:**
- `pollOnce` catches database error and logs it.
- `shutdown()` successfully drains without throwing.
- "Database connections closed cleanly."
- "Notification daemon stopped gracefully."
- Script exits with code 0.
