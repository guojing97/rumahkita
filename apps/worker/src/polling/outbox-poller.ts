import { eq, and, or, isNull, lte, asc, inArray, sql } from 'drizzle-orm';
import { schema, DbClient, NotificationEvent } from '@rumahkita/db';

export interface OutboxPollerOptions {
  batchSize?: number;
  leaseDurationMs?: number; // Lease duration for processing lock (default 5 minutes)
}

export class OutboxPoller {
  private readonly defaultBatchSize: number;
  private readonly defaultLeaseDurationMs: number;

  constructor(options: OutboxPollerOptions = {}) {
    this.defaultBatchSize = options.batchSize || 10;
    this.defaultLeaseDurationMs = options.leaseDurationMs || 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Performs an atomic two-phase claim of pending outbox events using PostgreSQL's
   * SELECT ... FOR UPDATE SKIP LOCKED.
   *
   * In Phase 1 (short DB transaction):
   *  1. Sweeps expired PROCESSING rows where attempts >= maxAttempts directly to FAILED (zombie recovery).
   *  2. Locks eligible rows skipping any rows locked by concurrent workers.
   *  3. Transitions claimed rows to status 'PROCESSING'.
   *  4. Increments attempts by 1.
   *  5. Sets lease expiry nextRetryAt = NOW() + leaseDurationMs in PostgreSQL.
   *
   * Returns claimed events for processing outside the database transaction.
   */
  public async claimBatch(
    db: DbClient,
    batchSize: number = this.defaultBatchSize,
    leaseDurationMs: number = this.defaultLeaseDurationMs
  ): Promise<NotificationEvent[]> {
    return await db.transaction(async (tx) => {
      // 1. Pre-claim sweeper: update expired PROCESSING rows where attempts >= maxAttempts
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

      // 2. Select eligible events using PostgreSQL NOW() for clock skew immunity:
      // - PENDING events where nextRetryAt is NULL or in the past
      // - Stale PROCESSING events where the lease has expired (worker crashed recovery)
      const candidateEvents = await tx
        .select()
        .from(schema.notificationEvents)
        .where(
          or(
            and(
              eq(schema.notificationEvents.status, 'PENDING'),
              or(
                isNull(schema.notificationEvents.nextRetryAt),
                lte(schema.notificationEvents.nextRetryAt, sql`NOW()`)
              )
            ),
            and(
              eq(schema.notificationEvents.status, 'PROCESSING'),
              sql`${schema.notificationEvents.attempts} < ${schema.notificationEvents.maxAttempts}`,
              lte(schema.notificationEvents.nextRetryAt, sql`NOW()`)
            )
          )
        )
        .orderBy(asc(schema.notificationEvents.createdAt))
        .limit(batchSize)
        .for('update', { skipLocked: true });

      if (candidateEvents.length === 0) {
        return [];
      }

      const ids = candidateEvents.map((e) => e.id);
      const leaseExpiry = new Date(Date.now() + leaseDurationMs);

      await tx
        .update(schema.notificationEvents)
        .set({
          status: 'PROCESSING',
          attempts: sql`${schema.notificationEvents.attempts} + 1`,
          nextRetryAt: sql`NOW() + (${leaseDurationMs} || ' milliseconds')::interval`,
        })
        .where(inArray(schema.notificationEvents.id, ids));

      return candidateEvents.map((e) => ({
        ...e,
        attempts: e.attempts + 1,
        status: 'PROCESSING' as const,
        nextRetryAt: leaseExpiry,
      }));
    });
  }
}
