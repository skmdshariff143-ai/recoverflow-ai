import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createPostgresTestHarness, type PostgresTestContext } from '@recoverflow/core';

describe('PostgreSQL Outbox Worker Crash & Lease Expiration', () => {
  let harness: PostgresTestContext;

  beforeAll(async () => {
    harness = await createPostgresTestHarness();
  });

  beforeEach(async () => {
    await harness.cleanup();
    await harness.db.createOrUpdateMerchant({
      id: 'merch_lease_test',
      storeName: 'Lease Test Store',
      currency: 'INR',
    } as any);
  });

  afterAll(async () => {
    await harness.cleanup();
    await harness.prisma.$disconnect();
  });

  it('allows worker B to reclaim an event after worker A lease expires, and rejects late ack by worker A', async () => {
    // 1. Enqueue event
    const event = await harness.db.createOutboxEvent({
      merchantId: 'merch_lease_test',
      aggregateType: 'RECOVERY_CASE',
      aggregateId: 'rc_lease_1',
      eventType: 'PAYMENT_FAILED',
      payload: { case: 1 },
      idempotencyKey: 'idem_lease_1',
    });

    const workerA = 'worker_alpha';
    const workerB = 'worker_beta';

    // 2. Worker A claims with a short 50ms lease
    const claimedByA = await harness.db.claimOutboxEvents(workerA, 1, 50);
    expect(claimedByA.length).toBe(1);
    expect(claimedByA[0].id).toBe(event.id);

    // Worker B attempts immediate claim -> should be empty (still locked by A)
    const claimedImmediateB = await harness.db.claimOutboxEvents(workerB, 1, 50);
    expect(claimedImmediateB.length).toBe(0);

    // 3. Worker A crashes / goes silent; wait for 70ms lease expiration
    await new Promise((resolve) => setTimeout(resolve, 70));

    // 4. Worker B claims expired event
    const claimedByB = await harness.db.claimOutboxEvents(workerB, 1, 30000);
    expect(claimedByB.length).toBe(1);
    expect(claimedByB[0].id).toBe(event.id);

    // 5. Worker A wakes up late and attempts to publish -> REJECTED (0 rows updated)
    const lateAckA = await harness.db.markOutboxEventPublished(event.id, workerA);
    expect(lateAckA).toBe(false);

    // 6. Worker B publishes -> ACCEPTED
    const validAckB = await harness.db.markOutboxEventPublished(event.id, workerB);
    expect(validAckB).toBe(true);
  });
});
