/**
 * Unit tests for the RecoverFlow AI Calibration Engine.
 *
 * Validates:
 *  1. Exact mathematical precision against a hand-calculated 10-record fixture.
 *  2. Brier score calculation.
 *  3. Category metrics grouping and error calculation.
 *  4. 5-bin reliability diagram binning and metrics.
 *  5. Empty / edge-case handling.
 */

import { describe, it, expect } from 'vitest';
import { computeCalibrationReport } from '../calibration';
import type { ExecutedItem, FailedPayment } from '@/types';
import type { PaymentScore } from '../scoreRecovery';

function makeMockExecuted(
  id: string,
  category: FailedPayment['failure_category'],
  prob: number,
  isRecovered: boolean,
  amount = 100_000,
): ExecutedItem {
  const payment: FailedPayment = {
    payment_id: id,
    customer_id: 'cust_01',
    amount,
    currency: 'INR',
    failure_category: category,
    failure_timestamp: '2025-08-25T10:00:00Z',
    attempt_count: 0,
    opt_out: false,
    quiet_hours_window: { start: 22, end: 7, timezone: 'Asia/Kolkata' },
    invoice_value_tier: 'standard',
    raw_gateway_error: 'E_ERR',
    customer_payment_history: {
      on_time_payment_rate: 0.8,
      broken_promise_count: 0,
      tenure_months: 12,
      total_transactions: 20,
      past_recovery_successes: 2,
      past_recovery_failures: 1,
    },
  };

  const score: PaymentScore = {
    payment_id: id,
    recovery_probability: prob,
    expected_value: prob * amount,
    explanation: [],
  };

  return {
    payment,
    score,
    status: 'budgeted',
    approval_status: 'not_required',
    suggested_intervention: 'retry',
    rank: 1,
    execution_status: isRecovered ? 'recovered' : 'retry_scheduled',
    final_attempt_count: 1,
    recovered_amount: isRecovered ? amount : 0,
    simulated_outcome_detail: isRecovered ? 'Recovered' : 'Failed',
    dispute_signaled: false,
  };
}

describe('computeCalibrationReport', () => {

  // ── 1. Hand-Checkable 10-Record Fixture ─────────────────────────

  it('computes exact predicted vs actual rates on a hand-checkable 10-item dataset', () => {
    // 10 items:
    // 4 Bank Downtime items: probs [0.8, 0.8, 0.7, 0.7] (sum = 3.0, avg = 0.75) -> 3 recovered (actual = 3/4 = 0.75)
    // 6 Auth Failure items:  probs [0.5, 0.5, 0.4, 0.4, 0.3, 0.3] (sum = 2.4, avg = 0.40) -> 2 recovered (actual = 2/6 = 0.3333)
    // Total sum = 5.4, total items = 10 -> overall predicted = 0.54
    // Total recovered = 5 -> overall actual = 0.50
    // Overall calibration error = |0.54 - 0.50| = 0.04
    const items: ExecutedItem[] = [
      // Bank downtime (4 items, 3 recovered)
      makeMockExecuted('p1', 'bank_downtime', 0.8, true),
      makeMockExecuted('p2', 'bank_downtime', 0.8, true),
      makeMockExecuted('p3', 'bank_downtime', 0.7, true),
      makeMockExecuted('p4', 'bank_downtime', 0.7, false),

      // Auth failure (6 items, 2 recovered)
      makeMockExecuted('p5', 'auth_failure', 0.5, true),
      makeMockExecuted('p6', 'auth_failure', 0.5, true),
      makeMockExecuted('p7', 'auth_failure', 0.4, false),
      makeMockExecuted('p8', 'auth_failure', 0.4, false),
      makeMockExecuted('p9', 'auth_failure', 0.3, false),
      makeMockExecuted('p10', 'auth_failure', 0.3, false),
    ];

    const report = computeCalibrationReport(items);

    expect(report.overall_predicted_rate).toBe(0.54);
    expect(report.overall_actual_rate).toBe(0.50);
    expect(report.overall_calibration_error).toBe(0.04);

    // Verify category breakdown
    const bankMetric = report.category_metrics.find((c) => c.category === 'bank_downtime')!;
    expect(bankMetric).toBeDefined();
    expect(bankMetric.budgeted_count).toBe(4);
    expect(bankMetric.recovered_count).toBe(3);
    expect(bankMetric.predicted_recovery_rate).toBe(0.75);
    expect(bankMetric.actual_recovery_rate).toBe(0.75);
    expect(bankMetric.calibration_error).toBe(0.0);

    const authMetric = report.category_metrics.find((c) => c.category === 'auth_failure')!;
    expect(authMetric).toBeDefined();
    expect(authMetric.budgeted_count).toBe(6);
    expect(authMetric.recovered_count).toBe(2);
    expect(authMetric.predicted_recovery_rate).toBe(0.4);
    expect(authMetric.actual_recovery_rate).toBe(0.3333);
    expect(authMetric.calibration_error).toBe(0.0667);
  });

  // ── 2. Brier Score Precision ───────────────────────────────────

  it('calculates Brier score accurately', () => {
    // 2 items:
    // Item 1: prob = 0.8, outcome = 1 (diff = -0.2, sq = 0.04)
    // Item 2: prob = 0.2, outcome = 0 (diff = 0.2, sq = 0.04)
    // Brier score = (0.04 + 0.04) / 2 = 0.04
    const items: ExecutedItem[] = [
      makeMockExecuted('p1', 'bank_downtime', 0.8, true),
      makeMockExecuted('p2', 'auth_failure', 0.2, false),
    ];

    const report = computeCalibrationReport(items);
    expect(report.brier_score).toBe(0.04);
  });

  // ── 3. 5-Bin Reliability Diagram Metrics ───────────────────────

  it('correctly partitions items into 5 standard probability bins', () => {
    const items: ExecutedItem[] = [
      makeMockExecuted('p1', 'broken_promise_to_pay', 0.1, false), // bin 1 [0.0 - 0.2)
      makeMockExecuted('p2', 'invalid_mandate', 0.3, false),       // bin 2 [0.2 - 0.4)
      makeMockExecuted('p3', 'auth_failure', 0.5, true),           // bin 3 [0.4 - 0.6)
      makeMockExecuted('p4', 'bank_downtime', 0.7, true),          // bin 4 [0.6 - 0.8)
      makeMockExecuted('p5', 'duplicate_attempt', 0.9, true),      // bin 5 [0.8 - 1.0]
    ];

    const report = computeCalibrationReport(items);
    expect(report.binned_metrics).toHaveLength(5);

    for (let i = 0; i < 5; i++) {
      expect(report.binned_metrics[i].sample_count).toBe(1);
    }

    // Bin 1: prob = 0.1, recovered = 0 -> actual = 0.0, error = 0.1
    expect(report.binned_metrics[0].actual_recovery_rate).toBe(0.0);
    expect(report.binned_metrics[0].calibration_error).toBe(0.1);

    // Bin 5: prob = 0.9, recovered = 1 -> actual = 1.0, error = 0.1
    expect(report.binned_metrics[4].actual_recovery_rate).toBe(1.0);
    expect(report.binned_metrics[4].calibration_error).toBe(0.1);
  });

  // ── 4. Empty / Edge Cases ──────────────────────────────────────

  it('handles empty executed items gracefully without division by zero', () => {
    const report = computeCalibrationReport([]);
    expect(report.overall_predicted_rate).toBe(0);
    expect(report.overall_actual_rate).toBe(0);
    expect(report.category_metrics).toEqual([]);
    expect(report.binned_metrics).toEqual([]);
  });
});
