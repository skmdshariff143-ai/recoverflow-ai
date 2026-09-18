import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createPostgresTestHarness, type PostgresTestContext } from '@recoverflow/core';

describe('PostgreSQL Concurrent Outbox Claiming (FOR UPDATE SKIP LOCKED)', () => {
  let harness: PostgresTestContext;

  beforeAll(async () => {
    harness = await createPostgresTestHarness();
  });

  beforeEach(async () => {
    await harness.cleanup();
    await harness.db.createOrUpdateMerchant({
      id: 'merch_multiworker',
      storeName: 'MultiWorker Store',
      currency: 'INR',
    } as any);
  });

  afterAll(async () => {
    await harness.cleanup();
    await harness.prisma.$disconnect();
  });

  it('claims 100 events across 10 concurrent workers with 0 duplicates and strict ownership', async () => {
    const totalEvents = 100;
    const workerCount = 10;
    const eventsPerWorkerBatch = 10;

    // 1. Enqueue 100 events
    for (let i = 0; i < totalEvents; i++) {
      await harness.db.createOutboxEvent({
        merchantId: 'merch_multiworker',
        aggregateType: 'RECOVERY_CASE',
        aggregateId: `rc_${i}`,
        eventType: 'PAYMENT_FAILED',
        payload: { index: i },
        idempotencyKey: `idem_outbox_${i}`,
      });
    }

    const pending = await harness.db.getPendingOutboxEvents(150);
    expect(pending.length).toBe(totalEvents);

    // 2. Spawn 10 concurrent workers simultaneously claiming
    const workerIds = Array.from({ length: workerCount }, (_, i) => `worker_node_${i + 1}`);
    const claimPromises = workerIds.map((wId) =>
      harness.db.claimOutboxEvents(wId, eventsPerWorkerBatch, 30000)
    );

    const results = await Promise.all(claimPromises);

    // 3. Verify zero duplicates across workers
    const claimedEventIds = new Set<string>();
    let totalClaimed = 0;

    for (let w = 0; w < workerCount; w++) {
      const events = results[w];
      totalClaimed += events.length;
      for (const e of events) {
        expect(claimedEventIds.has(e.id)).toBe(false); // No duplicate claim
        claimedEventIds.add(e.id);
      }
    }

    expect(totalClaimed).toBe(totalEvents);
    expect(claimedEventIds.size).toBe(totalEvents);

    // 4. Each worker publishes its claimed events with ownership check
    for (let w = 0; w < workerCount; w++) {
      const workerId = workerIds[w];
      for (const e of results[w]) {
        const published = await harness.db.markOutboxEventPublished(e.id, workerId);
        expect(published).toBe(true);
      }
    }

    // 5. Verify pending queue is completely drained
    const remainingPending = await harness.db.getPendingOutboxEvents(10);
    expect(remainingPending.length).toBe(0);
  });
});
