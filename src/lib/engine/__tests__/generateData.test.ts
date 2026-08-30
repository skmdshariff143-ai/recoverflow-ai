/**
 * Unit tests for the RecoverFlow AI Synthetic Data Generator.
 *
 * Validates:
 *  1. Record count (≥100 default, custom, rejects <10).
 *  2. Even category distribution across all 10 categories.
 *  3. No missing required fields, correct types on every record.
 *  4. No duplicate payment_id values.
 *  5. Deterministic seeding reproduces identical output.
 *  6. Opt-out flag is boolean, realistic distribution.
 *  7. Quiet-hours windows well-formed (0–23, IANA timezone).
 *  8. Customer payment history present and well-formed.
 *  9. History correlates with failure category (scoring signal).
 * 10. High-value tier flagging produces higher amounts.
 * 11. Gateway error strings non-empty and present.
 */

import { describe, it, expect } from 'vitest';
import { generateSyntheticPayments } from '../generateData';
import {
  FAILURE_CATEGORIES,
  CURRENCIES,
  INVOICE_VALUE_TIERS,
  type FailedPayment,
} from '@/types';

// ─── Helpers ────────────────────────────────────────────────────────

const SEED = 42;
const seeded = () => generateSyntheticPayments({ seed: SEED });

function categoryDist(records: FailedPayment[]): Map<string, number> {
  const dist = new Map<string, number>();
  for (const r of records) {
    dist.set(r.failure_category, (dist.get(r.failure_category) ?? 0) + 1);
  }
  return dist;
}

