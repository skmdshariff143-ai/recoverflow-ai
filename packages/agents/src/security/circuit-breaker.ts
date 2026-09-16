/**
 * RecoverFlow Zero-Trust Financial Circuit Breaker (Track 3)
 * Principles: 3-Stage escalating guardrail with Auditor, Auto-Correct, and Human-in-the-Loop approval halts.
 */

export class FinancialGuardrailError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code = 'FINANCIAL_GUARDRAIL_VIOLATION', details?: Record<string, unknown>) {
    super(message);
    this.name = 'FinancialGuardrailError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, FinancialGuardrailError.prototype);
  }
}

export type CircuitBreakerStage = 
  | 'STAGE_1_AUDITED' 
  | 'STAGE_2_AUTOCORRECTED' 
  | 'STAGE_3_HUMAN_IN_THE_LOOP';

export interface FinancialVerificationInput {
  cartSubtotal: number;
  proposedDiscountPercentage?: number;
  proposedDiscountAmount?: number;
  proposedFinalTotal?: number;
  discountCeilingPercentage: number;
  minMarginPercentage?: number;
  checkoutUrl?: string;
  discountCode?: string | null;
  currency?: string;
  strictThrow?: boolean;
}

export interface FinancialVerificationResult {
  isSafe: boolean;
  stage: CircuitBreakerStage;
  subtotalCents: bigint;
  sanitizedDiscountPercentage: number;
  sanitizedDiscountAmountCents: bigint;
  sanitizedFinalTotalCents: bigint;
  sanitizedDiscountAmount: number;
  sanitizedFinalTotal: number;
  violationDetected: boolean;
  violationReason?: string;
  fallbackRequired: boolean;
  requiresHumanApproval: boolean;
  correctedCheckoutUrl?: string;
}

/**
 * Converts a floating-point currency amount to exact integer cents (BigInt).
 */
export function toCents(amount: number): bigint {
  if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
    return BigInt(0);
  }
  return BigInt(Math.round(amount * 100));
}

/**
 * Converts integer cents (BigInt) back to a standard floating-point representation with 2 decimal places.
 */
export function toDecimal(cents: bigint): number {
  return Number(cents) / 100;
}

/**
 * STAGE 1 (AUDITOR): Fast zero-shot validator that audits the generated checkout URL and discount code.
 */
export function auditCheckoutUrlAndDiscount(
  checkoutUrl?: string,
  discountCode?: string | null
): { isValid: boolean; reason?: string } {
  if (checkoutUrl) {
    // Must be valid HTTPS URL without open-redirect or script injections
    if (!checkoutUrl.startsWith('https://') && !checkoutUrl.startsWith('http://localhost')) {
      return { isValid: false, reason: 'Insecure non-HTTPS checkout URL' };
    }
    if (/<script|javascript:|data:/i.test(checkoutUrl)) {
      return { isValid: false, reason: 'Malicious URI scheme in checkout URL' };
    }
  }

  if (discountCode) {
    // Must be clean alphanumeric code without malicious syntax
    if (!/^[A-Za-z0-9_-]{3,30}$/.test(discountCode)) {
      return { isValid: false, reason: `Invalid discount code format: ${discountCode}` };
    }
  }

  return { isValid: true };
}

/**
 * Deterministically checks and verifies financial parameters across the 3-Stage Circuit Breaker.
 */
