/**
 * Unit tests for the PayBack AI Scoring Engine.
 *
 * Tests:
 *   1.  Score always in [0, 1].
 *   2.  expected_value = recovery_probability × amount (exact).
 *   3.  Permanent failures score near 0.
 *   4.  High on-time rate scores higher than low (isolated variable).
 *   5.  High broken_promise_count lowers score.
 *   6.  Category base rates reflected (bank_downtime > broken_promise).
 *   7.  Recency: recent failures score higher than old ones.
 *   8.  Prior attempts lower score.
 *   9.  Tenure: longer tenure slightly higher.
 *  10.  Explanation: ≥1 factor, sorted by |contribution|, references input.
 *  11.  Full 100-record fixture: no crashes, all well-formed, category stats.
 *  12.  Determinism: same input → same output.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  scorePayment,
  scorePaymentBatch,
  CATEGORY_BASE_RATES,
} from '../scoreRecovery';
import { calculateExpectedValuePaise, probabilityToBps } from '../financial';
import type { FailedPayment, FailureCategory } from '@/types';

// ─── Test Fixture Builder ───────────────────────────────────────────

/** Build a FailedPayment with sensible defaults, override any field. */
function makePayment(overrides: Partial<FailedPayment> = {}): FailedPayment {
  return {
    payment_id: 'pay_test',
    customer_id: 'cust_test',
    amount: 100_000, // ₹1,000
    currency: 'INR',
    failure_category: 'bank_downtime',
    failure_timestamp: '2025-08-25T00:00:00.000Z', // 5 days before reference
    attempt_count: 0,
    opt_out: false,
    quiet_hours_window: { start: 22, end: 6, timezone: 'Asia/Kolkata' },
    invoice_value_tier: 'standard',
    raw_gateway_error: 'E_BANK_TIMEOUT: bank not responding',
    customer_payment_history: {
      on_time_payment_rate: 0.80,
      broken_promise_count: 0,
      tenure_months: 24,
      total_transactions: 50,
      past_recovery_successes: 5,
      past_recovery_failures: 2,
    },
    ...overrides,
  };
}

