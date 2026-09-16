/**
 * RecoverFlow Zero-Trust Financial Circuit Breaker
 * Principles: Strict integer-cents arithmetic, mathematical determinism, and discount ceiling enforcement.
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

export interface FinancialVerificationInput {
  cartSubtotal: number;
  proposedDiscountPercentage?: number;
  proposedDiscountAmount?: number;
  proposedFinalTotal?: number;
  discountCeilingPercentage: number;
  minMarginPercentage?: number;
  currency?: string;
  strictThrow?: boolean;
}

export interface FinancialVerificationResult {
  isSafe: boolean;
  subtotalCents: bigint;
  sanitizedDiscountPercentage: number;
  sanitizedDiscountAmountCents: bigint;
  sanitizedFinalTotalCents: bigint;
  sanitizedDiscountAmount: number;
  sanitizedFinalTotal: number;
  violationDetected: boolean;
  violationReason?: string;
  fallbackRequired: boolean;
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
 * Deterministically checks and verifies financial parameters before LLM output is dispatched.
 */
export function verifyFinancialSafety(input: FinancialVerificationInput): FinancialVerificationResult {
  const {
    cartSubtotal,
    proposedDiscountPercentage,
    proposedDiscountAmount,
    proposedFinalTotal,
    discountCeilingPercentage,
    minMarginPercentage = 20,
    strictThrow = false,
  } = input;

  // 1. Validate subtotal
  if (typeof cartSubtotal !== 'number' || isNaN(cartSubtotal) || cartSubtotal < 0 || !isFinite(cartSubtotal)) {
    const errorMsg = `Invalid cart subtotal: ${cartSubtotal}`;
    if (strictThrow) {
      throw new FinancialGuardrailError(errorMsg, 'INVALID_CART_SUBTOTAL', { cartSubtotal });
    }
    return {
      isSafe: false,
      subtotalCents: BigInt(0),
      sanitizedDiscountPercentage: 0,
      sanitizedDiscountAmountCents: BigInt(0),
      sanitizedFinalTotalCents: BigInt(0),
      sanitizedDiscountAmount: 0,
      sanitizedFinalTotal: 0,
      violationDetected: true,
      violationReason: errorMsg,
      fallbackRequired: true,
    };
  }

  const subtotalCents = toCents(cartSubtotal);
  const ceilingPct = Math.max(0, Number(discountCeilingPercentage) || 0);
  const ceilingFactorBp = BigInt(Math.round(ceilingPct * 100)); // basis points (15% = 1500bp)
  const maxAllowedDiscountCents = (subtotalCents * ceilingFactorBp) / BigInt(10000);

  let violationDetected = false;
  let violationReason: string | undefined;
  let effectiveDiscountPercentage = 0;
  let effectiveDiscountCents = BigInt(0);

  // 2. Validate proposed discount percentage
  if (proposedDiscountPercentage !== undefined) {
    if (typeof proposedDiscountPercentage !== 'number' || isNaN(proposedDiscountPercentage) || proposedDiscountPercentage < 0) {
      violationDetected = true;
      violationReason = `Invalid discount percentage format: ${proposedDiscountPercentage}`;
    } else if (proposedDiscountPercentage > ceilingPct + 1e-9) {
      violationDetected = true;
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
    } else {
      const amountCents = toCents(proposedDiscountAmount);
      if (amountCents > maxAllowedDiscountCents) {
        violationDetected = true;
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
    // Max allowable discount cannot exceed (100% - minMargin%)
    const maxDiscountAllowedByMarginBp = BigInt(10000) - minMarginBp;
    if (maxDiscountAllowedByMarginBp > BigInt(0)) {
      const marginLimitCents = (subtotalCents * maxDiscountAllowedByMarginBp) / BigInt(10000);
      if (effectiveDiscountCents > marginLimitCents) {
        violationDetected = true;
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
      violationReason = `Invalid final total format: ${proposedFinalTotal}`;
    } else {
      const proposedFinalCents = toCents(proposedFinalTotal);
      // Disallow price hallucinations or rounding discrepancies > 1 cent
      const diff = calculatedFinalCents > proposedFinalCents ? calculatedFinalCents - proposedFinalCents : proposedFinalCents - calculatedFinalCents;
      if (diff > BigInt(1)) {
        violationDetected = true;
        violationReason = `Final total mismatch: proposed $${toDecimal(proposedFinalCents)} != recalculated $${toDecimal(calculatedFinalCents)}`;
      }
    }
  }

  if (violationDetected) {
    if (strictThrow) {
      throw new FinancialGuardrailError(violationReason || 'Financial guardrail violation', 'FINANCIAL_GUARDRAIL_VIOLATION', {
        cartSubtotal,
        proposedDiscountPercentage,
        proposedDiscountAmount,
        proposedFinalTotal,
        discountCeilingPercentage,
      });
    }

    // Safe fallback: clamp discount to ceiling or 0
    const fallbackDiscountPercentage = ceilingPct;
    const fallbackDiscountCents = maxAllowedDiscountCents;
    const fallbackFinalCents = subtotalCents - fallbackDiscountCents;

    return {
      isSafe: false,
      subtotalCents,
      sanitizedDiscountPercentage: fallbackDiscountPercentage,
      sanitizedDiscountAmountCents: fallbackDiscountCents,
      sanitizedFinalTotalCents: fallbackFinalCents,
      sanitizedDiscountAmount: toDecimal(fallbackDiscountCents),
      sanitizedFinalTotal: toDecimal(fallbackFinalCents),
      violationDetected: true,
      violationReason,
      fallbackRequired: true,
    };
  }

  return {
    isSafe: true,
    subtotalCents,
    sanitizedDiscountPercentage: effectiveDiscountPercentage,
    sanitizedDiscountAmountCents: effectiveDiscountCents,
    sanitizedFinalTotalCents: calculatedFinalCents,
    sanitizedDiscountAmount: toDecimal(effectiveDiscountCents),
    sanitizedFinalTotal: toDecimal(calculatedFinalCents),
    violationDetected: false,
    fallbackRequired: false,
  };
}

/**
 * Intercepts LLM generated response text to verify that any mentioned prices or discounts
 * adhere strictly to the merchant's financial ceiling.
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

  // If financial violation occurred in the LLM output, provide deterministic safe fallback response
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
