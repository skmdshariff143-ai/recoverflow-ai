import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  globalRecoveryQueue,
  calculateJitteredBackoffMs,
  setSimulatedMemoryPressure,
} from '../../packages/jobs/src/queue';
import { db, type CartEvent, type Merchant } from '@recoverflow/core';

describe('DEFCON-1 Backpressure & Resilience (Track 2)', () => {
  const mockMerchant: Merchant = {
    id: 'merchant_defcon_01',
    storeUrl: 'https://aurora-luxury.myshopify.com',
    storeName: 'Aurora Luxury Apparel',
    webhookSecret: 'sec_test_defcon',
    brandToneGuidelines: 'Warm, refined, concise.',
    brandVoiceCasualVsFormal: 0.7,
    brandVoiceUrgencyVsGentle: 0.4,
    discountCeilingPercentage: 15.0,
    minMarginPercentage: 20.0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const lowLtvCart: CartEvent = {
    id: 'cart_low_ltv_01',
    cartToken: 'tok_low_ltv_881',
    merchantId: mockMerchant.id,
    customerName: 'Anonymous',
    currency: 'USD',
    totalPrice: 15.0, // Low cart value -> low LTV
    items: [
      {
        id: 'item_cheap',
        title: 'Single Button Replacement',
        price: 15.0,
        quantity: 1,
      },
    ],
    status: 'ABANDONED',
    abandonmentType: 'CART_PAGE',
    recoveryStage: 'QUEUED',
    checkoutUrl: 'https://aurora-luxury.myshopify.com/checkouts/c/tok_low_ltv_881/recover',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    await db.upsertMerchant(mockMerchant);
    await db.upsertCartEvent(lowLtvCart);
  });

  afterEach(() => {
    setSimulatedMemoryPressure(null);
  });

  describe('calculateJitteredBackoffMs', () => {
    it('calculates exponential backoff with random jitter capped at 24 hours', () => {
      const b0 = calculateJitteredBackoffMs(0, 1000);
      const b1 = calculateJitteredBackoffMs(1, 1000);
      const b2 = calculateJitteredBackoffMs(2, 1000);
      const bMax = calculateJitteredBackoffMs(30, 1000, 86400000);

      expect(b0).toBeGreaterThanOrEqual(1000);
      expect(b1).toBeGreaterThanOrEqual(2000);
      expect(b2).toBeGreaterThanOrEqual(4000);
      expect(bMax).toBeLessThanOrEqual(86400000);
    });
  });

  describe('DEFCON-1 Load Shedding', () => {
    it('instantly sheds incoming low-LTV carts (<0.2) when memory pressure exceeds 80%', async () => {
      // Simulate 88% memory pressure
      setSimulatedMemoryPressure(0.88);

      const result = await globalRecoveryQueue.scheduleRecovery(lowLtvCart.id, 'CART_PAGE');
      expect(result.shed).toBe(true);
      expect(result.delayMs).toBe(-1);
    });

    it('processes normal carts without shedding when memory pressure is under 80%', async () => {
      setSimulatedMemoryPressure(0.45);

      const result = await globalRecoveryQueue.scheduleRecovery(lowLtvCart.id, 'CART_PAGE', 50);
      expect(result.shed).toBeUndefined();
      expect(result.delayMs).toBe(50);
    });
  });
});
