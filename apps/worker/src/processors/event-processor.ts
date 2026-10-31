import { eq } from 'drizzle-orm';
import { schema, DbClient, NotificationEvent } from '@rumahkita/db';
import type { NotificationEventPayload } from '@rumahkita/contracts';
import { AdapterFactory } from '../adapters';
import { calculateExponentialBackoff } from './retry';

export interface EventProcessorOptions {
  adapterFactory?: AdapterFactory;
  backoffBaseSeconds?: number;
}

export class EventProcessor {
  private readonly adapterFactory: AdapterFactory;
  private readonly backoffBaseSeconds: number;

  constructor(options: EventProcessorOptions = {}) {
    this.adapterFactory = options.adapterFactory || new AdapterFactory();
    this.backoffBaseSeconds =
      options.backoffBaseSeconds ||
      Number(process.env.WORKER_BACKOFF_BASE_SEC) ||
      30;
  }

  /**
   * Processes a single claimed outbox event outside of any long-lived DB transaction.
   * Dispatches the notification via the configured channel adapter, then commits
   * the terminal status ('SENT' or 'PENDING' retry / 'FAILED' dead-letter) to the database.
   */
  public async processEvent(db: DbClient, event: NotificationEvent): Promise<boolean> {
    try {
      const adapter = this.adapterFactory.getAdapter(event.channel);

      let payload = event.payload as NotificationEventPayload;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload) as NotificationEventPayload;
        } catch {
          // If already an object or unparsable, use as-is
        }
      }

      await adapter.send({
        eventId: event.id,
        recipient: event.recipient,
        eventType: event.eventType,
        payload,
      });

      // Update to SENT on success
      await db
        .update(schema.notificationEvents)
        .set({
          status: 'SENT',
          sentAt: new Date(),
          lastError: null,
          nextRetryAt: null,
        })
        .where(eq(schema.notificationEvents.id, event.id));

      return true;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const backoff = calculateExponentialBackoff(
        event.attempts,
        event.maxAttempts,
        this.backoffBaseSeconds
      );

      if (backoff.canRetry) {
        // Schedule next retry
        await db
          .update(schema.notificationEvents)
          .set({
            status: 'PENDING',
            lastError: errorMessage,
            nextRetryAt: backoff.nextRetryAt,
          })
          .where(eq(schema.notificationEvents.id, event.id));

        console.warn(
          `[Worker] Event ${event.id} failed attempt ${event.attempts}/${event.maxAttempts}. Scheduled retry in ${backoff.delaySeconds}s (at ${backoff.nextRetryAt?.toISOString()}): ${errorMessage}`
        );
      } else {
        // Dead-letter: exhausted max attempts
        await db
          .update(schema.notificationEvents)
          .set({
            status: 'FAILED',
            lastError: errorMessage,
            nextRetryAt: null,
          })
          .where(eq(schema.notificationEvents.id, event.id));

        console.error(
          `[Worker Dead-Letter] Event ${event.id} permanently failed after ${event.attempts} attempts: ${errorMessage}`
        );
      }

      return false;
    }
  }
}
