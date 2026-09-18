import { describe, it, expect } from 'vitest';
import {
  parseDecimalToMinorUnits,
  formatMinorUnits,
  toSafeInteger,
  isSafeMinorInteger,
  addMoney,
  subtractMoney,
  applyBasisPoints,
  splitMoneyMinor,
  calculateEVMinor,
  serializeMoneyTransport,
} from '../../packages/core/src/money';

describe('RecoverFlow AI — Money Precision & Minor Units Regression Suite', () => {
  describe('Exact Decimal to Minor Units Conversions', () => {
    const cases: Array<{ input: string | number; expectedMinor: bigint; formatted: string }> = [
      { input: '0.01', expectedMinor: 1n, formatted: '0.01' },
      { input: '0.10', expectedMinor: 10n, formatted: '0.10' },
      { input: '1.99', expectedMinor: 199n, formatted: '1.99' },
      { input: '10.05', expectedMinor: 1005n, formatted: '10.05' },
      { input: '999.99', expectedMinor: 99999n, formatted: '999.99' },
      { input: '1299.00', expectedMinor: 129900n, formatted: '1299.00' },
      { input: '999999.99', expectedMinor: 99999999n, formatted: '999999.99' },
    ];

    cases.forEach(({ input, expectedMinor, formatted }) => {
      it(`accurately converts "${input}" -> ${expectedMinor}n and formats back to "${formatted}" without float drift`, () => {
        const parsed = parseDecimalToMinorUnits(input);
        expect(parsed).toBe(expectedMinor);

        const rendered = formatMinorUnits(parsed);
        expect(rendered).toBe(formatted);
      });
    });

    it('handles numeric float inputs with deterministic parsing', () => {
      expect(parseDecimalToMinorUnits(1499.99)).toBe(149999n);
      expect(parseDecimalToMinorUnits(0.01)).toBe(1n);
      expect(parseDecimalToMinorUnits(0)).toBe(0n);
    });

    it('handles BigInt inputs as identity', () => {
      expect(parseDecimalToMinorUnits(50000n)).toBe(50000n);
    });

    it('handles formatted currency strings with symbols and commas', () => {
      expect(parseDecimalToMinorUnits('₹1,499.00')).toBe(149900n);
      expect(parseDecimalToMinorUnits('$999.99')).toBe(99999n);
    });
  });

  describe('Safe BigInt Boundary Enforcement (toSafeInteger)', () => {
    it('allows safe integers within Number.MAX_SAFE_INTEGER', () => {
      expect(toSafeInteger(149900n)).toBe(149900);
      expect(toSafeInteger(BigInt(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
      expect(toSafeInteger(BigInt(Number.MIN_SAFE_INTEGER))).toBe(Number.MIN_SAFE_INTEGER);
    });

    it('throws RangeError when BigInt exceeds Number.MAX_SAFE_INTEGER', () => {
      const unsafeValue = BigInt(Number.MAX_SAFE_INTEGER) + 100n;
      expect(isSafeMinorInteger(unsafeValue)).toBe(false);
      expect(() => toSafeInteger(unsafeValue)).toThrow(RangeError);
    });

    it('throws RangeError when BigInt is smaller than Number.MIN_SAFE_INTEGER', () => {
      const unsafeValue = BigInt(Number.MIN_SAFE_INTEGER) - 100n;
      expect(isSafeMinorInteger(unsafeValue)).toBe(false);
      expect(() => toSafeInteger(unsafeValue)).toThrow(RangeError);
    });
  });

  describe('Financial Arithmetic & Basis Points', () => {
    it('adds and subtracts without floating point leakage', () => {
      const sum = addMoney(149900n, 50100n);
      expect(sum).toBe(200000n);

      const diff = subtractMoney(200000n, 1n);
      expect(diff).toBe(199999n);
    });

    it('calculates exact basis point percentages with deterministic rounding', () => {
      // 15% discount on ₹1,000.00 (100,000 paise) = 15,000 paise
      expect(applyBasisPoints(100000n, 1500)).toBe(15000n);
      // 100% of ₹500.00
      expect(applyBasisPoints(50000n, 10000)).toBe(50000n);
      // 0% of ₹500.00
      expect(applyBasisPoints(50000n, 0)).toBe(0n);
    });

    it('splits minor amounts across parts with remainder conservation', () => {
      // Split ₹100.01 (10001 paise) across 3 accounts -> 3334, 3334, 3333 = sum 10001
      const parts = splitMoneyMinor(10001n, 3);
      expect(parts).toHaveLength(3);
      expect(parts[0] + parts[1] + parts[2]).toBe(10001n);
      expect(parts).toEqual([3334n, 3334n, 3333n]);
    });

    it('computes Expected Value in minor units accurately', () => {
      // ₹1,000.00 with 60.00% probability (6000 bps) minus ₹5.00 cost (500 paise)
      // EV = (100000 * 6000) / 10000 - 500 = 60000 - 500 = 59500 paise (₹595.00)
      const ev = calculateEVMinor(100000n, 6000, 500n);
      expect(ev).toBe(59500n);
    });

    it('serializes standard money transport object', () => {
      const transport = serializeMoneyTransport(149900n, 'INR');
      expect(transport).toEqual({
        amountMinor: '149900',
        currency: 'INR',
        formatted: '1499.00',
      });
    });
  });
});