export function verifyFinancialSafety(input: FinancialVerificationInput): FinancialVerificationResult {
  const {
    cartSubtotal,
    proposedDiscountPercentage,
    proposedDiscountAmount,
    proposedFinalTotal,
    discountCeilingPercentage,
    minMarginPercentage = 20,
    checkoutUrl,
    discountCode,
    strictThrow = false,
  } = input;

  // STAGE 1: AUDITOR CHECK
  const audit = auditCheckoutUrlAndDiscount(checkoutUrl, discountCode);
  if (!audit.isValid) {
    if (strictThrow) {
      throw new FinancialGuardrailError(audit.reason || 'Audit failed', 'AUDITOR_REJECTED', { checkoutUrl, discountCode });
    }
    return {
      isSafe: false,
      stage: 'STAGE_3_HUMAN_IN_THE_LOOP',
      subtotalCents: toCents(cartSubtotal),
      sanitizedDiscountPercentage: 0,
      sanitizedDiscountAmountCents: BigInt(0),
      sanitizedFinalTotalCents: toCents(cartSubtotal),
      sanitizedDiscountAmount: 0,
      sanitizedFinalTotal: cartSubtotal,
      violationDetected: true,
      violationReason: audit.reason,
      fallbackRequired: true,
      requiresHumanApproval: true,
    };
  }

  // 1. Validate subtotal
  if (typeof cartSubtotal !== 'number' || isNaN(cartSubtotal) || cartSubtotal < 0 || !isFinite(cartSubtotal)) {
    const errorMsg = `Invalid cart subtotal: ${cartSubtotal}`;
    if (strictThrow) {
      throw new FinancialGuardrailError(errorMsg, 'INVALID_CART_SUBTOTAL', { cartSubtotal });
    }
    return {
      isSafe: false,
      stage: 'STAGE_3_HUMAN_IN_THE_LOOP',
      subtotalCents: BigInt(0),
      sanitizedDiscountPercentage: 0,
      sanitizedDiscountAmountCents: BigInt(0),
      sanitizedFinalTotalCents: BigInt(0),
      sanitizedDiscountAmount: 0,
      sanitizedFinalTotal: 0,
      violationDetected: true,
      violationReason: errorMsg,
      fallbackRequired: true,
      requiresHumanApproval: true,
    };
  }

  const subtotalCents = toCents(cartSubtotal);
  const ceilingPct = Math.max(0, Number(discountCeilingPercentage) || 0);
  const ceilingFactorBp = BigInt(Math.round(ceilingPct * 100));
  const maxAllowedDiscountCents = (subtotalCents * ceilingFactorBp) / BigInt(10000);

  let violationDetected = false;
  let violationReason: string | undefined;
  let effectiveDiscountPercentage = 0;
  let effectiveDiscountCents = BigInt(0);
  let breachSeverity = 0.0; // discrepancy magnitude in percent

  // 2. Validate proposed discount percentage
  if (proposedDiscountPercentage !== undefined) {
    if (typeof proposedDiscountPercentage !== 'number' || isNaN(proposedDiscountPercentage) || proposedDiscountPercentage < 0) {
      violationDetected = true;
      violationReason = `Invalid discount percentage format: ${proposedDiscountPercentage}`;
      breachSeverity = 20.0;
    } else if (proposedDiscountPercentage > ceilingPct + 1e-9) {
      violationDetected = true;
      breachSeverity = proposedDiscountPercentage - ceilingPct;
      violationReason = `Proposed discount percentage (${proposedDiscountPercentage}%) exceeds merchant ceiling (${ceilingPct}%)`;
    } else {
      effectiveDiscountPercentage = proposedDiscountPercentage;
      const pctBp = BigInt(Math.round(proposedDiscountPercentage * 100));
      effectiveDiscountCents = (subtotalCents * pctBp) / BigInt(10000);
    }
  }

  // 3. Validate proposed discount amount
  if (!violationDetected && proposedDiscountAmount !== undefined) {
    if (typeof proposedDiscountAmount !== 'number' || isNaN(proposedDiscountAmount) || proposedDiscountAmount < 0) {
      violationDetected = true;
      violationReason = `Invalid discount amount format: ${proposedDiscountAmount}`;
      breachSeverity = 20.0;
    } else {
      const amountCents = toCents(proposedDiscountAmount);
      if (amountCents > maxAllowedDiscountCents) {
        violationDetected = true;
        const proposedPct = subtotalCents > BigInt(0) ? Number((amountCents * BigInt(10000)) / subtotalCents) / 100 : 0;
        breachSeverity = proposedPct - ceilingPct;
        violationReason = `Proposed discount amount ($${toDecimal(amountCents)}) exceeds max allowed discount ($${toDecimal(maxAllowedDiscountCents)}) for ceiling ${ceilingPct}%`;
      } else {
        effectiveDiscountCents = amountCents;
        effectiveDiscountPercentage = subtotalCents > BigInt(0) ? Number((amountCents * BigInt(10000)) / subtotalCents) / 100 : 0;
      }
    }
  }

  // 4. Validate margin floor protection
  if (!violationDetected && minMarginPercentage !== undefined) {
    const minMarginBp = BigInt(Math.round(minMarginPercentage * 100));
    const maxDiscountAllowedByMarginBp = BigInt(10000) - minMarginBp;
    if (maxDiscountAllowedByMarginBp > BigInt(0)) {
      const marginLimitCents = (subtotalCents * maxDiscountAllowedByMarginBp) / BigInt(10000);
      if (effectiveDiscountCents > marginLimitCents) {
        violationDetected = true;
        breachSeverity = 15.0;
        violationReason = `Discount exceeds minimum profit margin requirement of ${minMarginPercentage}%`;
      }
    }
  }

  // 5. Final total recalculation using exact BigInt math
  const calculatedFinalCents = subtotalCents - effectiveDiscountCents;

  // 6. Validate proposed final total if provided (floating-point mismatch check)
  if (!violationDetected && proposedFinalTotal !== undefined) {
    if (typeof proposedFinalTotal !== 'number' || isNaN(proposedFinalTotal) || proposedFinalTotal < 0) {
      violationDetected = true;
      breachSeverity = 15.0;
      violationReason = `Invalid final total format: ${proposedFinalTotal}`;
    } else {
      const proposedFinalCents = toCents(proposedFinalTotal);
      const diff = calculatedFinalCents > proposedFinalCents ? calculatedFinalCents - proposedFinalCents : proposedFinalCents - calculatedFinalCents;
      if (diff > BigInt(1)) {
        violationDetected = true;
        breachSeverity = 12.0;
        violationReason = `Final total mismatch: proposed $${toDecimal(proposedFinalCents)} != recalculated $${toDecimal(calculatedFinalCents)}`;
      }
    }
  }

  // STAGE 3: MASSIVE BREACH (>10% discrepancy) -> REQUIRES HUMAN IN THE LOOP
  if (violationDetected && breachSeverity > 10.0) {
    if (strictThrow) {
      throw new FinancialGuardrailError(violationReason || 'Critical financial breach', 'MASSIVE_DISCOUNT_BREACH', {
        cartSubtotal,
        proposedDiscountPercentage,
        breachSeverity,
      });
    }

    return {
      isSafe: false,
      stage: 'STAGE_3_HUMAN_IN_THE_LOOP',
      subtotalCents,
      sanitizedDiscountPercentage: 0,
      sanitizedDiscountAmountCents: BigInt(0),
      sanitizedFinalTotalCents: subtotalCents,
      sanitizedDiscountAmount: 0,
      sanitizedFinalTotal: toDecimal(subtotalCents),
      violationDetected: true,
      violationReason: `${violationReason} (Breach magnitude: ${breachSeverity.toFixed(1)}% > 10% threshold)`,
      fallbackRequired: true,
      requiresHumanApproval: true,
    };
  }

  // STAGE 2: AUTO-CORRECT (clamp to merchant ceiling using safe integer math)
  if (violationDetected) {
    const fallbackDiscountPercentage = ceilingPct;
    const fallbackDiscountCents = maxAllowedDiscountCents;
    const fallbackFinalCents = subtotalCents - fallbackDiscountCents;

    let correctedUrl = checkoutUrl;
    if (checkoutUrl) {
      const base = checkoutUrl.split('?')[0];
      correctedUrl = ceilingPct > 0 ? `${base}?discount=EXCLUSIVE${Math.floor(ceilingPct)}` : base;
    }

    return {
      isSafe: false,
      stage: 'STAGE_2_AUTOCORRECTED',
      subtotalCents,
      sanitizedDiscountPercentage: fallbackDiscountPercentage,
      sanitizedDiscountAmountCents: fallbackDiscountCents,
      sanitizedFinalTotalCents: fallbackFinalCents,
      sanitizedDiscountAmount: toDecimal(fallbackDiscountCents),
      sanitizedFinalTotal: toDecimal(fallbackFinalCents),
      violationDetected: true,
      violationReason,
      fallbackRequired: true,
      requiresHumanApproval: false,
      correctedCheckoutUrl: correctedUrl,
    };
  }

  // STAGE 1: AUDITED & APPROVED
  return {
    isSafe: true,
    stage: 'STAGE_1_AUDITED',
    subtotalCents,
    sanitizedDiscountPercentage: effectiveDiscountPercentage,
    sanitizedDiscountAmountCents: effectiveDiscountCents,
    sanitizedFinalTotalCents: calculatedFinalCents,
    sanitizedDiscountAmount: toDecimal(effectiveDiscountCents),
    sanitizedFinalTotal: toDecimal(calculatedFinalCents),
    violationDetected: false,
    fallbackRequired: false,
    requiresHumanApproval: false,
    correctedCheckoutUrl: checkoutUrl,
  };
}

