import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NotificationWorker } from '../daemon';

describe('NotificationWorker Lifecycle', () => {
  it('initializes and manages start/stop state cleanly', async () => {
    let closed = false;
    const mockQueryClient = {
      end: () => {
        closed = true;
        return Promise.resolve();
      },
    } as any;

    const mockPoller = {
      claimBatch: () => Promise.resolve([]),
    } as any;

    const worker = new NotificationWorker({
      db: {} as any,
      queryClient: mockQueryClient,
      outboxPoller: mockPoller,
      pollIntervalMs: 50,
    });

    assert.equal(worker.getRunningStatus(), false);
    worker.start();
    assert.equal(worker.getRunningStatus(), true);

    await worker.shutdown();
    assert.equal(worker.getRunningStatus(), false);
    assert.equal(closed, true);
  });

  it('pollOnce claims batch and processes items', async () => {
    let processedCount = 0;
    const mockEvents = [
      { id: 'e1', channel: 'EMAIL' },
      { id: 'e2', channel: 'WHATSAPP' },
    ];

    const mockPoller = {
      claimBatch: () => Promise.resolve(mockEvents),
    } as any;

    const mockProcessor = {
      processEvent: () => {
        processedCount++;
        return Promise.resolve(true);
      },
    } as any;

    const worker = new NotificationWorker({
      db: {} as any,
      queryClient: { end: () => Promise.resolve() } as any,
      outboxPoller: mockPoller,
      eventProcessor: mockProcessor,
    });

    const count = await worker.pollOnce();
    assert.equal(count, 2);
    assert.equal(processedCount, 2);

    await worker.shutdown();
  });

  it('registers and unregisters signal handlers without leaking listeners', () => {
    const worker = new NotificationWorker({
      db: {} as any,
      queryClient: { end: () => Promise.resolve() } as any,
      outboxPoller: { claimBatch: () => Promise.resolve([]) } as any,
    });

    const initialSigtermCount = process.listenerCount('SIGTERM');
    worker.setupSignalHandlers();
    assert.equal(process.listenerCount('SIGTERM'), initialSigtermCount + 1);

    worker.removeSignalHandlers();
    assert.equal(process.listenerCount('SIGTERM'), initialSigtermCount);
  });

  it('drains active in-flight batch during shutdown', async () => {
    let processingDone = false;

    const mockPoller = {
      claimBatch: () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve([{ id: 'slow-event', channel: 'EMAIL' }]);
          }, 40);
        }),
    } as any;

    const mockProcessor = {
      processEvent: () =>
        new Promise((resolve) => {
          setTimeout(() => {
            processingDone = true;
            resolve(true);
          }, 80);
        }),
    } as any;

    const worker = new NotificationWorker({
      db: {} as any,
      queryClient: { end: () => Promise.resolve() } as any,
      outboxPoller: mockPoller,
      eventProcessor: mockProcessor,
      pollIntervalMs: 20,
      shutdownTimeoutMs: 1000,
    });

    // Start a background poll
    const pollPromise = worker.pollOnce();

    // Trigger shutdown while pollOnce is in flight
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(worker.getInFlightStatus(), true);

    await worker.shutdown(2000);
    assert.equal(worker.getInFlightStatus(), false);
    assert.equal(processingDone, true);
    await pollPromise;
  });
});
