import { describe, it, expect } from 'vitest';
import {
  computeCompositeReward,
  globalThompsonSampler,
} from '../../packages/agents/src/mab/thompson-sampler';

describe('Unified RL Reward Function (Track 5)', () => {
  describe('computeCompositeReward', () => {
    it('calculates reward = (WhatsApp_Weight * Email_Weight) * (Recovered_GMV - Discount_Value)', () => {
      // 1.0 * 0.8 * (200 - 20) = 0.8 * 180 = 144
      const reward = computeCompositeReward({
        recoveredGmv: 200,
        discountValue: 20,
        whatsappWeight: 1.0,
        emailWeight: 0.8,
        convertedStatus: 1,
      });

      expect(reward).toBe(144);
    });

    it('returns 0 when conversion status is 0 (lost opportunity)', () => {
      const reward = computeCompositeReward({
        recoveredGmv: 500,
        discountValue: 50,
        convertedStatus: 0,
      });

      expect(reward).toBe(0);
    });
  });

  describe('decayBanditDistributions', () => {
    it('decays alpha and beta parameters towards uniform prior over 24-hour cycle', () => {
      const merchantId = 'merchant_rl_decay_test';
      // First update an arm with successful pull
      globalThompsonSampler.updateArm(merchantId, 'HIGH', 'ARM_ZERO_DISCOUNT_URGENCY', 200, true);

      const before = globalThompsonSampler.getConvergenceTelemetry(merchantId);
      const alphaBefore = before.HIGH.find((a) => a.arm === 'ARM_ZERO_DISCOUNT_URGENCY')?.alpha || 0;

      expect(alphaBefore).toBeGreaterThan(2.0);

      // Apply 24-hour decay
      globalThompsonSampler.decayBanditDistributions(merchantId, 0.5);

      const after = globalThompsonSampler.getConvergenceTelemetry(merchantId);
      const alphaAfter = after.HIGH.find((a) => a.arm === 'ARM_ZERO_DISCOUNT_URGENCY')?.alpha || 0;

      expect(alphaAfter).toBeLessThan(alphaBefore);
      expect(alphaAfter).toBeGreaterThanOrEqual(1.0);
    });
  });
});
