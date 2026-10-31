import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OutboxPoller } from '../polling/outbox-poller';

describe('OutboxPoller', () => {
  it('returns empty array when no events match polling query', async () => {
    let claimUpdateCalled = false;
    let sweepUpdateCalled = false;
    const mockTx = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => ({
                for: (_mode: string, _opts: any) => Promise.resolve([]),
              }),
            }),
          }),
        }),
      }),
      update: () => ({
        set: (values: any) => {
          if (values.status === 'FAILED') {
            sweepUpdateCalled = true;
          } else if (values.status === 'PROCESSING') {
            claimUpdateCalled = true;
          }
          return {
            where: () => Promise.resolve(),
          };
        },
      }),
    };

    const mockDb = {
      transaction: (callback: any) => callback(mockTx),
    } as any;

    const poller = new OutboxPoller({ batchSize: 5 });
    const claimed = await poller.claimBatch(mockDb, 5);

    assert.equal(claimed.length, 0);
    assert.equal(sweepUpdateCalled, true, 'Sweeper update must run before candidate selection');
    assert.equal(claimUpdateCalled, false, 'No claim update when candidate list is empty');
  });

  it('claims pending events and transitions them to PROCESSING with attempts incremented', async () => {
    let updatedSetPayload: any = null;
    const fakeEvents = [
      {
        id: 'evt-claim-1',
        householdId: 'h-1',
        itemId: 'item-1',
        eventType: 'STOCK_LOW',
        channel: 'EMAIL',
        recipient: 'test@example.com',
        payload: { itemName: 'Beras' },
        status: 'PENDING',
        attempts: 0,
        maxAttempts: 5,
        lastError: null,
        nextRetryAt: null,
        sentAt: null,
        createdAt: new Date(),
      },
      {
        id: 'evt-claim-2',
        householdId: 'h-1',
        itemId: 'item-2',
        eventType: 'STOCK_OUT',
        channel: 'WHATSAPP',
        recipient: '+6281234567890',
        payload: { itemName: 'Minyak' },
        status: 'PENDING',
        attempts: 1,
        maxAttempts: 5,
        lastError: 'prev error',
        nextRetryAt: new Date(Date.now() - 1000),
        sentAt: null,
        createdAt: new Date(),
      },
    ];

    const mockTx = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => ({
                for: (mode: string, opts: any) => {
                  assert.equal(mode, 'update');
                  assert.equal(opts.skipLocked, true);
                  return Promise.resolve(fakeEvents);
                },
              }),
            }),
          }),
        }),
      }),
      update: () => ({
        set: (values: any) => {
          if (values.status === 'PROCESSING') {
            updatedSetPayload = values;
          }
          return {
            where: () => Promise.resolve(),
          };
        },
      }),
    };

    const mockDb = {
      transaction: (callback: any) => callback(mockTx),
    } as any;

    const poller = new OutboxPoller({ batchSize: 10, leaseDurationMs: 300000 });
    const claimed = await poller.claimBatch(mockDb, 10);

    assert.equal(claimed.length, 2);
    assert.equal(updatedSetPayload.status, 'PROCESSING');
    assert.ok(updatedSetPayload.nextRetryAt !== undefined);

    // Verify claimed items have incremented attempts and PROCESSING status
    assert.equal(claimed[0].attempts, 1);
    assert.equal(claimed[0].status, 'PROCESSING');
    assert.equal(claimed[1].attempts, 2);
    assert.equal(claimed[1].status, 'PROCESSING');
  });

  it('sweeps expired PROCESSING events at maxAttempts to FAILED status', async () => {
    let sweeperPayload: any = null;
    const mockTx = {
      update: () => ({
        set: (values: any) => {
          if (values.status === 'FAILED') {
            sweeperPayload = values;
          }
          return {
            where: () => Promise.resolve(),
          };
        },
      }),
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => ({
                for: (_mode: string, _opts: any) => Promise.resolve([]),
              }),
            }),
          }),
        }),
      }),
    };

    const mockDb = {
      transaction: (callback: any) => callback(mockTx),
    } as any;

    const poller = new OutboxPoller({ batchSize: 5 });
    await poller.claimBatch(mockDb, 5);

    assert.ok(sweeperPayload);
    assert.equal(sweeperPayload.status, 'FAILED');
    assert.equal(sweeperPayload.lastError, 'Execution timed out and exceeded maximum retry attempts');
    assert.equal(sweeperPayload.nextRetryAt, null);
  });
});
