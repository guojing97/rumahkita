import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventProcessor } from '../processors/event-processor';
import { NotificationEvent } from '@rumahkita/db';

describe('EventProcessor', () => {
  it('updates status to SENT on successful dispatch', async () => {
    const recordedUpdates: any[] = [];
    const mockDb = {
      update: () => ({
        set: (values: any) => ({
          where: () => {
            recordedUpdates.push(values);
            return Promise.resolve();
          },
        }),
      }),
    } as any;

    const processor = new EventProcessor();
    const event: NotificationEvent = {
      id: '00000000-0000-4000-a000-000000000001',
      householdId: '00000000-0000-4000-a000-000000000002',
      itemId: '00000000-0000-4000-a000-000000000003',
      eventType: 'STOCK_LOW',
      channel: 'EMAIL',
      recipient: 'user@example.com',
      payload: {
        itemId: '00000000-0000-4000-a000-000000000003',
        itemName: 'Kecap Manis',
        unit: 'botol',
        currentStock: 1,
        threshold: 2,
        timestamp: new Date().toISOString(),
      },
      status: 'PROCESSING',
      attempts: 1,
      maxAttempts: 5,
      lastError: null,
      nextRetryAt: null,
      sentAt: null,
      createdAt: new Date(),
    };

    const success = await processor.processEvent(mockDb, event);
    assert.equal(success, true);
    assert.equal(recordedUpdates.length, 1);
    assert.equal(recordedUpdates[0].status, 'SENT');
    assert.ok(recordedUpdates[0].sentAt instanceof Date);
    assert.equal(recordedUpdates[0].lastError, null);
    assert.equal(recordedUpdates[0].nextRetryAt, null);
  });

  it('updates status to PENDING and schedules nextRetryAt on transient failure (attempts < maxAttempts)', async () => {
    const recordedUpdates: any[] = [];
    const mockDb = {
      update: () => ({
        set: (values: any) => ({
          where: () => {
            recordedUpdates.push(values);
            return Promise.resolve();
          },
        }),
      }),
    } as any;

    const processor = new EventProcessor({ backoffBaseSeconds: 30 });
    const event: NotificationEvent = {
      id: '00000000-0000-4000-a000-000000000002',
      householdId: '00000000-0000-4000-a000-000000000002',
      itemId: '00000000-0000-4000-a000-000000000003',
      eventType: 'STOCK_LOW',
      channel: 'EMAIL',
      recipient: 'fail@example.com', // Triggers simulated error
      payload: {
        itemId: '00000000-0000-4000-a000-000000000003',
        itemName: 'Kecap Manis',
        unit: 'botol',
        currentStock: 1,
        threshold: 2,
        timestamp: new Date().toISOString(),
      },
      status: 'PROCESSING',
      attempts: 2, // 2nd attempt, max is 5
      maxAttempts: 5,
      lastError: null,
      nextRetryAt: null,
      sentAt: null,
      createdAt: new Date(),
    };

    const success = await processor.processEvent(mockDb, event);
    assert.equal(success, false);
    assert.equal(recordedUpdates.length, 1);
    assert.equal(recordedUpdates[0].status, 'PENDING');
    assert.ok(recordedUpdates[0].nextRetryAt instanceof Date);
    assert.ok(recordedUpdates[0].lastError.includes('Simulated email delivery failure'));
  });

  it('updates status to FAILED and clears nextRetryAt when attempts reach maxAttempts (dead-letter)', async () => {
    const recordedUpdates: any[] = [];
    const mockDb = {
      update: () => ({
        set: (values: any) => ({
          where: () => {
            recordedUpdates.push(values);
            return Promise.resolve();
          },
        }),
      }),
    } as any;

    const processor = new EventProcessor({ backoffBaseSeconds: 30 });
    const event: NotificationEvent = {
      id: '00000000-0000-4000-a000-000000000003',
      householdId: '00000000-0000-4000-a000-000000000002',
      itemId: '00000000-0000-4000-a000-000000000003',
      eventType: 'STOCK_LOW',
      channel: 'EMAIL',
      recipient: 'fail@example.com',
      payload: {
        itemId: '00000000-0000-4000-a000-000000000003',
        itemName: 'Kecap Manis',
        unit: 'botol',
        currentStock: 1,
        threshold: 2,
        timestamp: new Date().toISOString(),
      },
      status: 'PROCESSING',
      attempts: 5, // Reached maxAttempts!
      maxAttempts: 5,
      lastError: null,
      nextRetryAt: null,
      sentAt: null,
      createdAt: new Date(),
    };

    const success = await processor.processEvent(mockDb, event);
    assert.equal(success, false);
    assert.equal(recordedUpdates.length, 1);
    assert.equal(recordedUpdates[0].status, 'FAILED');
    assert.equal(recordedUpdates[0].nextRetryAt, null);
    assert.ok(recordedUpdates[0].lastError.includes('Simulated email delivery failure'));
  });
});
