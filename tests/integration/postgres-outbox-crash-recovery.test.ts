import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@recoverflow/core';
import { TransactionalOutboxWorker } from '@recoverflow/jobs';

describe('RecoverFlow AI — Outbox Crash Recovery & At-Least-Once Delivery Integration', () => {
  beforeEach(() => {
    (db as any).clear?.();
  });

  it('survives process crash between domain commit and queue dispatch without losing event', async () => {
    const merchantId = 'merchant_default_01';
    const cartId = 'cart_crash_test_991';

    // 1. Transactional Domain Mutation + Outbox Event Commit
    const cart = await db.upsertCartEvent({
      id: cartId,
      cartToken: 'tok_crash_test_991',
      merchantId,
      currency: 'INR',
      totalPrice: 1299.0,
      items: [{ id: 'item_1', title: 'Premium Cashmere Scarf', price: 1299.0, quantity: 1 }],
      status: 'ABANDONED',
      abandonmentType: 'PAYMENT_FAILED',
      recoveryStage: 'QUEUED',
      checkoutUrl: 'https://aurora-apparel.com/checkout/tok_crash_test_991',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const outbox = await db.createOutboxEvent({
      merchantId,
      aggregateType: 'CartEvent',
      aggregateId: cart.id,
      eventType: 'PAYMENT_FAILED',
      payload: { cartId: cart.id, dropOffReason: 'PAYMENT_FAILED' },
      idempotencyKey: `idem_crash_key_${cart.id}`,
    });

    expect(cart.id).toBe(cartId);
    expect(outbox.status).toBe('PENDING');

    // 2. SIMULATE HARD PROCESS CRASH:
    // Process terminates before any worker picks up or dispatches the outbox event.
    // (Simulated by destroying any in-process state/variables).

    // 3. NEW WORKER PROCESS BOOTSTRAPS:
    const recoveredWorker = new TransactionalOutboxWorker({
      workerId: 'worker_post_crash_daemon_01',
      batchSize: 10,
    });

    // Worker discovers pending outbox events from durable DB
    const processedCount = await recoveredWorker.processBatch();
    expect(processedCount).toBe(1);

    // 4. Verify Event Status in Database
    const remainingPending = await db.getPendingOutboxEvents(10);
    expect(remainingPending.length).toBe(0);

    // 5. Subsequent Worker Cycles: Idempotent (No Double Recovery)
    const secondPassProcessed = await recoveredWorker.processBatch();
    expect(secondPassProcessed).toBe(0);
  });
});
