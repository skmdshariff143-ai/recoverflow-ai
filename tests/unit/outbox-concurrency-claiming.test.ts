import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@recoverflow/core';
import { TransactionalOutboxWorker } from '@recoverflow/jobs';

describe('RecoverFlow AI — Outbox Multi-Worker Concurrency & Claiming', () => {
  beforeEach(() => {
    (db as any).clear?.();
  });

  it('guarantees mutually exclusive claiming across concurrent worker instances', async () => {
    // Seed 10 pending outbox events
    for (let i = 1; i <= 10; i++) {
      await db.createOutboxEvent({
        merchantId: 'merchant_default_01',
        aggregateType: 'CartEvent',
        aggregateId: `cart_outbox_claim_${i}`,
        eventType: 'PAYMENT_FAILED',
        payload: { attempt: i },
        idempotencyKey: `idem_outbox_claim_${i}`,
      });
    }

    const workerA = new TransactionalOutboxWorker({ workerId: 'worker_alpha', batchSize: 5 });
    const workerB = new TransactionalOutboxWorker({ workerId: 'worker_bravo', batchSize: 5 });

    // Both workers claim concurrently
    const [claimedA, claimedB] = await Promise.all([
      db.claimOutboxEvents(workerA.workerId, 5),
      db.claimOutboxEvents(workerB.workerId, 5),
    ]);

    expect(claimedA.length).toBe(5);
    expect(claimedB.length).toBe(5);

    // Verify zero overlap between batches
    const idsA = new Set(claimedA.map((e) => e.id));
    const idsB = new Set(claimedB.map((e) => e.id));

    for (const id of idsA) {
      expect(idsB.has(id)).toBe(false);
    }

    // A third worker claiming should find 0 remaining events
    const claimedC = await db.claimOutboxEvents('worker_charlie', 5);
    expect(claimedC.length).toBe(0);
  });

  it('allows reclamation of expired locked events if worker dies during processing', async () => {
    const event = await db.createOutboxEvent({
      merchantId: 'merchant_default_01',
      aggregateType: 'CartEvent',
      aggregateId: 'cart_stalled_01',
      eventType: 'CHECKOUT_STEP',
      payload: { stalled: true },
      idempotencyKey: 'idem_stalled_01',
    });

    // Worker 1 claims event
    const claimed1 = await db.claimOutboxEvents('worker_dead', 1);
    expect(claimed1.length).toBe(1);
    expect(claimed1[0].id).toBe(event.id);

    // Simulate worker 1 dying and lock expiring (lockTtl = 50ms)
    await new Promise((resolve) => setTimeout(resolve, 60));

    // Worker 2 claims expired event
    const claimed2 = await db.claimOutboxEvents('worker_alive', 1, 50);
    expect(claimed2.length).toBe(1);
    expect(claimed2[0].id).toBe(event.id);
    expect(claimed2[0].attemptCount).toBe(2);

    // Mark published
    await db.markOutboxEventPublished(event.id);

    // Further claims return nothing
    const claimed3 = await db.claimOutboxEvents('worker_alive', 1);
    expect(claimed3.length).toBe(0);
  });

  it('dead-letters events after reaching max retry attempts', async () => {
    const event = await db.createOutboxEvent({
      merchantId: 'merchant_default_01',
      aggregateType: 'CartEvent',
      aggregateId: 'cart_failing_01',
      eventType: 'PAYMENT_FAILED',
      payload: { bad: true },
      idempotencyKey: 'idem_failing_01',
    });

    // Fail 5 times
    for (let i = 1; i <= 5; i++) {
      const claimed = await db.claimOutboxEvents('worker_retry', 1, 0);
      if (claimed.length > 0) {
        await db.markOutboxEventFailed(claimed[0].id, `Simulated network error attempt ${i}`, 0);
      }
    }

    // Check status in DB
    const allPending = await db.getPendingOutboxEvents(10);
    expect(allPending.some((e) => e.id === event.id)).toBe(false);
  });
});
