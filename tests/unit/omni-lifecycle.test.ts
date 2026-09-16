import { describe, it, expect, beforeEach } from 'vitest';
import {
  runUpsellAgent,
  buildOrderEditAddVariantMutation,
} from '../../packages/agents/src/post-purchase/upsell-agent';
import { db, type OrderRecord, type Merchant, type ReturnRecord } from '@recoverflow/core';

describe('Omni-Lifecycle Ecosystem (WISMO & Upsells - Track 4)', () => {
  const mockMerchant: Merchant = {
    id: 'merchant_omni_01',
    storeUrl: 'https://aurora-luxury.myshopify.com',
    storeName: 'Aurora Luxury Apparel',
    webhookSecret: 'sec_test_omni',
    brandToneGuidelines: 'Warm, elegant, concise.',
    brandVoiceCasualVsFormal: 0.7,
    brandVoiceUrgencyVsGentle: 0.3,
    discountCeilingPercentage: 15.0,
    minMarginPercentage: 20.0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleOrder: OrderRecord = {
    id: 'ord_omni_881',
    merchantId: mockMerchant.id,
    shopifyOrderId: 'shpfy_ord_5521',
    orderNumber: '#1088',
    customerName: 'Marcus Vance',
    customerPhone: '+12065550192',
    currency: 'USD',
    totalPrice: 420.0,
    financialStatus: 'PAID',
    fulfillmentStatus: 'FULFILLED',
    items: [
      {
        id: 'item_o1',
        title: 'Structured Wool Overcoat',
        price: 420.0,
        quantity: 1,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    await db.upsertMerchant(mockMerchant);
    await db.createOrUpdateOrder(sampleOrder);
  });

  describe('buildOrderEditAddVariantMutation', () => {
    it('constructs valid Shopify GraphQL orderEditAddVariant mutation string', () => {
      const gql = buildOrderEditAddVariantMutation('5521', 'gid://shopify/ProductVariant/9910248101', 1);
      expect(gql).toContain('orderEditBegin');
      expect(gql).toContain('orderEditAddVariant');
      expect(gql).toContain('orderEditCommit');
      expect(gql).toContain('gid://shopify/ProductVariant/9910248101');
    });
  });

  describe('runUpsellAgent', () => {
    it('selects highest margin item from catalog and constructs 10% discounted bundle offer', async () => {
      const result = await runUpsellAgent({
        order: sampleOrder,
        merchant: mockMerchant,
        targetDiscountPercentage: 10,
      });

      expect(result.recommendedItem).toBeDefined();
      expect(result.recommendedItem.marginPercentage).toBeGreaterThanOrEqual(60);
      expect(result.discountedPrice).toBeLessThan(result.originalPrice);
      expect(result.addVariantMutationGql).toContain('orderEditAddVariant');
      expect(result.upsellMessage).toContain(result.recommendedItem.title);
    });
  });

  describe('ReturnRecord Persistence', () => {
    it('creates and lists return requests for order items', async () => {
      const returnRecord: ReturnRecord = {
        id: 'ret_001',
        orderId: sampleOrder.id,
        merchantId: mockMerchant.id,
        reason: 'SIZE_TOO_SMALL',
        status: 'REQUESTED',
        refundAmount: 420.0,
        currency: 'USD',
        notes: 'Requested exchange for size 44R',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.createOrUpdateReturn(returnRecord);
      const retrieved = await db.getReturn('ret_001');
      expect(retrieved).toBeDefined();
      expect(retrieved?.reason).toBe('SIZE_TOO_SMALL');
      expect(retrieved?.status).toBe('REQUESTED');

      const merchantReturns = await db.listReturns(mockMerchant.id);
      expect(merchantReturns.length).toBeGreaterThanOrEqual(1);
    });
  });
});
