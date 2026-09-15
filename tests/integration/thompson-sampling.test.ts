import { describe, it, expect, beforeEach } from 'vitest';
import { 
  ThompsonSamplerMarginGuardian, 
  BanditPolicyArm, 
  CartValueTier,
  BanditContext,
  RewardCalculationParams
} from '@recoverflow/agents';

describe('Contextual Multi-Armed Bandit (Thompson Sampling Margin Guardian)', () => {
  let sampler: ThompsonSamplerMarginGuardian;

  beforeEach(() => {
    sampler = new ThompsonSamplerMarginGuardian();
  });

  it('determines cart value tier appropriately', () => {
    expect(sampler.getCartTier(45)).toBe('LOW');
    expect(sampler.getCartTier(100)).toBe('MID');
    expect(sampler.getCartTier(250)).toBe('MID');
    expect(sampler.getCartTier(300)).toBe('MID');
    expect(sampler.getCartTier(301)).toBe('HIGH');
    expect(sampler.getCartTier(850)).toBe('HIGH');
  });

  it('samples valid probabilities from Beta distribution within [0, 1]', () => {
    for (let i = 0; i < 50; i++) {
      const sample = sampler.sampleBeta(2.0, 5.0);
      expect(sample).toBeGreaterThanOrEqual(0);
      expect(sample).toBeLessThanOrEqual(1);
    }

    // High alpha vs beta should have higher expected value
    let sumHighAlpha = 0;
    let sumHighBeta = 0;
    const trials = 200;
    for (let i = 0; i < trials; i++) {
      sumHighAlpha += sampler.sampleBeta(50, 10);
      sumHighBeta += sampler.sampleBeta(10, 50);
    }
    const avgHighAlpha = sumHighAlpha / trials;
    const avgHighBeta = sumHighBeta / trials;

    expect(avgHighAlpha).toBeGreaterThan(0.7);
    expect(avgHighBeta).toBeLessThan(0.3);
  });

  it('selects valid policy arm with appropriate discount ceiling limits', () => {
    const context: BanditContext = {
      merchantId: 'merchant_test_mab',
      category: 'footwear',
      cartValue: 240,
      cartTier: 'MID',
    };

    const selection = sampler.selectArm(context, 15.0);

    const validArms: BanditPolicyArm[] = [
      'ARM_ZERO_DISCOUNT_URGENCY',
      'ARM_FREE_SHIPPING',
      'ARM_DYNAMIC_MICRO_DISCOUNT',
      'ARM_BUNDLE_GIFT_SWAP',
    ];

    expect(validArms).toContain(selection.selectedArm);
    expect(selection.cartTier).toBe('MID');
    expect(selection.strategyDescription).toBeTruthy();

    if (selection.selectedArm === 'ARM_DYNAMIC_MICRO_DISCOUNT') {
      expect(selection.appliedDiscountPercentage).toBeLessThanOrEqual(15.0);
      expect(selection.appliedDiscountPercentage).toBeGreaterThan(0);
    } else {
      expect(selection.appliedDiscountPercentage).toBe(0);
    }
  });

  it('calculates net gross margin reward correctly', () => {
    // Case 1: Converted
    const convertedParams: RewardCalculationParams = {
      recoveredGmv: 250.0,
      discountCost: 25.0, // 10% discount
      messagingSlaFee: 0.05, // WhatsApp message fee
      convertedStatus: 1,
    };

    const reward = sampler.calculateReward(convertedParams);
    expect(reward).toBe(250.0 - 25.0 - 0.05);

    // Case 2: Unconverted
    const unconvertedParams: RewardCalculationParams = {
      recoveredGmv: 250.0,
      discountCost: 0,
      messagingSlaFee: 0.05,
      convertedStatus: 0,
    };

    const zeroReward = sampler.calculateReward(unconvertedParams);
    expect(zeroReward).toBe(0);
  });

  it('updates posterior distributions and shifts selection toward winning arm', () => {
    const merchantId = 'merchant_learning_test';
    const tier: CartValueTier = 'HIGH';

    // Reward ARM_ZERO_DISCOUNT_URGENCY heavily (15 wins)
    for (let i = 0; i < 15; i++) {
      sampler.updateArm(merchantId, tier, 'ARM_ZERO_DISCOUNT_URGENCY', 350.0, true);
    }

    // Penalize other arms with repeated failures
    sampler.updateArm(merchantId, tier, 'ARM_FREE_SHIPPING', 0, false);
    sampler.updateArm(merchantId, tier, 'ARM_FREE_SHIPPING', 0, false);
    sampler.updateArm(merchantId, tier, 'ARM_DYNAMIC_MICRO_DISCOUNT', 0, false);
    sampler.updateArm(merchantId, tier, 'ARM_DYNAMIC_MICRO_DISCOUNT', 0, false);
    sampler.updateArm(merchantId, tier, 'ARM_BUNDLE_GIFT_SWAP', 0, false);
    sampler.updateArm(merchantId, tier, 'ARM_BUNDLE_GIFT_SWAP', 0, false);

    // After 15 wins, ARM_ZERO_DISCOUNT_URGENCY should be chosen most of the time
    let chosenUrgencyCount = 0;
    const testSamples = 50;
    for (let i = 0; i < testSamples; i++) {
      const pick = sampler.selectArm({
        merchantId,
        category: 'luxury',
        cartValue: 500,
        cartTier: tier,
      });
      if (pick.selectedArm === 'ARM_ZERO_DISCOUNT_URGENCY') {
        chosenUrgencyCount++;
      }
    }

    expect(chosenUrgencyCount).toBeGreaterThan(40); // Exploitation dominates
  });

  it('exports complete convergence telemetry across all tiers', () => {
    const telemetry = sampler.getConvergenceTelemetry('merchant_default_01');
    expect(telemetry.LOW).toBeDefined();
    expect(telemetry.MID).toBeDefined();
    expect(telemetry.HIGH).toBeDefined();
    expect(telemetry.LOW.length).toBe(4);
  });
});