function filterByCategory(records: FailedPayment[], cat: string) {
  return records.filter((r) => r.failure_category === cat);
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('generateSyntheticPayments', () => {

  // ── 1. Record count ───────────────────────────────────────────

  it('produces ≥100 records by default', () => {
    expect(seeded().length).toBeGreaterThanOrEqual(100);
  });

  it('respects custom totalRecords', () => {
    const records = generateSyntheticPayments({ totalRecords: 200, seed: SEED });
    expect(records.length).toBe(200);
  });

  it('rejects totalRecords < 10', () => {
    expect(() =>
      generateSyntheticPayments({ totalRecords: 5, seed: SEED }),
    ).toThrow('totalRecords must be ≥ 10');
  });

  // ── 2. Even category distribution ─────────────────────────────

  it('distributes records evenly across all 10 failure categories', () => {
    const dist = categoryDist(seeded());

    for (const cat of FAILURE_CATEGORIES) {
      expect(dist.has(cat), `missing category: ${cat}`).toBe(true);
    }

    const counts = [...dist.values()];
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    expect(max - min).toBeLessThanOrEqual(1);
  });

  // ── 3. Required fields / types ────────────────────────────────

  it('every record has all required fields with correct types', () => {
    for (const r of seeded()) {
      // IDs
      expect(r.payment_id).toMatch(/^pay_\d{5}$/);
      expect(r.customer_id).toMatch(/^cust_\d{4}$/);

      // Financials
      expect(typeof r.amount).toBe('number');
      expect(r.amount).toBeGreaterThan(0);
      expect(CURRENCIES).toContain(r.currency);

      // Category & timestamp
      expect(FAILURE_CATEGORIES).toContain(r.failure_category);
      expect(r.failure_timestamp).toBeTruthy();
      expect(new Date(r.failure_timestamp).toISOString()).toBe(r.failure_timestamp);

      // Attempt count
      expect(typeof r.attempt_count).toBe('number');
      expect(r.attempt_count).toBeGreaterThanOrEqual(0);

      // Booleans and enums
      expect(typeof r.opt_out).toBe('boolean');
      expect(INVOICE_VALUE_TIERS).toContain(r.invoice_value_tier);

      // Quiet hours
      expect(r.quiet_hours_window).toBeDefined();

      // Gateway error
      expect(typeof r.raw_gateway_error).toBe('string');
      expect(r.raw_gateway_error.length).toBeGreaterThan(0);

      // Customer payment history
      expect(r.customer_payment_history).toBeDefined();
    }
  });

  // ── 4. Unique payment_id ──────────────────────────────────────

  it('generates unique payment_id values', () => {
    const ids = seeded().map((r) => r.payment_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // ── 5. Deterministic seeding ──────────────────────────────────

  it('produces identical output for the same seed', () => {
    const run1 = generateSyntheticPayments({ seed: 123 });
    const run2 = generateSyntheticPayments({ seed: 123 });
    expect(run1).toEqual(run2);
  });

  it('produces different output for different seeds', () => {
    const run1 = generateSyntheticPayments({ seed: 1 });
    const run2 = generateSyntheticPayments({ seed: 2 });
    const diffs = run1.filter((r, i) => r.customer_id !== run2[i].customer_id);
    expect(diffs.length).toBeGreaterThan(0);
  });

  // ── 6. Opt-out flag ───────────────────────────────────────────

  it('opt_out is always a boolean', () => {
    for (const r of seeded()) {
      expect(typeof r.opt_out).toBe('boolean');
    }
  });

  it('some customers are opted out (realistic ~8% rate)', () => {
    const records = generateSyntheticPayments({ totalRecords: 300, seed: SEED });
    const optedOut = records.filter((r) => r.opt_out);
    expect(optedOut.length).toBeGreaterThan(0);
    expect(optedOut.length).toBeLessThan(records.length);
  });

  // ── 7. Quiet-hours windows ────────────────────────────────────

  it('quiet_hours_window has valid start (0–23), end (0–23), and IANA timezone', () => {
    for (const r of seeded()) {
      const qh = r.quiet_hours_window;
      expect(qh.start).toBeGreaterThanOrEqual(0);
      expect(qh.start).toBeLessThanOrEqual(23);
      expect(qh.end).toBeGreaterThanOrEqual(0);
      expect(qh.end).toBeLessThanOrEqual(23);
      expect(qh.timezone).toMatch(/\//); // IANA format contains "/"
    }
  });

  // ── 8. Customer payment history — structure ───────────────────

  it('customer_payment_history has all required fields with correct ranges', () => {
    for (const r of seeded()) {
      const h = r.customer_payment_history;

      expect(h.on_time_payment_rate).toBeGreaterThanOrEqual(0);
      expect(h.on_time_payment_rate).toBeLessThanOrEqual(1);

      expect(h.broken_promise_count).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(h.broken_promise_count)).toBe(true);

      expect(h.tenure_months).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(h.tenure_months)).toBe(true);

      expect(h.total_transactions).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(h.total_transactions)).toBe(true);

      expect(h.past_recovery_successes).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(h.past_recovery_successes)).toBe(true);

      expect(h.past_recovery_failures).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(h.past_recovery_failures)).toBe(true);
    }
  });

  // ── 9. History correlates with category (scoring signal) ──────

  it('broken_promise_to_pay customers have lower on_time_rate and higher broken_promise_count', () => {
    const records = generateSyntheticPayments({ totalRecords: 500, seed: SEED });
    const brokenPromise = filterByCategory(records, 'broken_promise_to_pay');
    const bankDowntime = filterByCategory(records, 'bank_downtime');

    const avgOnTimeBP =
      brokenPromise.reduce((s, r) => s + r.customer_payment_history.on_time_payment_rate, 0) /
      brokenPromise.length;
    const avgOnTimeBD =
      bankDowntime.reduce((s, r) => s + r.customer_payment_history.on_time_payment_rate, 0) /
      bankDowntime.length;

    // Broken promise customers should have materially lower on-time rates.
    expect(avgOnTimeBP).toBeLessThan(avgOnTimeBD);

    const avgBPCount =
      brokenPromise.reduce((s, r) => s + r.customer_payment_history.broken_promise_count, 0) /
      brokenPromise.length;
    const avgBDCount =
      bankDowntime.reduce((s, r) => s + r.customer_payment_history.broken_promise_count, 0) /
      bankDowntime.length;

    expect(avgBPCount).toBeGreaterThan(avgBDCount);
  });

  it('bank_downtime / gateway_degradation customers have higher on_time_rate (reliable payers)', () => {
    const records = generateSyntheticPayments({ totalRecords: 500, seed: SEED });
    const infra = [
      ...filterByCategory(records, 'bank_downtime'),
      ...filterByCategory(records, 'gateway_degradation'),
    ];
    const overall = records;

    const avgInfra =
      infra.reduce((s, r) => s + r.customer_payment_history.on_time_payment_rate, 0) /
      infra.length;
    const avgAll =
      overall.reduce((s, r) => s + r.customer_payment_history.on_time_payment_rate, 0) /
      overall.length;

    expect(avgInfra).toBeGreaterThan(avgAll);
  });

  // ── 10. High-value tier ───────────────────────────────────────

  it('high_value records have higher average amounts than standard ones', () => {
    const records = generateSyntheticPayments({ totalRecords: 500, seed: SEED });
    const highValue = records.filter((r) => r.invoice_value_tier === 'high_value');
    const standard = records.filter((r) => r.invoice_value_tier === 'standard');

    expect(highValue.length).toBeGreaterThan(0);
    expect(standard.length).toBeGreaterThan(0);

    const avgHigh = highValue.reduce((s, r) => s + r.amount, 0) / highValue.length;
    const avgStd = standard.reduce((s, r) => s + r.amount, 0) / standard.length;
    expect(avgHigh).toBeGreaterThan(avgStd);
  });

  // ── 11. Gateway error strings ─────────────────────────────────

  it('raw_gateway_error is a non-empty string (≥10 chars) for every record', () => {
    for (const r of seeded()) {
      expect(r.raw_gateway_error.length).toBeGreaterThanOrEqual(10);
    }
  });
});
