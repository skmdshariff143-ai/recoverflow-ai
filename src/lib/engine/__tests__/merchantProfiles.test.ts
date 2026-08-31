/**
 * PayBack AI — Multi-Merchant Risk Profiles Unit Tests.
 */

import { describe, it, expect } from 'vitest';
import {
  MERCHANT_PROFILES,
  evaluateAllMerchantProfiles,
} from '../merchantProfiles';
import { generateSyntheticPayments } from '../generateData';

describe('Merchant Risk Profiles & Multi-Policy Platform Framing', () => {
  const payments = generateSyntheticPayments({ seed: 42, totalRecords: 100 });

  it('defines 3 distinct merchant risk profiles with valid parameters', () => {
    expect(MERCHANT_PROFILES.conservative.budgetSlots).toBe(20);
    expect(MERCHANT_PROFILES.conservative.approvalThresholdINR).toBe(25000);
    expect(MERCHANT_PROFILES.conservative.autoApproveHighValueWithHighEV).toBe(false);

    expect(MERCHANT_PROFILES.balanced.budgetSlots).toBe(40);
    expect(MERCHANT_PROFILES.balanced.approvalThresholdINR).toBe(50000);
    expect(MERCHANT_PROFILES.balanced.autoApproveHighValueWithHighEV).toBe(true);

    expect(MERCHANT_PROFILES.aggressive.budgetSlots).toBe(60);
    expect(MERCHANT_PROFILES.aggressive.approvalThresholdINR).toBe(100000);
    expect(MERCHANT_PROFILES.aggressive.autoApproveHighValueWithHighEV).toBe(true);
  });

  it('evaluates all 3 presets across identical 100-payment dataset producing differentiated yields', () => {
    const results = evaluateAllMerchantProfiles(payments, 42);
    expect(results).toHaveLength(3);

    const [cons, bal, agg] = results;

    expect(cons.profile.id).toBe('conservative');
    expect(bal.profile.id).toBe('balanced');
    expect(agg.profile.id).toBe('aggressive');

    // Conservative uses fewer budget slots
    expect(cons.budgetedSlots).toBe(20);
    expect(bal.budgetedSlots).toBe(40);
    expect(agg.budgetedSlots).toBe(60);

    // Aggressive recovers more top-line revenue by expanding budget
    expect(agg.recoveredAmountINR).toBeGreaterThanOrEqual(bal.recoveredAmountINR);
    expect(bal.recoveredAmountINR).toBeGreaterThanOrEqual(cons.recoveredAmountINR);

    // Conservative has highest precision / strict stopping
    expect(cons.safetyStopsCount).toBeGreaterThan(0);
    expect(bal.safetyStopsCount).toBeGreaterThan(0);
    expect(agg.safetyStopsCount).toBeGreaterThan(0);
  });

  it('computes valid calibration error and Brier score for all profiles', () => {
    const results = evaluateAllMerchantProfiles(payments, 42);
    for (const res of results) {
      expect(res.calibrationErrorPercent).toBeGreaterThanOrEqual(0);
      expect(res.calibrationErrorPercent).toBeLessThanOrEqual(100);
      expect(res.brierScore).toBeGreaterThanOrEqual(0);
      expect(res.brierScore).toBeLessThanOrEqual(1);
    }
  });
});
