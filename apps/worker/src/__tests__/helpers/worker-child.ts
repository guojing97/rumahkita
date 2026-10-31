import { createDatabaseClient, schema } from '@rumahkita/db';
import { OutboxPoller } from '../../polling/outbox-poller';
import { inArray } from 'drizzle-orm';

interface WorkerMessage {
  command: 'start' | 'stop';
  batchSize?: number;
}

const poller = new OutboxPoller();
const { db, queryClient } = createDatabaseClient({ maxConnections: 3 });

process.on('message', async (msg: WorkerMessage) => {
  if (msg.command === 'start') {
    const batchSize = msg.batchSize || 10;
    const allClaimed: string[] = [];

    try {
      let hasMore = true;
      while (hasMore) {
        const events = await poller.claimBatch(db, batchSize);
        if (events.length === 0) {
          hasMore = false;
          break;
        }

        const ids = events.map((e) => e.id);
        allClaimed.push(...ids);

        // Mark as SENT in DB to simulate completion
        await db
          .update(schema.notificationEvents)
          .set({
            status: 'SENT',
            sentAt: new Date(),
            nextRetryAt: null,
          })
          .where(inArray(schema.notificationEvents.id, ids));

        // Yield slightly
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      if (process.send) {
        process.send({ status: 'done', claimedCount: allClaimed.length, claimedIds: allClaimed });
      }
    } catch (err: any) {
      if (process.send) {
        process.send({ status: 'error', error: err.message });
      }
    } finally {
      await queryClient.end();
      process.exit(0);
    }
  }
});
