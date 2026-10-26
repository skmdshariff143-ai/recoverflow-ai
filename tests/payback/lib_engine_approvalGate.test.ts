/**
 * Unit tests for the PayBack AI High-Value Approval Gate.
 *
 * Validates:
 *  1. Standard-value invoices never require manual approval.
 *  2. High-value invoices with low expected value remain in 'pending' status.
 *  3. High-value invoices with high expected value (>= ₹5,000) are conditionally auto-approved in simulation (DEMO/TEST only).
 *  4. Strict policy (simulateAutoApproval: false) requires manual sign-off on all high-value items.
 *  5. SANDBOX and LIVE modes fail closed to manual review (auto-approval completely blocked).
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateApprovalStatus,
  HIGH_VALUE_AUTO_APPROVE_EV_THRESHOLD_PAISE,
} from '@recoverflow/core';
import type { FailedPayment } from '@recoverflow/core';
import type { PaymentScore } from '@recoverflow/core';

function makeMockPayment(tier: 'standard' | 'high_value', amount: number): FailedPayment {
  return {
    payment_id: 'pay_approval_test',
    customer_id: 'cust_001',
    amount,
    currency: 'INR',
    failure_category: 'insufficient_funds',
    failure_timestamp: '2025-08-25T10:00:00Z',
    attempt_count: 0,
    opt_out: false,
    quiet_hours_window: { start: 22, end: 7, timezone: 'Asia/Kolkata' },
    invoice_value_tier: tier,
    raw_gateway_error: 'E_INSF',
    customer_payment_history: {
      on_time_payment_rate: 0.85,
      broken_promise_count: 0,
      tenure_months: 12,
      total_transactions: 30,
      past_recovery_successes: 3,
      past_recovery_failures: 1,
    },
  };
}

function makeMockScore(expectedValue: number): PaymentScore {
  return {
    payment_id: 'pay_approval_test',
    recovery_probability: 0.5,
    expected_value: expectedValue,
    explanation: [],
  };
}

describe('evaluateApprovalStatus', () => {

  it('standard invoices return status "not_required"', () => {
    const payment = makeMockPayment('standard', 100_000);
    const score = makeMockScore(50_000);

    const result = evaluateApprovalStatus(payment, score);
    expect(result.status).toBe('not_required');
    expect(result.note).toContain('Standard invoice value');
  });

  it('high-value invoice with EV below auto-approve threshold remains "pending"', () => {
    const payment = makeMockPayment('high_value', 1_000_000); // ₹10,000
    const score = makeMockScore(200_000); // ₹2,000 EV (< ₹5,000 threshold)

    const result = evaluateApprovalStatus(payment, score, { simulateAutoApproval: true, runtimeMode: 'TEST' });
    expect(result.status).toBe('pending');
    expect(result.note).toContain('requires explicit merchant authorization');
  });

  it('high-value invoice with EV >= ₹5,000 threshold gets "approved" in simulated batch', () => {
    const payment = makeMockPayment('high_value', 2_000_000); // ₹20,000
    const score = makeMockScore(HIGH_VALUE_AUTO_APPROVE_EV_THRESHOLD_PAISE + 10_000); // > ₹5,000 EV

    const result = evaluateApprovalStatus(payment, score, { simulateAutoApproval: true, runtimeMode: 'TEST' });
    expect(result.status).toBe('approved');
    expect(result.note).toContain('conditionally auto-approved');
  });

  it('high-value invoice remains "pending" if simulateAutoApproval is disabled', () => {
    const payment = makeMockPayment('high_value', 5_000_000); // ₹50,000
    const score = makeMockScore(3_000_000); // ₹30,000 EV

    const result = evaluateApprovalStatus(payment, score, { simulateAutoApproval: false, runtimeMode: 'TEST' });
    expect(result.status).toBe('pending');
  });

  // Task d: Runtime mode check across DEMO, TEST, SANDBOX, LIVE
  it('enforces fail-closed manual review in SANDBOX and LIVE modes, and permits simulation auto-approval in DEMO and TEST modes', () => {
    const payment = makeMockPayment('high_value', 2_000_000); // ₹20,000 (high value)
    const score = makeMockScore(HIGH_VALUE_AUTO_APPROVE_EV_THRESHOLD_PAISE + 100_000); // ₹6,000 EV

    // 1. LIVE mode: MUST remain 'pending' even with simulateAutoApproval: true
    const liveResult = evaluateApprovalStatus(payment, score, {
      simulateAutoApproval: true,
      runtimeMode: 'LIVE',
    });
    expect(liveResult.status).toBe('pending');
    expect(liveResult.note).toContain('LIVE mode');

    // 2. SANDBOX mode: MUST remain 'pending' even with simulateAutoApproval: true
    const sandboxResult = evaluateApprovalStatus(payment, score, {
      simulateAutoApproval: true,
      runtimeMode: 'SANDBOX',
    });
    expect(sandboxResult.status).toBe('pending');
    expect(sandboxResult.note).toContain('SANDBOX mode');

    // 3. DEMO mode: auto-approves when simulateAutoApproval is true
    const demoApproved = evaluateApprovalStatus(payment, score, {
      simulateAutoApproval: true,
      runtimeMode: 'DEMO',
    });
    expect(demoApproved.status).toBe('approved');

    // 4. DEMO mode: defaults to 'pending' when simulateAutoApproval is false
    const demoPending = evaluateApprovalStatus(payment, score, {
      simulateAutoApproval: false,
      runtimeMode: 'DEMO',
    });
    expect(demoPending.status).toBe('pending');

    // 5. TEST mode: auto-approves when simulateAutoApproval is true
    const testApproved = evaluateApprovalStatus(payment, score, {
      simulateAutoApproval: true,
      runtimeMode: 'TEST',
    });
    expect(testApproved.status).toBe('approved');

    // 6. TEST mode: defaults to 'pending' when simulateAutoApproval is false
    const testPending = evaluateApprovalStatus(payment, score, {
      simulateAutoApproval: false,
      runtimeMode: 'TEST',
    });
    expect(testPending.status).toBe('pending');
  });
});