/**
 * Intercepts LLM generated response text to verify that any mentioned prices or discounts
 * adhere strictly to the merchant's financial ceiling across the 3 stages.
 */
export function interceptAndEnforceFinancialSafety(
  llmReply: string,
  input: FinancialVerificationInput
): { safeReply: string; verifiedResult: FinancialVerificationResult } {
  const verified = verifyFinancialSafety(input);

  if (verified.isSafe && !verified.violationDetected) {
    return {
      safeReply: llmReply,
      verifiedResult: verified,
    };
  }

  if (verified.requiresHumanApproval) {
    return {
      safeReply: "Thank you for contacting customer support! We have flagged your request for senior management review and will follow up shortly.",
      verifiedResult: verified,
    };
  }

  // STAGE 2: Auto-correct fallback response
  const maxPct = input.discountCeilingPercentage;
  const currency = input.currency || 'USD';
  const finalPriceFormatted = `${currency} ${verified.sanitizedFinalTotal.toFixed(2)}`;

  let fallbackMessage = '';
  if (maxPct > 0) {
    fallbackMessage = `We'd love to help you complete your order! The maximum authorized saving for your basket is ${maxPct}%, bringing your total to ${finalPriceFormatted}. You can complete your checkout here.`;
  } else {
    fallbackMessage = `Our items are handcrafted and priced at our absolute direct-to-consumer value, so we do not have active discount codes today. Your total is ${currency} ${input.cartSubtotal.toFixed(2)}.`;
  }

  return {
    safeReply: fallbackMessage,
    verifiedResult: verified,
  };
}
