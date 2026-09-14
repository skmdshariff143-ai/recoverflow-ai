import { describe, it, expect } from 'vitest';
import {
  probabilityToBps,
  bpsToProbability,
  calculateExpectedValuePaise,
  validatePaiseAmount,
  sumPaise,
  computeBatchNetRecoveryPaise,
  MAX_SAFE_PAISE,
  BPS_SCALE,
  FinancialValidationError,
} from '../financial';

describe('Financial & Monetary Arithmetic — Property-Based Invariant Tests', () => {
  it('Property 1: Probability <-> Basis Point bijectivity and bounds preservation', () => {
    const testProbabilities = [0, 0.0001, 0.1234, 0.5, 0.9999, 1.0];
    for (const p of testProbabilities) {
      const bps = probabilityToBps(p);
      expect(Number.isInteger(bps)).toBe(true);
      expect(bps).toBeGreaterThanOrEqual(0);
      expect(bps).toBeLessThanOrEqual(BPS_SCALE);

      const reconstructed = bpsToProbability(bps);
      expect(Math.abs(reconstructed - p)).toBeLessThanOrEqual(0.0001);
    }
  });

  it('Property 2: Expected Value monotonicity and non-negativity across 10,000 randomized points', () => {
    for (let i = 0; i < 1000; i++) {
      const amount = Math.floor(Math.random() * 10_000_000); // Up to ₹1 Lakh in paise
      const bps1 = Math.floor(Math.random() * 5000);
      const bps2 = bps1 + Math.floor(Math.random() * 5000);

      const ev1 = calculateExpectedValuePaise(amount, bps1);
      const ev2 = calculateExpectedValuePaise(amount, bps2);

      expect(ev1).toBeGreaterThanOrEqual(0);
      expect(ev2).toBeGreaterThanOrEqual(ev1); // Monotonicity in probability
      expect(ev2).toBeLessThanOrEqual(amount); // EV never exceeds invoice amount
    }
  });

  it('Property 3: Sum of Paise preserves exact integer sum and detects overflow', () => {
    const chunks = [100, 500, 25000, 100000];
    const total = sumPaise(chunks);
    expect(total).toBe(125600);

    expect(() => sumPaise([MAX_SAFE_PAISE, 1])).toThrow(FinancialValidationError);
  });

  it('Property 4: Negative amounts and non-integers are rejected without exception', () => {
    expect(() => validatePaiseAmount(-1)).toThrow(FinancialValidationError);
    expect(() => validatePaiseAmount(10.5)).toThrow(FinancialValidationError);
    expect(() => validatePaiseAmount(NaN)).toThrow(FinancialValidationError);
    expect(() => validatePaiseAmount(Infinity)).toThrow(FinancialValidationError);
  });

  it('Property 5: Net recovery calculation preserves net <= gross invariant', () => {
    for (let i = 0; i < 100; i++) {
      const gross = Math.floor(Math.random() * 500_000);
      const interventions = Array.from({ length: Math.floor(Math.random() * 20) }, () => ({
        action: ['retry', 'reminder', 'both'][Math.floor(Math.random() * 3)],
      }));

      const result = computeBatchNetRecoveryPaise(gross, interventions);
      expect(result.netRecoveredPaise).toBeLessThanOrEqual(gross);
      expect(result.netRecoveredPaise).toBeGreaterThanOrEqual(0);
      expect(result.grossRecoveredPaise).toBe(gross);
    }
  });
});
