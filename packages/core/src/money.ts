/**
 * RecoverFlow AI — Standardized Financial Money Domain
 *
 * Enforces integer minor unit arithmetic (paise, cents) across the entire platform.
 * Eliminates binary floating-point rounding errors and drift.
 *
 * Invariant: 1 INR = 100 paise; 1 USD = 100 cents.
 * Basis points: 10,000 bps = 100.00% (1 bps = 0.01%).
 */

export interface MoneyAmount {
  amountMinor: bigint;
  currency: string;
}

/**
 * Parses a decimal string, number, or integer into integer minor units (BigInt).
 * Example: '1499.00' -> 149900n, 1499 -> 149900n (if decimal), or directly converts.
 */
export function parseDecimalToMinorUnits(value: string | number | bigint, _currency = 'INR'): bigint {
  if (typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Cannot convert non-finite number ${value} to minor units`);
    }
    // Convert to fixed 2 decimal places to avoid floating point representation issues
    const parts = value.toFixed(2).split('.');
    const integerPart = BigInt(parts[0]);
    const fractionalPart = BigInt(parts[1] || '0');
    return integerPart * 100n + (integerPart >= 0n ? fractionalPart : -fractionalPart);
  }

  if (typeof value === 'string') {
    const clean = value.trim().replace(/[^0-9.-]/g, '');
    if (!clean || clean === '-' || clean === '.') {
      return 0n;
    }
    const isNegative = clean.startsWith('-');
    const absStr = isNegative ? clean.slice(1) : clean;
    const parts = absStr.split('.');
    const integerPart = BigInt(parts[0] || '0');
    let fractionalStr = parts[1] || '00';
    if (fractionalStr.length === 1) fractionalStr += '0';
    if (fractionalStr.length > 2) fractionalStr = fractionalStr.slice(0, 2);
    const fractionalPart = BigInt(fractionalStr);
    const total = integerPart * 100n + fractionalPart;
    return isNegative ? -total : total;
  }

  return 0n;
}

/**
 * Formats integer minor units into standard decimal string.
 * Example: 149900n -> '1499.00'
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
 * Multiplies an integer minor amount by an integer quantity.
 */
export function multiplyMoneyByQuantity(unitAmountMinor: bigint | number, quantity: number): bigint {
  const unit = typeof unitAmountMinor === 'bigint' ? unitAmountMinor : BigInt(Math.round(unitAmountMinor));
  const qty = BigInt(Math.max(0, Math.floor(quantity)));
  return unit * qty;
}

/**
 * Applies basis points discount/fee to an integer minor amount using integer division with rounding.
 * Example: 100000n (₹1,000.00) @ 1500 bps (15%) = 15000n (₹150.00).
 */
export function applyBasisPoints(amountMinor: bigint | number, bps: number): bigint {
  const amount = typeof amountMinor === 'bigint' ? amountMinor : BigInt(Math.round(amountMinor));
  const basisPoints = BigInt(Math.max(0, Math.min(10000, Math.floor(bps))));
  // Integer arithmetic: (amount * bps + 5000n) / 10000n for half-up rounding
  return (amount * basisPoints + 5000n) / 10000n;
}

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
 * Validates whether a minor unit value is within safe integer representation for legacy float bridges.
 */
export function isSafeMinorInteger(value: bigint | number): boolean {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value);
  }
  return value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER);
}

/**
 * Converts BigInt minor units to number safely (throws if out of range).
 */
export function minorUnitsToSafeNumber(value: bigint | number): number {
  if (typeof value === 'number') return value;
  if (!isSafeMinorInteger(value)) {
    throw new RangeError(`BigInt value ${value} exceeds Number.MAX_SAFE_INTEGER`);
  }
  return Number(value);
}
