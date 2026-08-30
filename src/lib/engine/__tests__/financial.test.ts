/**
 * Unit tests for RecoverFlow AI Financial & Monetary Invariants (Phase 2).
 */

import { describe, it, expect } from 'vitest';
import {
  probabilityToBps,
  bpsToProbability,
  calculateExpectedValuePaise,
  validatePaiseAmount,
  assertMatchingCurrency,
  sumPaise,
  formatPaiseToINR,
  FinancialValidationError,
  MAX_SAFE_PAISE,
} from '../financial';

describe('Financial & Monetary Arithmetic Core', () => {

  describe('Basis Points Conversions', () => {
    it('converts probabilities to basis points accurately', () => {
      expect(probabilityToBps(0)).toBe(0);
      expect(probabilityToBps(0.5)).toBe(5000);
      expect(probabilityToBps(0.748)).toBe(7480);
      expect(probabilityToBps(1.0)).toBe(10000);
    });

    it('clamps out-of-range probabilities into [0, 10000] bps', () => {
      expect(probabilityToBps(-0.1)).toBe(0);
      expect(probabilityToBps(1.5)).toBe(10000);
    });

    it('converts basis points back to floating probability', () => {
      expect(bpsToProbability(0)).toBe(0);
      expect(bpsToProbability(7480)).toBe(0.748);
      expect(bpsToProbability(10000)).toBe(1.0);
    });

    it('rejects non-integer basis points', () => {
      expect(() => bpsToProbability(500.5)).toThrow(FinancialValidationError);
    });
  });

  describe('Expected Value Calculations (Integer Paise)', () => {
    it('computes exact integer paise for ₹0 and ₹0.01 (1 paisa)', () => {
      // ₹0 with 50% prob -> 0 paise
      expect(calculateExpectedValuePaise(0, 5000)).toBe(0);

      // ₹0.01 (1 paisa) with 50% prob -> round(1 * 5000 / 10000) = 1 paisa
      expect(calculateExpectedValuePaise(1, 5000)).toBe(1);

      // ₹0.01 (1 paisa) with 40% prob -> round(1 * 4000 / 10000) = 0 paise
      expect(calculateExpectedValuePaise(1, 4000)).toBe(0);
    });

    it('computes exact expected value on standard enterprise invoices', () => {
      // ₹5,000.00 (500,000 paise) @ 75.00% (7,500 bps) -> 375,000 paise (₹3,750.00)
      const ev = calculateExpectedValuePaise(500_000, 7500);
      expect(ev).toBe(375_000);
      expect(Number.isInteger(ev)).toBe(true);
    });

    it('computes expected value on large enterprise sums without precision loss', () => {
      // ₹50,00,000 (500,000,000 paise) @ 62.50% (6,250 bps) -> 312,500,000 paise
      const largeAmt = 500_000_000;
      const ev = calculateExpectedValuePaise(largeAmt, 6250);
      expect(ev).toBe(312_500_000);
    });

    it('handles rounding boundaries cleanly', () => {
      // 3 paise * 5000 bps / 10000 = 1.5 -> rounds to 2 paise
      expect(calculateExpectedValuePaise(3, 5000)).toBe(2);
      // 1 paisa * 4999 bps / 10000 = 0.4999 -> rounds to 0 paise
      expect(calculateExpectedValuePaise(1, 4999)).toBe(0);
      // 1 paisa * 5000 bps / 10000 = 0.5 -> rounds to 1 paisa
      expect(calculateExpectedValuePaise(1, 5000)).toBe(1);
    });
  });

  describe('Validation & Edge Case Rejection', () => {
    it('rejects negative amounts strictly', () => {
      expect(() => validatePaiseAmount(-100)).toThrow(FinancialValidationError);
      expect(() => calculateExpectedValuePaise(-5000, 5000)).toThrow(FinancialValidationError);
    });

    it('rejects non-integer floating rupee amounts as paise', () => {
      expect(() => validatePaiseAmount(100.5)).toThrow(FinancialValidationError);
    });

    it('rejects amounts exceeding maximum safe capacity', () => {
      expect(() => validatePaiseAmount(MAX_SAFE_PAISE + 1)).toThrow(FinancialValidationError);
    });

    it('prevents cross-currency mixing', () => {
      expect(() => assertMatchingCurrency('INR', 'INR')).not.toThrow();
      expect(() => assertMatchingCurrency('inr', 'INR')).not.toThrow();
      expect(() => assertMatchingCurrency('INR', 'USD')).toThrow(FinancialValidationError);
      expect(() => assertMatchingCurrency('EUR', 'INR')).toThrow(FinancialValidationError);
    });
  });

  describe('Summation & Formatting', () => {
    it('sums arrays of integer paise accurately', () => {
      const amounts = [100_000, 250_000, 50_000, 1]; // ₹1000, ₹2500, ₹500, ₹0.01
      expect(sumPaise(amounts)).toBe(400_001);
    });

    it('formats paise to standard Indian numbering format (lakhs & crores)', () => {
      expect(formatPaiseToINR(14690025, true)).toBe('₹1,46,900.25');
      expect(formatPaiseToINR(14690025, false)).toBe('₹1,46,900');
      expect(formatPaiseToINR(0, true)).toBe('₹0.00');
      expect(formatPaiseToINR(1, true)).toBe('₹0.01');
    });
  });
});
