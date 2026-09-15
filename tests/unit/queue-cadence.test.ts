import { describe, it, expect, beforeEach } from 'vitest';
import { 
  RecoveryQueueService, 
  CADENCES 
} from '@recoverflow/jobs';
import { 
  db, 
  globalIdempotency, 
  type CartEvent 
} from '@recoverflow/core';

describe('Queue Scheduling Logic & Multi-tier Cadences', () => {
  let queueService: RecoveryQueueService;

  beforeEach(() => {
    queueService = new RecoveryQueueService();
  });

  it('routes PAYMENT_FAILED events to 3-minute immediate cadence', () => {
    const delay = queueService.getInitialDelayMs('PAYMENT_FAILED');
    expect(delay).toBe(CADENCES.PAYMENT_FAILED_MS);
    expect(delay).toBe(180000); // 3 * 60 * 1000
  });

  it('routes CHECKOUT_STEP and CART_PAGE events to 30-minute cadence', () => {
    const checkoutDelay = queueService.getInitialDelayMs('CHECKOUT_STEP');
    const cartDelay = queueService.getInitialDelayMs('CART_PAGE');

    expect(checkoutDelay).toBe(CADENCES.CHECKOUT_ABANDONED_MS);
    expect(checkoutDelay).toBe(1800000); // 30 * 60 * 1000
    expect(cartDelay).toBe(1800000);
  });

  it('aborts execution if customer completed purchase prior to queue firing', async () => {
    const cart: CartEvent = {
      id: 'cart_test_recovered_01',
      cartToken: 'tok_test_completed',
      merchantId: 'merchant_default_01',
      customerName: 'Marcus Bell',
      customerPhone: '+14155558812',
      currency: 'USD',
      totalPrice: 150.0,
      items: [{ id: 'item_1', title: 'Oxford Shirt', price: 150, quantity: 1 }],
      status: 'RECOVERED', // Customer already bought!
      abandonmentType: 'CHECKOUT_STEP',
      recoveryStage: 'RECOVERED',
      checkoutUrl: 'https://example.com/checkouts/123',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.upsertCartEvent(cart);

    const result = await queueService.executePrimaryRecovery(cart.id);
    expect(result.aborted).toBe(true);
    expect(result.reason).toContain('already completed purchase');
  });

  it('aborts execution if cart has expired', async () => {
    const cart: CartEvent = {
      id: 'cart_test_expired_01',
      cartToken: 'tok_test_expired',
      merchantId: 'merchant_default_01',
      customerName: 'Julia Thorne',
      currency: 'USD',
      totalPrice: 80.0,
      items: [{ id: 'item_2', title: 'Silk Belt', price: 80, quantity: 1 }],
      status: 'EXPIRED',
      abandonmentType: 'CHECKOUT_STEP',
      recoveryStage: 'EXPIRED',
      checkoutUrl: 'https://example.com/checkouts/456',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.upsertCartEvent(cart);

    const result = await queueService.executePrimaryRecovery(cart.id);
    expect(result.aborted).toBe(true);
    expect(result.reason).toContain('expired');
  });

  it('enforces atomic idempotency on duplicate webhook events', async () => {
    const testKey = `test_key_${Date.now()}`;
    const firstAttempt = await globalIdempotency.acquire(testKey, 60);
    const secondAttempt = await globalIdempotency.acquire(testKey, 60);

    expect(firstAttempt).toBe(true);
    expect(secondAttempt).toBe(false); // Rejected duplicate
  });
});
