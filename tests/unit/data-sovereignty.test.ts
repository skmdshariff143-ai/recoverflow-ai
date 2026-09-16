import { describe, it, expect } from 'vitest';
import { db, hashPii, type Merchant, type CartEvent } from '@recoverflow/core';

describe('Data Sovereignty & Compliance (Track 6)', () => {
  const ephemeralMerchant: Merchant = {
    id: 'merchant_ephemeral_01',
    storeUrl: 'https://privacy-first.myshopify.com',
    storeName: 'Privacy First Atelier',
    webhookSecret: 'sec_privacy_123',
    dataTier: 'EPHEMERAL',
    brandToneGuidelines: 'Strict confidentiality and minimal data retention.',
    brandVoiceCasualVsFormal: 0.8,
    brandVoiceUrgencyVsGentle: 0.2,
    discountCeilingPercentage: 10.0,
    minMarginPercentage: 20.0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const standardMerchant: Merchant = {
    id: 'merchant_standard_01',
    storeUrl: 'https://standard-store.myshopify.com',
    storeName: 'Standard Store',
    webhookSecret: 'sec_std_123',
    dataTier: 'STANDARD',
    brandToneGuidelines: 'Standard brand tone.',
    brandVoiceCasualVsFormal: 0.5,
    brandVoiceUrgencyVsGentle: 0.5,
    discountCeilingPercentage: 15.0,
    minMarginPercentage: 20.0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('hashPii', () => {
    it('produces deterministic truncated SHA-256 hashes for emails and phone numbers', () => {
      const hash1 = hashPii('customer@example.com');
      const hash2 = hashPii('CUSTOMER@EXAMPLE.COM ');
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(16);
      expect(hash1).not.toContain('@');
    });

    it('returns undefined for empty or null inputs', () => {
      expect(hashPii(undefined)).toBeUndefined();
      expect(hashPii(null)).toBeUndefined();
    });
  });

  describe('EPHEMERAL Data Tier PII Anonymization', () => {
    it('automatically hashes customerEmail and customerPhone when merchant dataTier is EPHEMERAL', async () => {
      await db.upsertMerchant(ephemeralMerchant);

      const rawCart: CartEvent = {
        id: 'cart_ephemeral_01',
        cartToken: 'tok_eph_881',
        merchantId: ephemeralMerchant.id,
        customerName: 'Sarah Jenkins',
        customerPhone: '+14155552671',
        customerEmail: 'sarah.jenkins@vip.com',
        currency: 'USD',
        totalPrice: 280.0,
        items: [{ id: 'item_1', title: 'Silk Scarf', price: 280.0, quantity: 1 }],
        status: 'ABANDONED',
        abandonmentType: 'CHECKOUT_STEP',
        recoveryStage: 'QUEUED',
        checkoutUrl: 'https://privacy-first.myshopify.com/checkouts/c/tok_eph_881/recover',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const savedCart = await db.upsertCartEvent(rawCart);
      expect(savedCart.customerEmail).not.toContain('@');
      expect(savedCart.customerEmail).toBe(hashPii('sarah.jenkins@vip.com'));
      expect(savedCart.customerPhone).toBe(hashPii('+14155552671'));
      expect(savedCart.customerName).toBe('[ANONYMIZED_SHOPPER]');
    });

    it('preserves plain PII when merchant dataTier is STANDARD', async () => {
      await db.upsertMerchant(standardMerchant);

      const rawCart: CartEvent = {
        id: 'cart_std_01',
        cartToken: 'tok_std_881',
        merchantId: standardMerchant.id,
        customerName: 'Marcus Vance',
        customerPhone: '+12065550192',
        customerEmail: 'marcus@techcorp.com',
        currency: 'USD',
        totalPrice: 150.0,
        items: [{ id: 'item_1', title: 'Cap', price: 150.0, quantity: 1 }],
        status: 'ABANDONED',
        abandonmentType: 'CHECKOUT_STEP',
        recoveryStage: 'QUEUED',
        checkoutUrl: 'https://standard-store.myshopify.com/checkouts/c/tok_std_881/recover',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const savedCart = await db.upsertCartEvent(rawCart);
      expect(savedCart.customerEmail).toBe('marcus@techcorp.com');
      expect(savedCart.customerPhone).toBe('+12065550192');
      expect(savedCart.customerName).toBe('Marcus Vance');
    });
  });

  describe('30-Day Retention Hard-Pruning', () => {
    it('hard-deletes records older than 30 days while keeping recent records intact', async () => {
      const oldDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000); // 35 days old
      const freshDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days old

      const oldCart: CartEvent = {
        id: 'cart_old_35d',
        cartToken: 'tok_old_35d',
        merchantId: standardMerchant.id,
        currency: 'USD',
        totalPrice: 100.0,
        items: [],
        status: 'EXPIRED',
        abandonmentType: 'CHECKOUT_STEP',
        recoveryStage: 'EXPIRED',
        checkoutUrl: 'https://store.com/c/old',
        createdAt: oldDate,
        updatedAt: oldDate,
      };

      const freshCart: CartEvent = {
        id: 'cart_fresh_2d',
        cartToken: 'tok_fresh_2d',
        merchantId: standardMerchant.id,
        currency: 'USD',
        totalPrice: 100.0,
        items: [],
        status: 'ABANDONED',
        abandonmentType: 'CHECKOUT_STEP',
        recoveryStage: 'QUEUED',
        checkoutUrl: 'https://store.com/c/fresh',
        createdAt: freshDate,
        updatedAt: freshDate,
      };

      await db.upsertCartEvent(oldCart);
      await db.upsertCartEvent(freshCart);

      const stats = await db.pruneRecordsOlderThan(30);
      expect(stats.prunedCarts).toBeGreaterThanOrEqual(1);

      expect(await db.getCartById('cart_old_35d')).toBeNull();
      expect(await db.getCartById('cart_fresh_2d')).not.toBeNull();
    });
  });
});
