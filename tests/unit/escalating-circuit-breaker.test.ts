import { describe, it, expect } from 'vitest';
import {
  verifyFinancialSafety,
  auditCheckoutUrlAndDiscount,
} from '../../packages/agents/src/security/circuit-breaker';

describe('Escalating Zero-Trust Circuit Breaker (Track 3)', () => {
  describe('Stage 1 (Auditor)', () => {
    it('approves legitimate checkout URLs and valid discount formats', () => {
      const audit = auditCheckoutUrlAndDiscount(
        'https://aurora-luxury.myshopify.com/checkouts/c/tok_123/recover',
        'EXCLUSIVE10'
      );
      expect(audit.isValid).toBe(true);
    });

    it('rejects unencrypted or malicious URI schemes', () => {
      const audit = auditCheckoutUrlAndDiscount('http://insecure-site.com/checkout');
      expect(audit.isValid).toBe(false);
      expect(audit.reason).toContain('Insecure non-HTTPS');

      const xssAudit = auditCheckoutUrlAndDiscount('https://store.com/checkout?x=<script>alert(1)</script>');
      expect(xssAudit.isValid).toBe(false);
      expect(xssAudit.reason).toContain('Malicious URI');
    });
  });

  describe('Stage 2 (Auto-Correct)', () => {
    it('auto-corrects minor discount violations (e.g. 15% offered vs 10% ceiling) down to the ceiling', () => {
      const result = verifyFinancialSafety({
        cartSubtotal: 100.0,
        proposedDiscountPercentage: 15.0,
        discountCeilingPercentage: 10.0,
        checkoutUrl: 'https://aurora-luxury.myshopify.com/checkouts/c/tok_123/recover',
      });

      expect(result.stage).toBe('STAGE_2_AUTOCORRECTED');
      expect(result.requiresHumanApproval).toBe(false);
      expect(result.sanitizedDiscountPercentage).toBe(10.0);
      expect(result.sanitizedFinalTotal).toBe(90.0);
      expect(result.correctedCheckoutUrl).toContain('discount=EXCLUSIVE10');
    });
  });

  describe('Stage 3 (Human-in-the-Loop)', () => {
    it('halts dispatch and flags requiresHumanApproval when breach magnitude exceeds 10% threshold', () => {
      const result = verifyFinancialSafety({
        cartSubtotal: 200.0,
        proposedDiscountPercentage: 35.0, // 35% vs 10% ceiling = 25% breach (>10%)
        discountCeilingPercentage: 10.0,
      });

      expect(result.stage).toBe('STAGE_3_HUMAN_IN_THE_LOOP');
      expect(result.requiresHumanApproval).toBe(true);
      expect(result.sanitizedDiscountPercentage).toBe(0);
      expect(result.sanitizedFinalTotal).toBe(200.0);
      expect(result.violationReason).toContain('10% threshold');
    });
  });
});
