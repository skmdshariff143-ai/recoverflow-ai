import { describe, it, expect, beforeEach } from 'vitest';
import { db, type Merchant } from '@recoverflow/core';
import { TransactionalOutboxWorker } from '@recoverflow/jobs';

describe('Transactional Outbox Pattern & CQRS Event Pipeline (Martin Kleppmann & Martin Fowler)', () => {
  const merchant: Merchant = {
    id: 'merchant_outbox_test',
    storeUrl: 'https://aurora-apparel.myshopify.com',
    shopDomain: 'aurora-apparel.myshopify.com',
    storeName: 'Aurora Luxury Apparel',
    webhookSecret: 'shpss_sec_123',
    discountCeilingPercentage: 15.0,
    minMarginPercentage: 20.0,
    brandToneGuidelines: 'Refined and courteous',
    brandVoiceCasualVsFormal: 0.7,
    brandVoiceUrgencyVsGentle: 0.4,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    (db as any).merchants.set(merchant.id, merchant);
    (db as any).outboxEvents.clear();
  });

  it('atomically creates CartEvent and OutboxEvent with cryptographic SHA-256 idempotency key', async () => {
    const { cart, outbox } = await db.createCartWithOutbox({
      cartToken: 'tok_outbox_9918',
      merchantId: merchant.id,
      customerName: 'Claire Redfield',
      customerPhone: '+14155552918',
      currency: 'USD',
      totalPrice: 320.0,
      items: [
        { id: 'i1', title: 'Wool Trench Coat', price: 320.0, quantity: 1 },
      ],
      status: 'ABANDONED',
      abandonmentType: 'CHECKOUT_STEP',
      recoveryStage: 'QUEUED',
      checkoutUrl: 'https://aurora-apparel.myshopify.com/checkouts/c/tok_outbox_9918',
    });

    expect(cart.id).toBeTruthy();
    expect(cart.cartToken).toBe('tok_outbox_9918');

    expect(outbox.id).toBeTruthy();
    expect(outbox.aggregateId).toBe(cart.id);
    expect(outbox.status).toBe('PENDING');
    expect(outbox.idempotencyKey).toMatch(/^[a-f0-9]{64}$/); // SHA-256 format

    // Verify both are present in database
    const fetchedCart = await db.getCartById(cart.id);
    expect(fetchedCart).toBeDefined();

    const pending = await (db as any).getPendingOutboxEvents();
    expect(pending.length).toBe(1);
    expect(pending[0].id).toBe(outbox.id);
  });

  it('guarantees identical SHA-256 idempotency hash for matching event coordinates', () => {
    const key1 = db.generateOutboxIdempotencyKey('aurora.myshopify.com', 'tok_123', 1700000000);
    const key2 = db.generateOutboxIdempotencyKey('aurora.myshopify.com', 'tok_123', 1700000000);
    const key3 = db.generateOutboxIdempotencyKey('aurora.myshopify.com', 'tok_456', 1700000000);

    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
  });

  it('processes pending outbox records and transitions status to PUBLISHED', async () => {
    await db.createCartWithOutbox({
      cartToken: 'tok_outbox_worker_01',
      merchantId: merchant.id,
      totalPrice: 150.0,
      currency: 'USD',
      items: [{ id: 'i2', title: 'Silk Scarf', price: 150, quantity: 1 }],
      status: 'ABANDONED',
      abandonmentType: 'PAYMENT_FAILED',
      recoveryStage: 'QUEUED',
      checkoutUrl: 'https://aurora-apparel.myshopify.com/checkouts/c/tok_outbox_worker_01',
    });

    const worker = new TransactionalOutboxWorker();
    const count = await worker.processBatch();

    expect(count).toBe(1);

    const pendingAfter = await (db as any).getPendingOutboxEvents();
    expect(pendingAfter.length).toBe(0);

    const allEvents = Array.from((db as any).outboxEvents.values()) as any[];
    expect(allEvents[0].status).toBe('PUBLISHED');
    expect(allEvents[0].processedAt).toBeDefined();
  });

  it('handles retry count increment and eventual failure handling', async () => {
    const { outbox } = await db.createCartWithOutbox({
      cartToken: 'tok_outbox_fail_01',
      merchantId: 'non_existent_merchant',
      totalPrice: 100.0,
      currency: 'USD',
      items: [],
      status: 'ABANDONED',
      abandonmentType: 'CART_PAGE',
      recoveryStage: 'QUEUED',
      checkoutUrl: 'https://store.myshopify.com/checkouts/c/tok_outbox_fail_01',
    });

    await db.markOutboxEventFailed(outbox.id, 'Simulated connection error');
    let event = (db as any).outboxEvents.get(outbox.id);
    expect(event?.retryCount).toBe(1);
    expect(event?.status).toBe('PENDING');

    // Simulate 4 more failures (reaching 5 max retries)
    await db.markOutboxEventFailed(outbox.id, 'Failure retry');
    await db.markOutboxEventFailed(outbox.id, 'Failure retry');
    await db.markOutboxEventFailed(outbox.id, 'Failure retry');
    await db.markOutboxEventFailed(outbox.id, 'Failure retry');

    event = (db as any).outboxEvents.get(outbox.id);
    expect(event?.retryCount).toBe(5);
    expect(event?.status).toBe('FAILED');
  });
});
