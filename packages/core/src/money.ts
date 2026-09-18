/**
 * RecoverFlow AI — Standardized Financial Money Domain
 *
 * Enforces integer minor unit arithmetic (paise, cents) across the entire platform.
 * Eliminates binary floating-point rounding errors and drift.
 *
 * Invariant: 1 INR = 100 paise; 1 USD = 100 cents.
 * Basis points: 10,000 bps = 100.00% (1 bps = 0.01%).
 * Transport Convention: APIs transport financial amounts as explicit decimal strings
 * ("1499.00") or integer minor units ("149900" / 149900n).
 */

export interface MoneyAmount {
  amountMinor: bigint;
  currency: string;
}

export interface MoneyTransport {
  amountMinor: string;
  currency: string;
  formatted: string;
}

/**
 * Validates whether a minor unit value is within safe integer representation for JavaScript Numbers.
 */
export function isSafeMinorInteger(value: bigint | number): boolean {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value);
  }
  return value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER);
}

/**
 * Converts BigInt minor units to number safely (throws RangeError if out of safe bounds).
 * Enforces strict safe BigInt boundary.
 */
export function toSafeInteger(value: bigint | number): number {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new RangeError(`Number value ${value} is not a safe integer`);
    }
    return value;
  }
  if (!isSafeMinorInteger(value)) {
    throw new RangeError(
      `BigInt value ${value.toString()} exceeds Number.MAX_SAFE_INTEGER (${Number.MAX_SAFE_INTEGER}) and cannot be safely converted to float Number`
    );
  }
  return Number(value);
}

/**
 * Alias for toSafeInteger for backward compatibility.
 */
export const minorUnitsToSafeNumber = toSafeInteger;

/**
 * Parses a decimal string, number, or integer into integer minor units (BigInt).
 * Never uses binary floating-point multiplication (Math.round(val * 100)) on decimal strings.
 * Example: '1499.00' -> 149900n, '0.01' -> 1n, '999.99' -> 99999n.
 */
export function parseDecimalToMinorUnits(value: string | number | bigint, _currency = 'INR'): bigint {
  if (typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Cannot convert non-finite number ${value} to minor units`);
    }
    // Convert to exact string representation with 2 decimal places
    const str = value.toFixed(2);
    return parseDecimalStringToMinor(str);
  }

  if (typeof value === 'string') {
    return parseDecimalStringToMinor(value);
  }

  return 0n;
}

/**
 * Parses an exact decimal string to BigInt minor units without float math.
 */
function parseDecimalStringToMinor(valueStr: string): bigint {
  const clean = valueStr.trim().replace(/[^0-9.-]/g, '');
  if (!clean || clean === '-' || clean === '.') {
    return 0n;
  }

  const isNegative = clean.startsWith('-');
  const absStr = isNegative ? clean.slice(1) : clean;
  const parts = absStr.split('.');

  // Integer portion
  const integerPart = BigInt(parts[0] || '0');

  // Fractional portion normalized to exactly 2 digits (paise / cents)
  let fractionalStr = parts[1] || '00';
  if (fractionalStr.length === 0) fractionalStr = '00';
  else if (fractionalStr.length === 1) fractionalStr += '0';
  else if (fractionalStr.length > 2) {
    // Truncate/round to 2 digits deterministically
    fractionalStr = fractionalStr.slice(0, 2);
  }

  const fractionalPart = BigInt(fractionalStr);
  const total = integerPart * 100n + fractionalPart;
  return isNegative ? -total : total;
}

/**
 * Formats integer minor units into standard decimal string.
 * Example: 149900n -> '1499.00', 1n -> '0.01'.
 */
export function formatMinorUnits(amountMinor: bigint | number, _currency = 'INR'): string {
  const b = typeof amountMinor === 'bigint' ? amountMinor : BigInt(Math.round(amountMinor));
  const isNegative = b < 0n;
  const abs = isNegative ? -b : b;
  const integer = abs / 100n;
  const fraction = abs % 100n;
  const fractionStr = fraction < 10n ? `0${fraction}` : fraction.toString();
  return `${isNegative ? '-' : ''}${integer.toString()}.${fractionStr}`;
}

/**
 * Serializes minor units into standard API transport representation.
 */
export function serializeMoneyTransport(amountMinor: bigint | number, currency = 'INR'): MoneyTransport {
  const minor = typeof amountMinor === 'bigint' ? amountMinor : BigInt(amountMinor);
  return {
    amountMinor: minor.toString(),
    currency,
    formatted: formatMinorUnits(minor, currency),
  };
}

/**
 * Adds two minor unit amounts.
 */
export function addMoney(a: bigint | number, b: bigint | number): bigint {
  const aBig = typeof a === 'bigint' ? a : BigInt(a);
  const bBig = typeof b === 'bigint' ? b : BigInt(b);
  return aBig + bBig;
}

/**
 * Subtracts two minor unit amounts.
 */
export function subtractMoney(a: bigint | number, b: bigint | number): bigint {
  const aBig = typeof a === 'bigint' ? a : BigInt(a);
  const bBig = typeof b === 'bigint' ? b : BigInt(b);
  return aBig - bBig;
}

/**
 * Multiplies an integer minor amount by an integer quantity.
 */
export function multiplyMoneyByQuantity(unitAmountMinor: bigint | number, quantity: number): bigint {
  const unit = typeof unitAmountMinor === 'bigint' ? unitAmountMinor : BigInt(Math.round(unitAmountMinor));
  const qty = BigInt(Math.max(0, Math.floor(quantity)));
  return unit * qty;
}

/**
 * Applies basis points discount/fee to an integer minor amount using integer division with half-up rounding.
 * Example: 100000n (₹1,000.00) @ 1500 bps (15%) = 15000n (₹150.00).
 */
export function applyBasisPoints(amountMinor: bigint | number, bps: number): bigint {
  const amount = typeof amountMinor === 'bigint' ? amountMinor : BigInt(Math.round(amountMinor));
  const basisPoints = BigInt(Math.max(0, Math.min(10000, Math.floor(bps))));
  return (amount * basisPoints + 5000n) / 10000n;
}

/**
 * Alias for applyBasisPoints.
 */
export const multiplyMoneyBps = applyBasisPoints;

/**
 * Calculates Expected Value (EV) in integer minor units:
 * EV = (AmountMinor * RecoveryProbabilityBps) / 10000 - ChannelCostMinor
 */
export function calculateEVMinor(
  amountMinor: bigint | number,
  recoveryProbBps: number,
  channelCostMinor: bigint | number = 0n
): bigint {
  const grossEV = applyBasisPoints(amountMinor, recoveryProbBps);
  const cost = typeof channelCostMinor === 'bigint' ? channelCostMinor : BigInt(Math.round(channelCostMinor));
  return grossEV > cost ? grossEV - cost : 0n;
}

/**
 * Splits a minor unit amount into N equal parts with remainder distribution to avoid rounding leakage.
 */
export function splitMoneyMinor(amountMinor: bigint | number, parts: number): bigint[] {
  if (parts <= 0) throw new RangeError('Parts must be positive integer');
  const total = typeof amountMinor === 'bigint' ? amountMinor : BigInt(amountMinor);
  const p = BigInt(parts);
  const base = total / p;
  const remainder = total % p;

  const result: bigint[] = [];
  for (let i = 0n; i < p; i++) {
    result.push(base + (i < remainder ? 1n : 0n));
  }
  return result;
}
