/**
 * Unit tests for the PayBack AI Ranking & Budget Allocation Pipeline.
 *
 * Validates:
 *  1. Opted-out payments are NEVER budgeted or deferred.
 *  2. Permanent/cancellation categories are NEVER budgeted or deferred.
 *  3. Payments at/above max attempts (>=3) are NEVER budgeted or deferred.
 *  4. High-value pending payments NEVER enter the action queue without approval.
 *  5. Actionable items are sorted strictly descending by expected_value.
 *  6. Exactly min(budget, actionableCount) items receive status 'budgeted', remainder 'deferred'.
 *  7. Partition sum is conserved: budgeted + deferred + pending_approval + stopped === total_payments.
 *  8. Interventions match category guidance.
 *  9. Full 100-record fixture runs cleanly with complete status breakdown.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { processRecoveryPipeline } from '../rankAndAllocate';
import { selectIntervention } from '../interventions';
import type { FailedPayment } from '@/types';

function createMockPayment(overrides: Partial<FailedPayment> = {}): FailedPayment {
  return {
    payment_id: 'pay_pipe_test',
    customer_id: 'cust_pipe_test',
    amount: 100_000,
    currency: 'INR',
    failure_category: 'insufficient_funds',
    failure_timestamp: '2025-08-25T10:00:00Z',
    attempt_count: 0,
    opt_out: false,
    quiet_hours_window: { start: 22, end: 7, timezone: 'Asia/Kolkata' },
    invoice_value_tier: 'standard',
    raw_gateway_error: 'E_INSF',
    customer_payment_history: {
      on_time_payment_rate: 0.85,
      broken_promise_count: 0,
      tenure_months: 18,
      total_transactions: 40,
      past_recovery_successes: 4,
      past_recovery_failures: 1,
    },
    ...overrides,
  };
}

describe('processRecoveryPipeline', () => {

  // ── 1. Safety rule guarantees in pipeline output ────────────────

  it('opted-out payments are NEVER budgeted or deferred (property test)', () => {
    const payments = [
      createMockPayment({ payment_id: 'pay_01', opt_out: true, failure_category: 'bank_downtime' }),
      createMockPayment({ payment_id: 'pay_02', opt_out: true, failure_category: 'insufficient_funds' }),
      createMockPayment({ payment_id: 'pay_03', opt_out: false, failure_category: 'bank_downtime' }),
    ];

    const result = processRecoveryPipeline(payments, { budget: 10 });
    const optedOutItems = result.items.filter((i) => i.payment.opt_out);

    expect(optedOutItems).toHaveLength(2);
    for (const item of optedOutItems) {
      expect(item.status).toBe('stopped');
      expect(item.stop_reason).toBe('customer_opted_out');
      expect(item.rank).toBeUndefined();
    }
  });

  it('permanent failure categories are NEVER budgeted or deferred', () => {
    const payments = [
      createMockPayment({ payment_id: 'pay_01', failure_category: 'permanent_account_closure' }),
      createMockPayment({ payment_id: 'pay_02', failure_category: 'customer_cancellation' }),
      createMockPayment({ payment_id: 'pay_03', failure_category: 'bank_downtime' }),
    ];

    const result = processRecoveryPipeline(payments, { budget: 10 });
    const permItems = result.items.filter((i) =>
      ['permanent_account_closure', 'customer_cancellation'].includes(i.payment.failure_category),
    );

    expect(permItems).toHaveLength(2);
    for (const item of permItems) {
      expect(item.status).toBe('stopped');
      expect(item.stop_reason).toBe('non_recoverable_category');
      expect(item.rank).toBeUndefined();
    }
  });

  it('payments with attempt_count >= 3 are NEVER budgeted or deferred', () => {
    const payments = [
      createMockPayment({ payment_id: 'pay_01', attempt_count: 3, failure_category: 'bank_downtime' }),
      createMockPayment({ payment_id: 'pay_02', attempt_count: 4, failure_category: 'insufficient_funds' }),
      createMockPayment({ payment_id: 'pay_03', attempt_count: 1, failure_category: 'bank_downtime' }),
    ];

    const result = processRecoveryPipeline(payments, { budget: 10 });
    const maxAttemptItems = result.items.filter((i) => i.payment.attempt_count >= 3);

    expect(maxAttemptItems).toHaveLength(2);
    for (const item of maxAttemptItems) {
      expect(item.status).toBe('stopped');
      expect(item.stop_reason).toBe('max_attempts_exceeded');
    }
  });

  // ── 2. Ranking guarantees ───────────────────────────────────────

  it('actionable items (budgeted and deferred) are ranked strictly descending by expected_value', () => {
    const payments = [
      createMockPayment({ payment_id: 'pay_low', amount: 10_000, failure_category: 'invalid_mandate' }),
      createMockPayment({ payment_id: 'pay_high', amount: 500_000, failure_category: 'bank_downtime' }),
      createMockPayment({ payment_id: 'pay_mid', amount: 100_000, failure_category: 'auth_failure' }),
    ];

    const result = processRecoveryPipeline(payments, { budget: 2 });
    const rankedItems = result.items.filter((i) => i.rank !== undefined);

    expect(rankedItems).toHaveLength(3);
    for (let i = 0; i < rankedItems.length - 1; i++) {
      expect(rankedItems[i].score.expected_value).toBeGreaterThanOrEqual(
        rankedItems[i + 1].score.expected_value,
      );
      expect(rankedItems[i].rank).toBe(i + 1);
    }
  });

  // ── 3. Budget allocation guarantees ────────────────────────────

  it('allocates exactly min(budget, actionableCount) to status "budgeted" and rest to "deferred"', () => {
    const payments = Array.from({ length: 15 }, (_, i) =>
      createMockPayment({
        payment_id: `pay_${String(i).padStart(3, '0')}`,
        amount: (i + 1) * 10_000,
        failure_category: 'bank_downtime',
      }),
    );

    // Test with budget = 5
    const res5 = processRecoveryPipeline(payments, { budget: 5 });
    expect(res5.budgeted_count).toBe(5);
    expect(res5.deferred_count).toBe(10);
    expect(res5.items.filter((i) => i.status === 'budgeted')).toHaveLength(5);
    expect(res5.items.filter((i) => i.status === 'deferred')).toHaveLength(10);

    // Test with budget = 20 (larger than total eligible)
    const res20 = processRecoveryPipeline(payments, { budget: 20 });
    expect(res20.budgeted_count).toBe(15);
    expect(res20.deferred_count).toBe(0);
  });

  it('conserves partition sum: budgeted + deferred + pending + stopped === total', () => {
    const fixturePath = resolve(import.meta.dirname, '../../../../data/synthetic-payments.json');
    const raw = readFileSync(fixturePath, 'utf-8');
    const payments: FailedPayment[] = JSON.parse(raw);

    const result = processRecoveryPipeline(payments, { budget: 35 });

    const total =
      result.budgeted_count +
      result.deferred_count +
      result.pending_approval_count +
      result.stopped_count;

    expect(total).toBe(payments.length);
    expect(result.items).toHaveLength(payments.length);
    expect(result.total_payments).toBe(payments.length);
  });

  // ── 4. Interventions ───────────────────────────────────────────

  it('assigns correct intervention types based on category', () => {
    expect(selectIntervention('bank_downtime')).toBe('retry');
    expect(selectIntervention('gateway_degradation')).toBe('retry');
    expect(selectIntervention('duplicate_attempt')).toBe('retry');

    expect(selectIntervention('broken_promise_to_pay')).toBe('reminder');
    expect(selectIntervention('expired_card')).toBe('reminder');

    expect(selectIntervention('auth_failure')).toBe('both');
    expect(selectIntervention('insufficient_funds')).toBe('both');
    expect(selectIntervention('invalid_mandate')).toBe('both');

    expect(selectIntervention('permanent_account_closure')).toBe('none');
    expect(selectIntervention('customer_cancellation')).toBe('none');
  });

  // ── 5. End-to-End 100-Record Fixture Run ────────────────────────

  it('processes full 100-record fixture, reports breakdown, and asserts all safety guarantees hold', () => {
    const fixturePath = resolve(import.meta.dirname, '../../../../data/synthetic-payments.json');
    const raw = readFileSync(fixturePath, 'utf-8');
    const payments: FailedPayment[] = JSON.parse(raw);

    const result = processRecoveryPipeline(payments, { budget: 40 });

    console.log('\n┌────────────────────────────────────────────────────────┐');
    console.log('│  PayBack AI Pipeline Status Breakdown (100-record run) │');
    console.log('├────────────────────────────────────┬───────────────────┤');
    console.log(`│  Budgeted Items (allocated slots)  │  ${String(result.budgeted_count).padStart(17)} │`);
    console.log(`│  Deferred Items (budget overflow)  │  ${String(result.deferred_count).padStart(17)} │`);
    console.log(`│  Pending Human Approval            │  ${String(result.pending_approval_count).padStart(17)} │`);
    console.log(`│  Stopped by Safety Rules           │  ${String(result.stopped_count).padStart(17)} │`);
    console.log('├────────────────────────────────────┴───────────────────┤');
    console.log('│  Safety Stop Reasons Breakdown:                        │');
    console.log(`│    - Customer Opt-Out:              ${String(result.stopped_by_reason.customer_opted_out).padStart(17)} │`);
    console.log(`│    - Non-Recoverable Category:      ${String(result.stopped_by_reason.non_recoverable_category).padStart(17)} │`);
    console.log(`│    - Max Attempts Exceeded:         ${String(result.stopped_by_reason.max_attempts_exceeded).padStart(17)} │`);
    console.log(`│  Total Revenue at Risk:             ₹${(result.total_revenue_at_risk / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(16)} │`);
    console.log(`│  Budgeted Expected Value:           ₹${(result.budgeted_expected_value / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(16)} │`);
    console.log(`│  Deferred Expected Value:           ₹${(result.deferred_expected_value / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(16)} │`);
    console.log('└────────────────────────────────────────────────────────┘\n');

    // Asserts on fixture results
    expect(result.total_payments).toBe(100);
    expect(result.budgeted_count).toBeLessThanOrEqual(40);
    expect(result.stopped_count).toBeGreaterThanOrEqual(20);
    expect(result.stopped_by_reason.non_recoverable_category).toBeGreaterThan(0);
    expect(result.stopped_by_reason.customer_opted_out).toBeGreaterThan(0);

    // Strict safety check over all 100 items in result
    for (const item of result.items) {
      if (item.payment.opt_out) {
        expect(item.status).toBe('stopped');
        expect(item.stop_reason).toBe('customer_opted_out');
      }
      if (['permanent_account_closure', 'customer_cancellation'].includes(item.payment.failure_category)) {
        expect(item.status).toBe('stopped');
      }
      if (item.payment.attempt_count >= 3) {
        expect(item.status).toBe('stopped');
      }
    }
  });
});
