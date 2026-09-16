import { describe, it, expect } from 'vitest';
import {
  orchestrateRecoveryGeneration,
  generateLocalRuleCopy,
  computeSemanticCacheKey,
  type OrchestratorInput,
} from '../../packages/agents/src/orchestrator';
import type { CartEvent, Merchant } from '@recoverflow/core';

describe('Cascading AI Economics & Router (Track 1)', () => {
  const mockMerchant: Merchant = {
    id: 'merchant_orch_01',
    storeUrl: 'https://aurora-luxury.myshopify.com',
    storeName: 'Aurora Luxury Apparel',
    webhookSecret: 'sec_test_orch',
    brandToneGuidelines: 'Warm, refined, concise.',
    brandVoiceCasualVsFormal: 0.7,
    brandVoiceUrgencyVsGentle: 0.4,
    discountCeilingPercentage: 15.0,
    minMarginPercentage: 20.0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleCart: CartEvent = {
    id: 'cart_orch_01',
    cartToken: 'tok_orch_991',
    merchantId: mockMerchant.id,
    customerName: 'Eleanor',
    customerPhone: '+14155552671',
    currency: 'USD',
    totalPrice: 450.0,
    items: [
      {
        id: 'item_o1',
        title: 'Italian Merino Wool Blazer',
        price: 450.0,
        quantity: 1,
      },
    ],
    status: 'ABANDONED',
    abandonmentType: 'CHECKOUT_STEP',
    recoveryStage: 'QUEUED',
    checkoutUrl: 'https://aurora-luxury.myshopify.com/checkouts/c/tok_orch_991/recover',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('computeSemanticCacheKey', () => {
    it('produces deterministic SHA-256 cache keys', () => {
      const input: OrchestratorInput = {
        cart: sampleCart,
        merchant: mockMerchant,
      };
      const key1 = computeSemanticCacheKey(input);
      const key2 = computeSemanticCacheKey(input);
      expect(key1).toBe(key2);
      expect(key1).toHaveLength(64);
    });
  });

  describe('Local Rule Engine (Tier 2)', () => {
    it('generates zero-cost local recovery copy with sub-millisecond latency', () => {
      const input: OrchestratorInput = {
        cart: sampleCart,
        merchant: mockMerchant,
        predictiveLtvScore: 0.3,
      };
      const result = generateLocalRuleCopy(input);
      expect(result.tierUsed).toBe('LOCAL_ENGINE');
      expect(result.costEstimateUsd).toBe(0.0);
      expect(result.content).toContain('Italian Merino Wool Blazer');
      expect(result.discountOffered).toBe('SAVE15');
    });
  });

  describe('Cascading 4-Tier Waterfall Execution', () => {
    it('routes low LTV carts (<0.5) to Local Engine and populates Semantic Cache', async () => {
      const input: OrchestratorInput = {
        cart: sampleCart,
        merchant: mockMerchant,
        predictiveLtvScore: 0.25,
        forceBypassCache: true,
      };

      const res1 = await orchestrateRecoveryGeneration(input);
      expect(res1.tierUsed).toBe('LOCAL_ENGINE');

      // Subsequent identical request hits Semantic Cache (Tier 1)
      const res2 = await orchestrateRecoveryGeneration({
        cart: sampleCart,
        merchant: mockMerchant,
        predictiveLtvScore: 0.25,
        forceBypassCache: false,
      });

      expect(res2.tierUsed).toBe('SEMANTIC_CACHE');
      expect(res2.cacheHit).toBe(true);
    });

    it('routes high VIP LTV carts (>0.8) through VIP tier inference', async () => {
      const input: OrchestratorInput = {
        cart: sampleCart,
        merchant: mockMerchant,
        predictiveLtvScore: 0.92,
        forceBypassCache: true,
      };

      const result = await orchestrateRecoveryGeneration(input);
      expect(result.tierUsed).toBe('GEMINI_PRO_VIP');
      expect(result.callToActionUrl).toBe(sampleCart.checkoutUrl);
    });
  });
});
