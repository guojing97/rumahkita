import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { resolve } from 'node:path';
import { inArray } from 'drizzle-orm';
import { createDatabaseClient, schema, DbClient } from '@rumahkita/db';
import { OutboxPoller } from '../polling/outbox-poller';
import { EventProcessor } from '../processors/event-processor';
import { AdapterFactory } from '../adapters';
import { NotificationAdapter, SendNotificationOptions, SendResult } from '../adapters/types';
import { NotificationWorker } from '../daemon';

describe('Adversarial Outbox Concurrency & Stress Verification', () => {
  let dbClient: { db: DbClient; queryClient: any };
  let householdId: string;
  let itemId: string;

  before(async () => {
    dbClient = createDatabaseClient({ maxConnections: 20 });
    const [h] = await dbClient.queryClient`SELECT id FROM households LIMIT 1`;
    const [item] = await dbClient.queryClient`SELECT id FROM items LIMIT 1`;
    if (!h || !item) {
      throw new Error('Database not seeded with household or items');
    }
    householdId = h.id;
    itemId = item.id;
    await dbClient.queryClient`DELETE FROM notification_events`;
  });

  after(async () => {
    // Clean up test events
    await dbClient.queryClient`DELETE FROM notification_events`;
    await dbClient.queryClient.end();
  });

  beforeEach(async () => {
    // Clean up test events between tests
    await dbClient.queryClient`DELETE FROM notification_events`;
  });

  // Helper to insert batch of test events
  async function insertTestEvents(
    count: number,
    options: {
      status?: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED';
      attempts?: number;
      maxAttempts?: number;
      nextRetryAt?: Date | null;
      tag?: string;
    } = {}
  ): Promise<string[]> {
    const status = options.status || 'PENDING';
    const attempts = options.attempts ?? 0;
    const maxAttempts = options.maxAttempts ?? 5;
    const nextRetryAt = options.nextRetryAt !== undefined ? options.nextRetryAt : null;
    const tag = options.tag || 'run';

    const eventsToInsert = Array.from({ length: count }, (_, i) => ({
      householdId,
      itemId,
      eventType: 'STOCK_LOW',
      channel: 'EMAIL' as const,
      recipient: `stress_${tag}_${Date.now()}_${i}@example.com`,
      payload: {
        itemName: `Stress Item ${i}`,
        currentStock: 1,
        minStock: 5,
        unit: 'pcs',
      },
      status,
      attempts,
      maxAttempts,
      nextRetryAt,
      createdAt: new Date(Date.now() - 1000 * (count - i)), // preserve ordering
    }));

    const inserted = await dbClient.db
      .insert(schema.notificationEvents)
      .values(eventsToInsert)
      .returning({ id: schema.notificationEvents.id });

    return inserted.map((e) => e.id);
  }

  // ---------------------------------------------------------------------------
  // Test 1: High-Concurrency Burst Claiming (10 workers, 50 PENDING events)
  // ---------------------------------------------------------------------------
  it('TEST-1: High-concurrency burst claiming ensures 0 duplicate claims and 0 skipped events across 10 workers', async () => {
    const totalEvents = 50;
    const eventIds = await insertTestEvents(totalEvents, { tag: 'burst' });
    assert.equal(eventIds.length, totalEvents);

    const poller = new OutboxPoller({ batchSize: 5 });
    const numWorkers = 10;

    // Create 10 independent database clients with separate connection pools to simulate true concurrent workers
    const workerClients = Array.from({ length: numWorkers }, () =>
      createDatabaseClient({ maxConnections: 3 })
    );

    try {
      // Launch 10 concurrent claimBatch calls simultaneously
      const claimResults = await Promise.all(
        workerClients.map(async (client, workerIdx) => {
          const claimed = await poller.claimBatch(client.db, 5);
          return { workerIdx, claimed };
        })
      );

      const allClaimedIds: string[] = [];
      for (const res of claimResults) {
        for (const evt of res.claimed) {
          allClaimedIds.push(evt.id);
        }
      }

      // 1. Verify total claimed count matches inserted count
      assert.equal(
        allClaimedIds.length,
        totalEvents,
        `Expected ${totalEvents} total claimed events, but got ${allClaimedIds.length}`
      );

      // 2. Verify 0 duplicate claims (mutual exclusion via FOR UPDATE SKIP LOCKED)
      const uniqueClaimedIds = new Set(allClaimedIds);
      assert.equal(
        uniqueClaimedIds.size,
        totalEvents,
        `Expected ${totalEvents} unique events, but got ${uniqueClaimedIds.size} (Duplicates detected!)`
      );

      // 3. Verify all events in database are now 'PROCESSING' with attempts = 1
      const dbRows = await dbClient.db
        .select()
        .from(schema.notificationEvents)
        .where(inArray(schema.notificationEvents.id, eventIds));

      assert.equal(dbRows.length, totalEvents);
      for (const row of dbRows) {
        assert.equal(row.status, 'PROCESSING', `Event ${row.id} expected PROCESSING, got ${row.status}`);
        assert.equal(row.attempts, 1, `Event ${row.id} expected attempts = 1, got ${row.attempts}`);
        assert.ok(row.nextRetryAt, `Event ${row.id} nextRetryAt should be set`);

        // Safety lease should be ~5 minutes in the future
        const leaseDeltaMs = row.nextRetryAt.getTime() - Date.now();
        assert.ok(
          leaseDeltaMs > 280000 && leaseDeltaMs < 310000,
          `Lease delta was ${leaseDeltaMs}ms, expected ~300000ms (5 min)`
        );
      }

      // 4. Subsequent poll must find 0 available events (none left unlocked or unmanaged)
      const followUpClaim = await poller.claimBatch(dbClient.db, 10);
      assert.equal(followUpClaim.length, 0, 'Follow-up claim should find 0 remaining events');
    } finally {
      await Promise.all(workerClients.map((c) => c.queryClient.end()));
    }
  });

  // ---------------------------------------------------------------------------
  // Test 2: In-Flight Safety Lease Protection (Zero Premature Reclaims)
  // ---------------------------------------------------------------------------
  it('TEST-2: Active safety lease strictly protects in-flight processing from premature reclaim by concurrent workers', async () => {
    const totalEvents = 10;
    const eventIds = await insertTestEvents(totalEvents, { tag: 'lease_protect' });

    const poller = new OutboxPoller({ batchSize: 10, leaseDurationMs: 300000 });

    // Worker 1 claims all 10 events
    const claimedByWorker1 = await poller.claimBatch(dbClient.db, 10);
    assert.equal(claimedByWorker1.length, 10);

    // Simulate in-flight processing: While Worker 1 holds the lease (nextRetryAt = NOW() + 5 min),
    // Workers 2, 3, 4, 5 simultaneously try to claimBatch()
    const concurrentWorkers = Array.from({ length: 4 }, () =>
      createDatabaseClient({ maxConnections: 2 })
    );

    try {
      const reclaims = await Promise.all(
        concurrentWorkers.map((c) => poller.claimBatch(c.db, 10))
      );

      // Verify NO worker reclaimed any in-flight event
      for (let i = 0; i < reclaims.length; i++) {
        assert.equal(
          reclaims[i].length,
          0,
          `Concurrent Worker ${i + 2} illegally reclaimed ${reclaims[i].length} in-flight event(s)`
        );
      }

      // Verify DB state remains unchanged at attempts = 1
      const dbRows = await dbClient.db
        .select()
        .from(schema.notificationEvents)
        .where(inArray(schema.notificationEvents.id, eventIds));

      for (const row of dbRows) {
        assert.equal(row.status, 'PROCESSING');
        assert.equal(row.attempts, 1);
      }
    } finally {
      await Promise.all(concurrentWorkers.map((c) => c.queryClient.end()));
    }
  });

  // ---------------------------------------------------------------------------
  // Test 3: Stale Lease Recovery (Worker Crash Recovery)
  // ---------------------------------------------------------------------------
  it('TEST-3: Stale expired lease on crashed worker is safely reclaimed with attempts incremented and new lease set', async () => {
    const totalEvents = 6;
    // Insert events simulated as abandoned by a crashed worker:
    // status = 'PROCESSING', attempts = 1, nextRetryAt expired 20 seconds ago
    const expiredLease = new Date(Date.now() - 20000);
    const eventIds = await insertTestEvents(totalEvents, {
      status: 'PROCESSING',
      attempts: 1,
      maxAttempts: 5,
      nextRetryAt: expiredLease,
      tag: 'stale_recovery',
    });

    const poller = new OutboxPoller({ batchSize: 3 });

    // 3 concurrent workers race to recover the 6 stale events
    const recoveryWorkers = Array.from({ length: 3 }, () =>
      createDatabaseClient({ maxConnections: 2 })
    );

    try {
      const recoveryResults = await Promise.all(
        recoveryWorkers.map((c) => poller.claimBatch(c.db, 3))
      );

      const allRecoveredIds: string[] = [];
      for (const res of recoveryResults) {
        for (const evt of res) {
          allRecoveredIds.push(evt.id);
          assert.equal(evt.attempts, 2, 'Reclaimed event must have attempts incremented to 2');
          assert.equal(evt.status, 'PROCESSING');
        }
      }

      // Total recovered must equal 6 with 0 duplicates
      assert.equal(allRecoveredIds.length, totalEvents);
      const uniqueRecoveredIds = new Set(allRecoveredIds);
      assert.equal(uniqueRecoveredIds.size, totalEvents);

      // Verify DB rows updated to attempts = 2 and fresh lease
      const dbRows = await dbClient.db
        .select()
        .from(schema.notificationEvents)
        .where(inArray(schema.notificationEvents.id, eventIds));

      for (const row of dbRows) {
        assert.equal(row.status, 'PROCESSING');
        assert.equal(row.attempts, 2);
        assert.ok(row.nextRetryAt && row.nextRetryAt.getTime() > Date.now());
      }
    } finally {
      await Promise.all(recoveryWorkers.map((c) => c.queryClient.end()));
    }
  });

  // ---------------------------------------------------------------------------
  // Test 4: Max Attempts Guard on Expired Lease & Zombie Sweeper
  // ---------------------------------------------------------------------------
  it('TEST-4: Events that reached maxAttempts are guarded from infinite reclamation loops and swept to FAILED', async () => {
    const expiredLease = new Date(Date.now() - 20000);
    // Insert event with attempts = 5, maxAttempts = 5 in PROCESSING with expired lease
    const eventIds = await insertTestEvents(2, {
      status: 'PROCESSING',
      attempts: 5,
      maxAttempts: 5,
      nextRetryAt: expiredLease,
      tag: 'max_attempts_guard',
    });

    const poller = new OutboxPoller({ batchSize: 10 });
    const claimed = await poller.claimBatch(dbClient.db, 10);

    // Should NOT be claimed because attempts < maxAttempts is false
    assert.equal(claimed.length, 0, 'Events at maxAttempts must not be claimed');

    // DB rows swept to FAILED with error recorded and lease cleared
    const dbRows = await dbClient.db
      .select()
      .from(schema.notificationEvents)
      .where(inArray(schema.notificationEvents.id, eventIds));

    for (const row of dbRows) {
      assert.equal(row.attempts, 5);
      assert.equal(row.status, 'FAILED');
      assert.equal(row.nextRetryAt, null);
      assert.equal(row.lastError, 'Execution timed out and exceeded maximum retry attempts');
    }
  });

  // ---------------------------------------------------------------------------
  // Test 5: End-to-End Concurrent Processing Loop with Artificial Latency
  // ---------------------------------------------------------------------------
  it('TEST-5: End-to-end concurrent worker execution with dispatch latency produces 0 duplicates and 100% completion', async () => {
    const totalEvents = 20;
    const eventIds = await insertTestEvents(totalEvents, { tag: 'e2e_stress' });

    const dispatchLog: string[] = [];

    // Custom Mock Adapter with artificial 30ms latency to create overlapping execution windows
    const mockEmailAdapter: NotificationAdapter = {
      async send(options: SendNotificationOptions): Promise<SendResult> {
        await new Promise((resolve) => setTimeout(resolve, 30));
        dispatchLog.push(options.eventId);
        return {
          success: true,
          messageId: `mock_${options.eventId}`,
        };
      },
    };

    const mockFactory = new AdapterFactory(mockEmailAdapter as any);

    const processor = new EventProcessor({
      adapterFactory: mockFactory,
    });

    const poller = new OutboxPoller({ batchSize: 5 });

    // Spawn 4 concurrent worker loop instances
    const workerClients = Array.from({ length: 4 }, () =>
      createDatabaseClient({ maxConnections: 3 })
    );

    async function runWorkerLoop(db: DbClient, maxIterations: number = 10) {
      for (let i = 0; i < maxIterations; i++) {
        const events = await poller.claimBatch(db, 5);
        if (events.length === 0) {
          // If queue empty, wait briefly and retry
          await new Promise((resolve) => setTimeout(resolve, 20));
          continue;
        }

        await Promise.all(events.map((e) => processor.processEvent(db, e)));
      }
    }

    try {
      await Promise.all(workerClients.map((c) => runWorkerLoop(c.db)));

      // Verify every event was processed
      assert.equal(
        dispatchLog.length,
        totalEvents,
        `Expected ${totalEvents} dispatches, but got ${dispatchLog.length}`
      );

      // Verify ZERO duplicate dispatches
      const uniqueDispatches = new Set(dispatchLog);
      assert.equal(
        uniqueDispatches.size,
        totalEvents,
        `Expected ${totalEvents} unique dispatches, but got ${uniqueDispatches.size} (Duplicate deliveries!)`
      );

      // Verify DB final state: all SENT, sentAt is set, nextRetryAt is null
      const dbRows = await dbClient.db
        .select()
        .from(schema.notificationEvents)
        .where(inArray(schema.notificationEvents.id, eventIds));

      assert.equal(dbRows.length, totalEvents);
      for (const row of dbRows) {
        assert.equal(row.status, 'SENT');
        assert.ok(row.sentAt != null);
        assert.equal(row.nextRetryAt, null);
      }
    } finally {
      await Promise.all(workerClients.map((c) => c.queryClient.end()));
    }
  });

  // ---------------------------------------------------------------------------
  // Test 6: Multi-Process OS-Level Concurrency (4 separate OS child processes)
  // ---------------------------------------------------------------------------
  it('TEST-6: Multi-process OS-level concurrency test with 4 separate child processes proves 0 duplicate deliveries', async () => {
    const totalEvents = 30;
    const eventIds = await insertTestEvents(totalEvents, { tag: 'multiprocess' });

    const childScriptPath = resolve(__dirname, 'helpers', 'worker-child.ts');

    // Fork 4 independent Node.js processes using tsx
    const numProcesses = 4;
    const processes: any[] = [];
    const childPromises: Promise<{ claimedCount: number; claimedIds: string[] }>[] = [];

    for (let i = 0; i < numProcesses; i++) {
      const child = fork(
        childScriptPath,
        [],
        {
          execArgv: ['--import', 'tsx'],
          stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        }
      );
      processes.push(child);

      const promise = new Promise<{ claimedCount: number; claimedIds: string[] }>(
        (resolve, reject) => {
          child.on('message', (msg: any) => {
            if (msg.status === 'done') {
              resolve(msg);
            } else if (msg.status === 'error') {
              reject(new Error(msg.error));
            }
          });
          child.on('error', reject);
          child.on('exit', (code) => {
            if (code !== 0 && code !== null) {
              reject(new Error(`Child exited with code ${code}`));
            }
          });
        }
      );
      childPromises.push(promise);
    }

    // Trigger all child processes simultaneously
    for (const child of processes) {
      child.send({ command: 'start', batchSize: 5 });
    }

    try {
      const results = await Promise.all(childPromises);

      const allChildClaimedIds: string[] = [];
      for (const res of results) {
        allChildClaimedIds.push(...res.claimedIds);
      }

      // Verify all 30 events were claimed across the 4 child processes
      assert.equal(
        allChildClaimedIds.length,
        totalEvents,
        `Expected ${totalEvents} claimed across child processes, got ${allChildClaimedIds.length}`
      );

      // Verify ZERO duplicate claims across processes
      const uniqueChildClaims = new Set(allChildClaimedIds);
      assert.equal(
        uniqueChildClaims.size,
        totalEvents,
        `Expected ${totalEvents} unique claims across processes, got ${uniqueChildClaims.size}`
      );

      // Verify DB final state
      const dbRows = await dbClient.db
        .select()
        .from(schema.notificationEvents)
        .where(inArray(schema.notificationEvents.id, eventIds));

      assert.equal(dbRows.length, totalEvents);
      for (const row of dbRows) {
        assert.equal(row.status, 'SENT');
      }
    } finally {
      for (const child of processes) {
        child.kill();
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Test 7: Rollback / Aborted Claim Transaction Clean Lock Release
  // ---------------------------------------------------------------------------
  it('TEST-7: Aborted claim transaction releases row locks immediately with zero stranded rows', async () => {
    const totalEvents = 5;
    const eventIds = await insertTestEvents(totalEvents, { tag: 'rollback_test' });

    const poller = new OutboxPoller({ batchSize: 5 });

    // Simulate an aborted transaction where the worker throws before commit
    await assert.rejects(
      async () => {
        await dbClient.db.transaction(async (tx) => {
          // Lock the candidate rows
          const candidates = await tx
            .select()
            .from(schema.notificationEvents)
            .where(inArray(schema.notificationEvents.id, eventIds))
            .for('update', { skipLocked: true });

          assert.equal(candidates.length, 5);

          // Force an intentional abort
          throw new Error('SIMULATED_TRANSACTION_FAILURE');
        });
      },
      /SIMULATED_TRANSACTION_FAILURE/
    );

    // Immediately after rollback, another worker attempts to claimBatch
    const claimedAfterRollback = await poller.claimBatch(dbClient.db, 5);

    // Verify all 5 events are cleanly claimed (locks released by PostgreSQL, status remained PENDING)
    assert.equal(
      claimedAfterRollback.length,
      5,
      'All 5 events must be immediately claimable after previous transaction rollback'
    );

    for (const evt of claimedAfterRollback) {
      assert.equal(evt.status, 'PROCESSING');
      assert.equal(evt.attempts, 1);
    }
  });

  // ---------------------------------------------------------------------------
  // Test 8: Extreme Contention Thundering Herd (100 events, 20 concurrent loops, batchSize = 2)
  // ---------------------------------------------------------------------------
  it('TEST-8: Thundering herd with 100 events, 20 concurrent workers claiming tiny batchSize=2 results in 0 duplicates and 0 deadlocks', async () => {
    const totalEvents = 100;
    const eventIds = await insertTestEvents(totalEvents, { tag: 'thundering_herd' });

    const poller = new OutboxPoller({ batchSize: 2 });
    const numWorkers = 20;

    const workerClients = Array.from({ length: numWorkers }, () =>
      createDatabaseClient({ maxConnections: 3 })
    );

    const allClaimed: string[] = [];

    async function runThunderingWorker(db: DbClient, maxAttempts: number = 30) {
      for (let i = 0; i < maxAttempts; i++) {
        const batch = await poller.claimBatch(db, 2);
        if (batch.length > 0) {
          allClaimed.push(...batch.map((e) => e.id));
        } else {
          // If empty, brief yield then check if more are available
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
      }
    }

    try {
      await Promise.all(workerClients.map((c) => runThunderingWorker(c.db)));

      // 1. Total claimed must match 100
      assert.equal(
        allClaimed.length,
        totalEvents,
        `Expected ${totalEvents} claimed events, got ${allClaimed.length}`
      );

      // 2. 0 duplicate claims under high contention
      const unique = new Set(allClaimed);
      assert.equal(
        unique.size,
        totalEvents,
        `Expected ${totalEvents} unique events, got ${unique.size} (Duplicate claims detected!)`
      );

      // 3. Verify all events in DB are PROCESSING with attempts = 1
      const dbRows = await dbClient.db
        .select()
        .from(schema.notificationEvents)
        .where(inArray(schema.notificationEvents.id, eventIds));

      assert.equal(dbRows.length, totalEvents);
      for (const row of dbRows) {
        assert.equal(row.status, 'PROCESSING');
        assert.equal(row.attempts, 1);
      }
    } finally {
      await Promise.all(workerClients.map((c) => c.queryClient.end()));
    }
  });

  // ---------------------------------------------------------------------------
  // Test 9: Graceful Shutdown Under Active In-Flight Batch
  // ---------------------------------------------------------------------------
  it('TEST-9: Graceful shutdown during active in-flight batch waits for DB updates to persist before closing connections', async () => {
    const totalEvents = 5;
    const eventIds = await insertTestEvents(totalEvents, { tag: 'shutdown_drain' });

    const dispatchOrder: string[] = [];

    const slowAdapter: NotificationAdapter = {
      async send(options: SendNotificationOptions): Promise<SendResult> {
        // Simulate 80ms adapter dispatch
        await new Promise((resolve) => setTimeout(resolve, 80));
        dispatchOrder.push(options.eventId);
        return { success: true, messageId: `msg_${options.eventId}` };
      },
    };

    const factory = new AdapterFactory(slowAdapter as any);
    const processor = new EventProcessor({ adapterFactory: factory });
    const poller = new OutboxPoller({ batchSize: 5 });

    const workerInstanceClient = createDatabaseClient({ maxConnections: 5 });
    const worker = new NotificationWorker({
      db: workerInstanceClient.db,
      queryClient: workerInstanceClient.queryClient,
      outboxPoller: poller,
      eventProcessor: processor,
      batchSize: 5,
      shutdownTimeoutMs: 5000,
    });

    // Start a poll iteration
    const pollPromise = worker.pollOnce();

    // Immediately trigger shutdown while pollOnce is in flight
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(worker.getInFlightStatus(), true, 'Worker should be actively processing batch');

    // Trigger shutdown
    const shutdownPromise = worker.shutdown();

    await Promise.all([pollPromise, shutdownPromise]);

    // Verify all 5 events finished dispatching
    assert.equal(dispatchOrder.length, 5);

    // Verify in DB that all 5 events persisted to SENT before DB pool was closed
    const dbRows = await dbClient.db
      .select()
      .from(schema.notificationEvents)
      .where(inArray(schema.notificationEvents.id, eventIds));

    assert.equal(dbRows.length, 5);
    for (const row of dbRows) {
      assert.equal(row.status, 'SENT', `Event ${row.id} should be SENT after graceful drain`);
      assert.ok(row.sentAt != null);
    }
  });

  // ---------------------------------------------------------------------------
  // Test 10: Host vs Database Clock Boundary & Lease Expiry Exact Boundary
  // ---------------------------------------------------------------------------
  it('TEST-10: Exact sub-second lease expiry boundary correctly distinguishes active vs stale leases', async () => {
    const now = Date.now();

    // Event A: lease expired 1 second ago (stale)
    // Event B: lease expires 2 seconds in the future (still active)
    const [idStale] = await insertTestEvents(1, {
      status: 'PROCESSING',
      attempts: 1,
      nextRetryAt: new Date(now - 1000),
      tag: 'boundary_stale',
    });

    const [idActive] = await insertTestEvents(1, {
      status: 'PROCESSING',
      attempts: 1,
      nextRetryAt: new Date(now + 2000),
      tag: 'boundary_active',
    });

    const poller = new OutboxPoller({ batchSize: 10 });

    // Claim batch: only idStale should be claimed, idActive must be protected
    const claimed = await poller.claimBatch(dbClient.db, 10);

    const claimedIds = claimed.map((e) => e.id);
    assert.ok(claimedIds.includes(idStale), 'Stale event must be claimed');
    assert.ok(!claimedIds.includes(idActive), 'Active event must NOT be claimed');

    // Wait 2.1 seconds for idActive to expire
    await new Promise((resolve) => setTimeout(resolve, 2100));

    // Now idActive should be claimed
    const claimedSecond = await poller.claimBatch(dbClient.db, 10);
    const claimedIdsSecond = claimedSecond.map((e) => e.id);
    assert.ok(claimedIdsSecond.includes(idActive), 'Event should be claimed once lease expires');
  });
});
