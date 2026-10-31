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
   * If claimedCount >= batchSize, schedule with 0ms delay for adaptive backlog drainage.
   */
  private scheduleNextPoll(delayMs: number = this.pollIntervalMs): void {
    if (!this.isRunning || this.isShuttingDown) return;

    this.timer = setTimeout(async () => {
      let claimedCount = 0;
      try {
        claimedCount = await this.pollOnce();
      } catch (error) {
        console.error('[RumahKita Worker] Error during outbox poll iteration:', error);
      } finally {
        if (this.isRunning && !this.isShuttingDown) {
          const nextDelay = claimedCount >= this.batchSize ? 0 : this.pollIntervalMs;
          this.scheduleNextPoll(nextDelay);
        }
      }
    }, delayMs);
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