/** Override only customer_payment_history fields. */
function withHistory(
  base: FailedPayment,
  historyOverrides: Partial<FailedPayment['customer_payment_history']>,
): FailedPayment {
  return {
    ...base,
    customer_payment_history: {
      ...base.customer_payment_history,
      ...historyOverrides,
    },
  };
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('scorePayment', () => {

  // ── 1. Score bounds ─────────────────────────────────────────────

  it('recovery_probability is always in [0, 1]', () => {
    // Test extreme inputs.
    const bestCase = makePayment({
      failure_category: 'duplicate_attempt',
      attempt_count: 0,
      failure_timestamp: '2025-08-30T00:00:00.000Z', // same as reference
    });
    const worstCase = makePayment({
      failure_category: 'permanent_account_closure',
      attempt_count: 3,
      failure_timestamp: '2025-07-01T00:00:00.000Z', // 60 days old
    });
    const worstWithHistory = withHistory(worstCase, {
      on_time_payment_rate: 0.0,
      broken_promise_count: 10,
    });

    for (const p of [bestCase, worstWithHistory]) {
      const score = scorePayment(p);
      expect(score.recovery_probability).toBeGreaterThanOrEqual(0);
      expect(score.recovery_probability).toBeLessThanOrEqual(1);
    }
  });

  // ── 2. Expected value = probability × amount ───────────────────

  it('expected_value equals recovery_probability × amount in integer paise', () => {
    const amounts = [100, 50_000, 500_000, 5_000_000];
    for (const amount of amounts) {
      const payment = makePayment({ amount });
      const score = scorePayment(payment);
      const computed = calculateExpectedValuePaise(amount, probabilityToBps(score.recovery_probability));
      expect(score.expected_value).toBe(computed);
      expect(Number.isInteger(score.expected_value)).toBe(true);
    }
  });

  // ── 3. Permanent failures score near 0 ─────────────────────────

  it('permanent_account_closure scores very low (< 0.15)', () => {
    const payment = makePayment({ failure_category: 'permanent_account_closure' });
    const score = scorePayment(payment);
    expect(score.recovery_probability).toBeLessThan(0.15);
  });

  it('customer_cancellation scores very low (< 0.20)', () => {
    const payment = makePayment({ failure_category: 'customer_cancellation' });
    const score = scorePayment(payment);
    expect(score.recovery_probability).toBeLessThan(0.20);
  });

  // ── 4. On-time rate isolation ──────────────────────────────────

  it('higher on_time_rate produces higher score (all else equal)', () => {
    const base = makePayment();
    const highReliability = withHistory(base, { on_time_payment_rate: 0.95 });
    const lowReliability = withHistory(base, { on_time_payment_rate: 0.20 });

    const scoreHigh = scorePayment(highReliability);
    const scoreLow = scorePayment(lowReliability);

    expect(scoreHigh.recovery_probability).toBeGreaterThan(
      scoreLow.recovery_probability,
    );
    // Difference should be meaningful, not just rounding.
    expect(
      scoreHigh.recovery_probability - scoreLow.recovery_probability,
    ).toBeGreaterThan(0.10);
  });

  // ── 5. Broken promise penalty ──────────────────────────────────

  it('higher broken_promise_count meaningfully lowers score', () => {
    const base = makePayment();
    const noBroken = withHistory(base, { broken_promise_count: 0 });
    const manyBroken = withHistory(base, { broken_promise_count: 4 });

    const scoreClean = scorePayment(noBroken);
    const scoreBroken = scorePayment(manyBroken);

    expect(scoreClean.recovery_probability).toBeGreaterThan(
      scoreBroken.recovery_probability,
    );
    expect(
      scoreClean.recovery_probability - scoreBroken.recovery_probability,
    ).toBeGreaterThan(0.05);
  });

  // ── 6. Category base rates ─────────────────────────────────────

  it('bank_downtime scores higher than broken_promise_to_pay (same customer)', () => {
    const bankDown = makePayment({ failure_category: 'bank_downtime' });
    const brokenPromise = makePayment({ failure_category: 'broken_promise_to_pay' });

    const s1 = scorePayment(bankDown);
    const s2 = scorePayment(brokenPromise);

    expect(s1.recovery_probability).toBeGreaterThan(s2.recovery_probability);
  });

  it('duplicate_attempt scores highest among all categories', () => {
    const categories: FailureCategory[] = [
      'bank_downtime', 'gateway_degradation', 'auth_failure',
      'expired_card', 'insufficient_funds', 'invalid_mandate',
      'broken_promise_to_pay', 'customer_cancellation',
      'permanent_account_closure',
    ];

    const dupScore = scorePayment(
      makePayment({ failure_category: 'duplicate_attempt' }),
    ).recovery_probability;

    for (const cat of categories) {
      const catScore = scorePayment(
        makePayment({ failure_category: cat }),
      ).recovery_probability;
      expect(dupScore).toBeGreaterThanOrEqual(catScore);
    }
  });

  it('category ordering matches base rate ordering', () => {
    const sorted = Object.entries(CATEGORY_BASE_RATES)
      .sort(([, a], [, b]) => b - a)
      .map(([cat]) => cat as FailureCategory);

    const scores = sorted.map((cat) =>
      scorePayment(makePayment({ failure_category: cat })).recovery_probability,
    );

    // Each category should score ≥ the next (may tie for close base rates).
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
    }
  });

  // ── 7. Recency ─────────────────────────────────────────────────

  it('recent failures score higher than old ones', () => {
    const recent = makePayment({
      failure_timestamp: '2025-08-28T00:00:00.000Z', // 2 days ago
    });
    const old = makePayment({
      failure_timestamp: '2025-08-01T00:00:00.000Z', // 29 days ago
    });

    const sRecent = scorePayment(recent);
    const sOld = scorePayment(old);

    expect(sRecent.recovery_probability).toBeGreaterThan(sOld.recovery_probability);
  });

  // ── 8. Prior attempts penalty ──────────────────────────────────

  it('more prior attempts lowers score', () => {
    const noAttempts = makePayment({ attempt_count: 0 });
    const twoAttempts = makePayment({ attempt_count: 2 });

    const s0 = scorePayment(noAttempts);
    const s2 = scorePayment(twoAttempts);

    expect(s0.recovery_probability).toBeGreaterThan(s2.recovery_probability);
    expect(
      s0.recovery_probability - s2.recovery_probability,
    ).toBeGreaterThan(0.05);
  });

  // ── 9. Tenure bonus ────────────────────────────────────────────

  it('longer tenure gives slightly higher score', () => {
    const newCustomer = withHistory(makePayment(), { tenure_months: 1 });
    const loyalCustomer = withHistory(makePayment(), { tenure_months: 48 });

    const sNew = scorePayment(newCustomer);
    const sLoyal = scorePayment(loyalCustomer);

    expect(sLoyal.recovery_probability).toBeGreaterThan(sNew.recovery_probability);
  });

  // ── 10. Explanation quality ────────────────────────────────────

  it('explanation has ≥ 1 factor', () => {
    const score = scorePayment(makePayment());
    expect(score.explanation.length).toBeGreaterThanOrEqual(1);
  });

  it('explanation has exactly 6 factors (all tracked)', () => {
    const score = scorePayment(makePayment());
    expect(score.explanation).toHaveLength(6);
  });

  it('explanation factors are sorted by |contribution| descending', () => {
    const score = scorePayment(makePayment());
    for (let i = 0; i < score.explanation.length - 1; i++) {
      expect(Math.abs(score.explanation[i].contribution)).toBeGreaterThanOrEqual(
        Math.abs(score.explanation[i + 1].contribution),
      );
    }
  });

  it('explanation references actual input values (not hardcoded strings)', () => {
    const payment = makePayment({
      failure_category: 'insufficient_funds',
    });
    const score = scorePayment(payment);

    // The category base rate explanation should reference the actual category.
    const baseFactor = score.explanation.find(
      (f) => f.factor === 'category_base_rate',
    );
    expect(baseFactor).toBeDefined();
    expect(baseFactor!.detail).toContain('insufficient_funds');

    // The reliability factor should reference the on-time rate.
    const reliabilityFactor = score.explanation.find(
      (f) => f.factor === 'customer_reliability',
    );
    expect(reliabilityFactor).toBeDefined();
    expect(reliabilityFactor!.detail).toContain('80%'); // 0.80 → 80%
  });

  it('explanation for broken promises references the actual count', () => {
    const payment = withHistory(makePayment(), { broken_promise_count: 3 });
    const score = scorePayment(payment);

    const promiseFactor = score.explanation.find(
      (f) => f.factor === 'broken_promises',
    );
    expect(promiseFactor).toBeDefined();
    expect(promiseFactor!.detail).toContain('3');
    expect(promiseFactor!.contribution).toBeLessThan(0);
  });

  // ── 11. Full fixture: 100-record batch ─────────────────────────

  it('scores all 100 fixture records without crashes, all outputs well-formed', () => {
    const fixturePath = resolve(import.meta.dirname, '../../../../data/synthetic-payments.json');
    const raw = readFileSync(fixturePath, 'utf-8');
    const payments: FailedPayment[] = JSON.parse(raw);

    expect(payments.length).toBeGreaterThanOrEqual(100);

    const scores = scorePaymentBatch(payments);

    expect(scores).toHaveLength(payments.length);

    for (const s of scores) {
      // Probability in [0, 1].
      expect(s.recovery_probability).toBeGreaterThanOrEqual(0);
      expect(s.recovery_probability).toBeLessThanOrEqual(1);

      // Expected value = probability × amount in integer paise.
      const payment = payments.find((p) => p.payment_id === s.payment_id)!;
      const computed = calculateExpectedValuePaise(payment.amount, probabilityToBps(s.recovery_probability));
      expect(s.expected_value).toBe(computed);
      expect(Number.isInteger(s.expected_value)).toBe(true);

      // Explanation present.
      expect(s.explanation.length).toBeGreaterThanOrEqual(1);

      // payment_id matches.
      expect(s.payment_id).toBe(payment.payment_id);
    }
  });

  it('category averages show meaningful differentiation (sanity check)', () => {
    const fixturePath = resolve(import.meta.dirname, '../../../../data/synthetic-payments.json');
    const raw = readFileSync(fixturePath, 'utf-8');
    const payments: FailedPayment[] = JSON.parse(raw);
    const scores = scorePaymentBatch(payments);

    // Compute average probability per category.
    const catSums = new Map<string, { total: number; count: number }>();
    for (let i = 0; i < payments.length; i++) {
      const cat = payments[i].failure_category;
      const entry = catSums.get(cat) ?? { total: 0, count: 0 };
      entry.total += scores[i].recovery_probability;
      entry.count += 1;
      catSums.set(cat, entry);
    }

    const catAvgs = new Map<string, number>();
    for (const [cat, { total, count }] of catSums) {
      catAvgs.set(cat, Math.round((total / count) * 1000) / 1000);
    }

    // Log the table for the milestone report.
    console.log('\n┌─────────────────────────────────────────────────────┐');
    console.log('│  Category Avg Recovery Probability (100-record run) │');
    console.log('├──────────────────────────────┬──────────────────────┤');
    const sorted = [...catAvgs.entries()].sort(([, a], [, b]) => b - a);
    for (const [cat, avg] of sorted) {
      console.log(`│  ${cat.padEnd(28)} │  ${avg.toFixed(3).padStart(18)}  │`);
    }
    console.log('└──────────────────────────────┴──────────────────────┘');

    // Structural assertions: infra categories > permanent closures.
    expect(catAvgs.get('bank_downtime')!).toBeGreaterThan(
      catAvgs.get('permanent_account_closure')!,
    );
    expect(catAvgs.get('duplicate_attempt')!).toBeGreaterThan(
      catAvgs.get('broken_promise_to_pay')!,
    );
    // All categories present.
    expect(catAvgs.size).toBe(10);
  });

  // ── 12. Determinism ────────────────────────────────────────────

  it('same input produces identical output', () => {
    const payment = makePayment();
    const s1 = scorePayment(payment);
    const s2 = scorePayment(payment);
    expect(s1).toEqual(s2);
  });
});

describe('scorePaymentBatch', () => {
  it('returns one score per input payment', () => {
    const payments = [
      makePayment({ payment_id: 'pay_001' }),
      makePayment({ payment_id: 'pay_002' }),
      makePayment({ payment_id: 'pay_003' }),
    ];
    const scores = scorePaymentBatch(payments);
    expect(scores).toHaveLength(3);
    expect(scores.map((s) => s.payment_id)).toEqual(['pay_001', 'pay_002', 'pay_003']);
  });
});
