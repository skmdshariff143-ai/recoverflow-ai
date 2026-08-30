/**
 * RecoverFlow AI — Financial & Monetary Arithmetic Core.
 *
 * Implements strict integer-paise financial arithmetic to prevent floating-point
 * rounding errors, currency mixing, and precision loss across the recovery pipeline.
 *
 * Key Invariants:
 *  - All ledger and recovery amounts are stored in integer paise (1 INR = 100 Paise).
 *  - Probabilities can be represented as Basis Points (100% = 10,000 bps).
 *  - EV is calculated as: expectedValuePaise = Math.round((amountPaise * probabilityBps) / 10000).
 *  - Negative amounts are rejected.
 *  - Cross-currency mixing is strictly prevented (all canonical amounts are INR).
 */

export const BPS_SCALE = 10_000;
export const MAX_SAFE_PAISE = 1_000_000_000_000; // ₹100 Crore in Paise

/**
 * Currency validation error.
 */
export class FinancialValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FinancialValidationError';
  }
}

/**
 * Convert a 0–1 probability float to integer basis points [0, 10000].
 */
export function probabilityToBps(probability: number): number {
  if (typeof probability !== 'number' || isNaN(probability)) {
    throw new FinancialValidationError(`Invalid probability value: ${probability}`);
  }
  const clamped = Math.max(0, Math.min(1, probability));
  return Math.round(clamped * BPS_SCALE);
}

/**
 * Convert basis points [0, 10000] back to 0–1 float.
 */
export function bpsToProbability(bps: number): number {
  if (!Number.isInteger(bps) || bps < 0 || bps > BPS_SCALE) {
    throw new FinancialValidationError(`Basis points must be an integer between 0 and 10,000, received: ${bps}`);
  }
  return bps / BPS_SCALE;
}

/**
 * Calculate expected recovery value in integer paise.
 * expectedValuePaise = Math.round((amountPaise * probabilityBps) / 10,000)
 */
export function calculateExpectedValuePaise(amountPaise: number, probabilityBps: number): number {
  validatePaiseAmount(amountPaise);
  if (!Number.isInteger(probabilityBps) || probabilityBps < 0 || probabilityBps > BPS_SCALE) {
    throw new FinancialValidationError(`Invalid basis points: ${probabilityBps}`);
  }

  // Integer multiplication and scaled division with standard commercial rounding
  const ev = Math.round((amountPaise * probabilityBps) / BPS_SCALE);
  return ev;
}

/**
 * Validate that an amount is a non-negative integer within safe limits.
 */
export function validatePaiseAmount(amountPaise: number): void {
  if (typeof amountPaise !== 'number' || isNaN(amountPaise)) {
    throw new FinancialValidationError(`Amount must be a valid number, received: ${amountPaise}`);
  }
  if (!Number.isInteger(amountPaise)) {
    throw new FinancialValidationError(`Ledger amount must be an integer (paise), received: ${amountPaise}`);
  }
  if (amountPaise < 0) {
    throw new FinancialValidationError(`Negative financial amounts are strictly rejected: ${amountPaise}`);
  }
  if (amountPaise > MAX_SAFE_PAISE) {
    throw new FinancialValidationError(`Amount exceeds maximum safe ledger capacity (₹100 Cr): ${amountPaise}`);
  }
}

/**
 * Assert that two items share the exact same currency code (e.g. 'INR').
 */
export function assertMatchingCurrency(curr1: string, curr2: string): void {
  if (curr1.toUpperCase() !== curr2.toUpperCase()) {
    throw new FinancialValidationError(
      `Cross-currency mixing violation: cannot aggregate ${curr1} with ${curr2}`,
    );
  }
}

/**
 * Safely sum an array of paise amounts with overflow protection.
 */
export function sumPaise(amounts: number[]): number {
  let total = 0;
  for (const amt of amounts) {
    validatePaiseAmount(amt);
    total += amt;
    if (total > MAX_SAFE_PAISE) {
      throw new FinancialValidationError(`Sum exceeded maximum safe ledger capacity: ${total}`);
    }
  }
  return total;
}

/**
 * Format integer paise into human-readable INR format (e.g. ₹1,46,900.25).
 */
export function formatPaiseToINR(amountPaise: number, showDecimals: boolean = true): string {
  validatePaiseAmount(amountPaise);
  const rupees = amountPaise / 100;
  if (!showDecimals) {
    return `₹${Math.round(rupees).toLocaleString('en-IN')}`;
  }
  return `₹${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
