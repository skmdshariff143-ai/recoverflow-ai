/**
 * Unit tests for the PayBack AI Test-Mode Intervention Executor.
 *
 * Validates:
 *  1. Determinism: identical seed produces identical simulated outcomes.
 *  2. Deferred / pending / stopped items NEVER recover (recovered_amount = 0).
 *  3. Recovered items only originate from 'budgeted' status.
 *  4. Mid-process disputes trigger an immediate safety halt with zero recovered amount.
 *  5. Failed attempts increment attempt_count and stop when reaching cap (3).
 */

import { describe, it, expect } from 'vitest';
import { executeBatchInterventions } from '../executeIntervention';
import type { PipelineItem, FailedPayment } from '@/types';
import type { PaymentScore } from '../scoreRecovery';

interface MockItemOverrides {
  payment?: Partial<FailedPayment>;
  score?: Partial<PaymentScore>;
  status?: PipelineItem['status'];
  approval_status?: PipelineItem['approval_status'];
  suggested_intervention?: PipelineItem['suggested_intervention'];
  scheduled_contact_time?: string;
  rank?: number;
  stop_reason?: PipelineItem['stop_reason'];
  stop_detail?: string;
}

function createMockPipelineItem(overrides: MockItemOverrides = {}): PipelineItem {
  const payment: FailedPayment = {
    payment_id: 'pay_exec_test',
    customer_id: 'cust_01',
    amount: 100_000,
    currency: 'INR',
    failure_category: 'bank_downtime',
    failure_timestamp: '2025-08-25T10:00:00Z',
    attempt_count: 0,
    opt_out: false,
    quiet_hours_window: { start: 22, end: 7, timezone: 'Asia/Kolkata' },
    invoice_value_tier: 'standard',
    raw_gateway_error: 'E_BANK_TIMEOUT',
    customer_payment_history: {
      on_time_payment_rate: 0.9,
      broken_promise_count: 0,
      tenure_months: 20,
      total_transactions: 40,
      past_recovery_successes: 4,
      past_recovery_failures: 1,
    },
    ...overrides.payment,
  };

  const score: PaymentScore = {
    payment_id: payment.payment_id,
    recovery_probability: 0.75,
    expected_value: 75_000,
    explanation: [],
    ...overrides.score,
  };

  return {
    payment,
    score,
    status: overrides.status ?? 'budgeted',
    stop_reason: overrides.stop_reason,
    stop_detail: overrides.stop_detail,
    approval_status: overrides.approval_status ?? 'not_required',
    suggested_intervention: overrides.suggested_intervention ?? 'retry',
    scheduled_contact_time: overrides.scheduled_contact_time ?? '2025-08-30T10:00:00Z',
    rank: overrides.rank ?? 1,
  };
}

describe('executeBatchInterventions', () => {

  // ── 1. Determinism with Seeded PRNG ────────────────────────────

  it('produces identical simulated outcomes when given the same simulationSeed', () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      createMockPipelineItem({
        payment: { payment_id: `pay_${i}` } as Partial<FailedPayment>,
        score: { recovery_probability: (i % 10) * 0.1 } as Partial<PaymentScore>,
      }),
    );

    const run1 = executeBatchInterventions(items, { simulationSeed: 12345 });
    const run2 = executeBatchInterventions(items, { simulationSeed: 12345 });

    expect(run1).toEqual(run2);
  });

  // ── 2. Non-budgeted items safety guarantee ─────────────────────

  it('deferred, pending_approval, and stopped items NEVER recover (recovered_amount = 0)', () => {
    const items: PipelineItem[] = [
      createMockPipelineItem({
        status: 'deferred',
        score: { recovery_probability: 0.99 } as Partial<PaymentScore>,
      }),
      createMockPipelineItem({
        status: 'pending_approval',
        score: { recovery_probability: 0.99 } as Partial<PaymentScore>,
      }),
      createMockPipelineItem({
        status: 'stopped',
        stop_reason: 'customer_opted_out',
        score: { recovery_probability: 0.99 } as Partial<PaymentScore>,
      }),
    ];

    const results = executeBatchInterventions(items, { simulationSeed: 42 });

    for (const res of results) {
      expect(res.recovered_amount).toBe(0);
      expect(res.execution_status).toBe(res.status);
    }
  });

  // ── 3. Dispute / cancellation immediate halt ───────────────────

  it('dispute triggers immediate stop and prevents recovery', () => {
    const item = createMockPipelineItem({
      status: 'budgeted',
      score: { recovery_probability: 0.99 } as Partial<PaymentScore>,
    });

    // Force dispute trigger with disputeRate = 1.0
    const results = executeBatchInterventions([item], {
      simulationSeed: 42,
      disputeRate: 1.0,
    });

    expect(results).toHaveLength(1);
    expect(results[0].execution_status).toBe('stopped');
    expect(results[0].stop_reason).toBe('dispute_or_cancellation_signaled');
    expect(results[0].recovered_amount).toBe(0);
    expect(results[0].dispute_signaled).toBe(true);
  });

  // ── 4. Failed attempt count increment and cap ──────────────────

  it('failed attempt increments attempt_count; stops if reaching cap of 3', () => {
    // Payment already at 2 prior attempts, probability 0.0 so it is guaranteed to fail
    const item = createMockPipelineItem({
      payment: { attempt_count: 2 } as Partial<FailedPayment>,
      score: { recovery_probability: 0.0 } as Partial<PaymentScore>,
      status: 'budgeted',
    });

    const results = executeBatchInterventions([item], {
      simulationSeed: 42,
      disputeRate: 0.0,
    });

    expect(results[0].final_attempt_count).toBe(3);
    expect(results[0].execution_status).toBe('stopped');
    expect(results[0].stop_reason).toBe('max_attempts_exceeded');
    expect(results[0].recovered_amount).toBe(0);
  });

  it('failed attempt with attempt_count < 2 is scheduled for retry', () => {
    // Payment at 0 prior attempts, probability 0.0
    const item = createMockPipelineItem({
      payment: { attempt_count: 0 } as Partial<FailedPayment>,
      score: { recovery_probability: 0.0 } as Partial<PaymentScore>,
      status: 'budgeted',
    });

    const results = executeBatchInterventions([item], {
      simulationSeed: 42,
      disputeRate: 0.0,
    });

    expect(results[0].final_attempt_count).toBe(1);
    expect(results[0].execution_status).toBe('retry_scheduled');
    expect(results[0].recovered_amount).toBe(0);
  });

  // ── 5. Successful recovery ─────────────────────────────────────

  it('successful recovery records full amount and status "recovered"', () => {
    const item = createMockPipelineItem({
      payment: { amount: 250_000 } as Partial<FailedPayment>,
      score: { recovery_probability: 1.0 } as Partial<PaymentScore>, // Guaranteed recovery
      status: 'budgeted',
    });

    const results = executeBatchInterventions([item], {
      simulationSeed: 42,
      disputeRate: 0.0,
    });

    expect(results[0].execution_status).toBe('recovered');
    expect(results[0].recovered_amount).toBe(250_000);
  });
});
