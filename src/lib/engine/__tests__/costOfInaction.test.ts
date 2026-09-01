import { describe, it, expect } from 'vitest';
import { calculateCostOfInaction, DEFAULT_HOURLY_DECAY_BPS } from '../costOfInaction';

describe('calculateCostOfInaction', () => {
  it('correctly calculates hourly loss from total revenue at risk at default 75 bps (0.75%) rate', () => {
    // ₹6,87,694.53 = 68,769,453 paise
    const atRiskPaise = 68769453;
    const metrics = calculateCostOfInaction(atRiskPaise);

    expect(metrics.totalRevenueAtRiskPaise).toBe(68769453);
    expect(metrics.hourlyDecayRateBps).toBe(DEFAULT_HOURLY_DECAY_BPS);
    expect(metrics.decayRatePercentage).toBe(0.75);

    // Expected: 68,769,453 * 75 / 10000 = 515770.8975 -> rounded to 515,771 paise (₹5,157.71)
    expect(metrics.hourlyLossPaise).toBe(515771);
    expect(metrics.hourlyLossRupees).toBe(5157.71);
    expect(metrics.lossPerSecondPaise).toBeCloseTo(515771 / 3600, 2);
  });

  it('handles zero and negative at-risk inputs safely without negative values', () => {
    const zeroMetrics = calculateCostOfInaction(0);
    expect(zeroMetrics.hourlyLossPaise).toBe(0);
    expect(zeroMetrics.hourlyLossRupees).toBe(0);

    const negMetrics = calculateCostOfInaction(-50000);
    expect(negMetrics.hourlyLossPaise).toBe(0);
    expect(negMetrics.hourlyLossRupees).toBe(0);
  });

  it('supports custom hourly decay rates within valid 0-10000 bps range', () => {
    const atRiskPaise = 10000000; // ₹1,00,000 (10,000,000 paise)
    // 150 bps = 1.50% / hr
    const metrics = calculateCostOfInaction(atRiskPaise, 150);

    expect(metrics.hourlyDecayRateBps).toBe(150);
    expect(metrics.decayRatePercentage).toBe(1.5);
    expect(metrics.hourlyLossPaise).toBe(150000); // ₹1,500
    expect(metrics.hourlyLossRupees).toBe(1500);
  });
});
