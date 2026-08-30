/**
 * Unit tests for the PayBack AI Safety Filter.
 *
 * Validates non-negotiable safety rules:
 *  1. Opted-out customers are NEVER eligible under any circumstance.
 *  2. Permanent/cancellation failure categories are NEVER eligible.
 *  3. Payments at or exceeding MAX_RECOVERY_ATTEMPTS (3) are NEVER eligible.
 *  4. Ineligible payments always include a descriptive audit reason and detail.
 *  5. Eligible payments pass through cleanly.
 */

import { describe, it, expect } from 'vitest';
import {
  checkSafetyRules,
  NON_RECOVERABLE_CATEGORIES,
} from '../safetyFilter';
import { FAILURE_CATEGORIES, type FailedPayment, type FailureCategory } from '@/types';

function createMockPayment(overrides: Partial<FailedPayment> = {}): FailedPayment {
  return {
    payment_id: 'pay_safety_test',
    customer_id: 'cust_safety_test',
    amount: 100_000,
    currency: 'INR',
    failure_category: 'insufficient_funds',
    failure_timestamp: '2025-08-25T10:00:00Z',
    attempt_count: 0,
    opt_out: false,
    quiet_hours_window: { start: 22, end: 7, timezone: 'Asia/Kolkata' },
    invoice_value_tier: 'standard',
    raw_gateway_error: 'E_INSF: insufficient funds',
    customer_payment_history: {
      on_time_payment_rate: 0.90,
      broken_promise_count: 0,
      tenure_months: 24,
      total_transactions: 50,
      past_recovery_successes: 5,
      past_recovery_failures: 1,
    },
    ...overrides,
  };
}

describe('checkSafetyRules', () => {

  // ── 1. Opt-out safety rule ─────────────────────────────────────

  it('opt_out = true is NEVER eligible, across ALL 10 failure categories (property test)', () => {
    for (const category of FAILURE_CATEGORIES) {
      for (const attempts of [0, 1, 2, 3, 5]) {
        const payment = createMockPayment({
          failure_category: category,
          attempt_count: attempts,
          opt_out: true,
        });

        const result = checkSafetyRules(payment);
        expect(result.eligible).toBe(false);
        expect(result.stop_reason).toBe('customer_opted_out');
        expect(result.stop_detail).toContain('opted out');
      }
    }
  });

  // ── 2. Non-recoverable categories ──────────────────────────────

  it('permanent_account_closure is NEVER eligible, even for perfect customers with 0 attempts', () => {
    const payment = createMockPayment({
      failure_category: 'permanent_account_closure',
      attempt_count: 0,
      opt_out: false,
    });

    const result = checkSafetyRules(payment);
    expect(result.eligible).toBe(false);
    expect(result.stop_reason).toBe('non_recoverable_category');
    expect(result.stop_detail).toContain('permanent_account_closure');
  });

  it('customer_cancellation is NEVER eligible, even for high-value invoices with 0 attempts', () => {
    const payment = createMockPayment({
      failure_category: 'customer_cancellation',
      invoice_value_tier: 'high_value',
      amount: 5_000_000,
      attempt_count: 0,
      opt_out: false,
    });

    const result = checkSafetyRules(payment);
    expect(result.eligible).toBe(false);
    expect(result.stop_reason).toBe('non_recoverable_category');
    expect(result.stop_detail).toContain('customer_cancellation');
  });

  it('all non-recoverable categories in set match definition', () => {
    expect(NON_RECOVERABLE_CATEGORIES.has('permanent_account_closure')).toBe(true);
    expect(NON_RECOVERABLE_CATEGORIES.has('customer_cancellation')).toBe(true);
    expect(NON_RECOVERABLE_CATEGORIES.size).toBe(2);
  });

  // ── 3. Hard attempt cap ────────────────────────────────────────

  it('attempt_count >= MAX_RECOVERY_ATTEMPTS (3) is NEVER eligible', () => {
    for (const attempts of [3, 4, 10]) {
      const payment = createMockPayment({
        failure_category: 'bank_downtime',
        attempt_count: attempts,
        opt_out: false,
      });

      const result = checkSafetyRules(payment);
      expect(result.eligible).toBe(false);
      expect(result.stop_reason).toBe('max_attempts_exceeded');
      expect(result.stop_detail).toContain('hard recovery attempt cap');
    }
  });

  it('attempt_count < MAX_RECOVERY_ATTEMPTS (0, 1, 2) is eligible for recoverable categories', () => {
    const recoverableCategories: FailureCategory[] = [
      'bank_downtime',
      'gateway_degradation',
      'duplicate_attempt',
      'auth_failure',
      'expired_card',
      'insufficient_funds',
      'invalid_mandate',
      'broken_promise_to_pay',
    ];

    for (const category of recoverableCategories) {
      for (const attempts of [0, 1, 2]) {
        const payment = createMockPayment({
          failure_category: category,
          attempt_count: attempts,
          opt_out: false,
        });

        const result = checkSafetyRules(payment);
        expect(result.eligible).toBe(true);
        expect(result.stop_reason).toBeUndefined();
      }
    }
  });

  // ── 4. Rule precedence ─────────────────────────────────────────

  it('opt_out takes precedence over category and attempt count', () => {
    const payment = createMockPayment({
      failure_category: 'permanent_account_closure',
      attempt_count: 5,
      opt_out: true,
    });

    const result = checkSafetyRules(payment);
    // Should be stopped for opt_out first
    expect(result.stop_reason).toBe('customer_opted_out');
  });
});
