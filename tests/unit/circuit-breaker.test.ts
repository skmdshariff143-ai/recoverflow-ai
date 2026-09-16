import { describe, it, expect } from 'vitest';
import {
  verifyFinancialSafety,
  interceptAndEnforceFinancialSafety,
  toCents,
  toDecimal,
  FinancialGuardrailError,
} from '../../packages/agents/src/security/circuit-breaker';

describe('Zero-Trust Financial Circuit Breaker (Track 1)', () => {
  describe('BigInt Integer Arithmetic & Precision', () => {
    it('accurately converts currency amounts to integer cents without floating-point drift', () => {
      // Classic JS floating point 0.1 + 0.2 = 0.30000000000000004
      const sum = 0.1 + 0.2;
      expect(sum).not.toBe(0.3);
      expect(toCents(sum)).toBe(BigInt(30));
      expect(toDecimal(BigInt(30))).toBe(0.3);

      expect(toCents(19.99)).toBe(BigInt(1999));
      expect(toCents(0)).toBe(BigInt(0));
      expect(toCents(-10)).toBe(BigInt(-1000));
      expect(toCents(NaN)).toBe(BigInt(0));
    });

    it('calculates 15% discount on $199.99 without rounding discrepancies', () => {
      const result = verifyFinancialSafety({
        cartSubtotal: 199.99,
        proposedDiscountPercentage: 15,
        discountCeilingPercentage: 15,
      });

      expect(result.isSafe).toBe(true);
      expect(result.violationDetected).toBe(false);
      expect(result.subtotalCents).toBe(BigInt(19999));
      // 19999 * 1500 / 10000 = 2999 cents ($29.99)
      expect(result.sanitizedDiscountAmountCents).toBe(BigInt(2999));
      expect(result.sanitizedDiscountAmount).toBe(29.99);
      // 19999 - 2999 = 17000 cents ($170.00)
      expect(result.sanitizedFinalTotalCents).toBe(BigInt(17000));
      expect(result.sanitizedFinalTotal).toBe(170);
    });
  });

  describe('Discount Ceiling Enforcement', () => {
    it('approves discounts strictly at or below merchant ceiling', () => {
      const result = verifyFinancialSafety({
        cartSubtotal: 100.0,
        proposedDiscountPercentage: 10,
        discountCeilingPercentage: 15,
      });

      expect(result.isSafe).toBe(true);
      expect(result.violationDetected).toBe(false);
      expect(result.sanitizedDiscountPercentage).toBe(10);
      expect(result.sanitizedFinalTotal).toBe(90.0);
    });

    it('flags violation when proposed discount percentage exceeds ceiling (e.g. 20% > 15%)', () => {
      const result = verifyFinancialSafety({
        cartSubtotal: 100.0,
        proposedDiscountPercentage: 20,
        discountCeilingPercentage: 15,
      });

      expect(result.isSafe).toBe(false);
      expect(result.violationDetected).toBe(true);
      expect(result.violationReason).toContain('exceeds merchant ceiling');
      // Should sanitize down to ceiling
      expect(result.sanitizedDiscountPercentage).toBe(15);
      expect(result.sanitizedFinalTotal).toBe(85.0);
    });

    it('flags violation when floating-point precision slightly exceeds ceiling (e.g. 15.0001%)', () => {
      const result = verifyFinancialSafety({
        cartSubtotal: 250.0,
        proposedDiscountPercentage: 15.0001,
        discountCeilingPercentage: 15.0,
      });

      expect(result.isSafe).toBe(false);
      expect(result.violationDetected).toBe(true);
      expect(result.sanitizedDiscountPercentage).toBe(15.0);
    });

    it('throws FinancialGuardrailError when strictThrow is enabled', () => {
      expect(() => {
        verifyFinancialSafety({
          cartSubtotal: 100.0,
          proposedDiscountPercentage: 50,
          discountCeilingPercentage: 15,
          strictThrow: true,
        });
      }).toThrowError(FinancialGuardrailError);
    });
  });

  describe('Final Total & Margin Protection Checks', () => {
    it('flags violation if proposed final total does not match recalculated arithmetic total', () => {
      // LLM claims total is $40 instead of $90
      const result = verifyFinancialSafety({
        cartSubtotal: 100.0,
        proposedDiscountPercentage: 10,
        proposedFinalTotal: 40.0,
        discountCeilingPercentage: 15,
      });

      expect(result.isSafe).toBe(false);
      expect(result.violationDetected).toBe(true);
      expect(result.violationReason).toContain('Final total mismatch');
    });

    it('flags violation when discount exceeds minimum margin protection requirement', () => {
      const result = verifyFinancialSafety({
        cartSubtotal: 100.0,
        proposedDiscountPercentage: 85,
        discountCeilingPercentage: 90,
        minMarginPercentage: 25, // Max discount allowed is 75%
      });

      expect(result.isSafe).toBe(false);
      expect(result.violationDetected).toBe(true);
      expect(result.violationReason).toContain('minimum profit margin requirement');
    });

    it('handles zero discount ceiling correctly', () => {
      const result = verifyFinancialSafety({
        cartSubtotal: 80.0,
        proposedDiscountPercentage: 5,
        discountCeilingPercentage: 0,
      });

      expect(result.isSafe).toBe(false);
      expect(result.violationDetected).toBe(true);
      expect(result.sanitizedDiscountPercentage).toBe(0);
      expect(result.sanitizedFinalTotal).toBe(80.0);
    });
  });

  describe('interceptAndEnforceFinancialSafety LLM Interceptor', () => {
    it('passes through safe LLM replies intact', () => {
      const llmReply = 'We can offer 10% off your cart today with code EXCLUSIVE10!';
      const result = interceptAndEnforceFinancialSafety(llmReply, {
        cartSubtotal: 120.0,
        proposedDiscountPercentage: 10,
        discountCeilingPercentage: 15,
      });

      expect(result.safeReply).toBe(llmReply);
      expect(result.verifiedResult.isSafe).toBe(true);
    });

    it('intercepts and auto-corrects minor LLM discount violations (Stage 2 Auto-Correct)', () => {
      const llmReply = 'You can have this entire order for 20% off with code SAVE20!';
      const result = interceptAndEnforceFinancialSafety(llmReply, {
        cartSubtotal: 100.0,
        proposedDiscountPercentage: 20,
        discountCeilingPercentage: 15,
        currency: 'USD',
      });

      expect(result.safeReply).not.toBe(llmReply);
      expect(result.safeReply).toContain('maximum authorized saving for your basket is 15%');
      expect(result.safeReply).toContain('USD 85.00');
      expect(result.verifiedResult.violationDetected).toBe(true);
      expect(result.verifiedResult.stage).toBe('STAGE_2_AUTOCORRECTED');
    });

    it('intercepts and halts on massive LLM discount hallucinations (Stage 3 Human-in-the-Loop)', () => {
      const llmReply = 'You can have this entire order for 60% off with code CRAZY60!';
      const result = interceptAndEnforceFinancialSafety(llmReply, {
        cartSubtotal: 100.0,
        proposedDiscountPercentage: 60,
        discountCeilingPercentage: 15,
        currency: 'USD',
      });

      expect(result.safeReply).not.toBe(llmReply);
      expect(result.safeReply).toContain('senior management review');
      expect(result.verifiedResult.requiresHumanApproval).toBe(true);
      expect(result.verifiedResult.stage).toBe('STAGE_3_HUMAN_IN_THE_LOOP');
    });
  });
});
