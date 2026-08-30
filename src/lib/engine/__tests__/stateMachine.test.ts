/**
 * Unit tests for RecoverFlow AI Closed-Loop State Machine (Phase 4).
 */

import { describe, it, expect } from 'vitest';
import {
  initRecoveryWorkflow,
  transitionWorkflowState,
  stepWorkflowDiagnosisAndEligibility,
  applyReviewerDecision,
  runClosedLoopWorkflowToCompletion,
} from '../stateMachine';
import { generatePotentialOutcomes } from '../outcomeEnvironment';
import type { FailedPayment } from '@/types';

function makeMockPayment(overrides: Partial<FailedPayment> = {}): FailedPayment {
  return {
    payment_id: 'pay_test_001',
    customer_id: 'cust_001',
    quiet_hours_window: { start: 22, end: 8, timezone: 'Asia/Kolkata' },
    opt_out: false,
    amount: 500_000, // ₹5,000.00
    invoice_value_tier: overrides.amount && overrides.amount >= 1_000_000 ? 'high_value' : 'standard',
    currency: 'INR',
    failure_timestamp: '2025-08-29T10:00:00Z',
    failure_category: 'bank_downtime',
    raw_gateway_error: 'BANK_DOWNTIME_503',
    attempt_count: 0,
    customer_payment_history: {
      on_time_payment_rate: 0.95,
      broken_promise_count: 0,
      tenure_months: 24,
      total_transactions: 10,
      past_recovery_successes: 3,
      past_recovery_failures: 0,
    },
    ...overrides,
  };
}

describe('Closed-Loop Recovery State Machine', () => {

  // ── 1. Initialization & State Transition Flow ────────────────────

  it('initializes workflow in DETECTED state with initial event log', () => {
    const payment = makeMockPayment();
    const wf = initRecoveryWorkflow(payment);

    expect(wf.currentState).toBe('DETECTED');
    expect(wf.history.length).toBe(1);
    expect(wf.history[0].reasonCode).toBe('PAYMENT_FAILURE_DETECTED');
  });

  it('progresses through DIAGNOSED and ELIGIBILITY_CHECKED to SCHEDULED', () => {
    const payment = makeMockPayment();
    const wf = initRecoveryWorkflow(payment);

    stepWorkflowDiagnosisAndEligibility(wf);

    expect(wf.currentState).toBe('SCHEDULED');
    expect(wf.history.length).toBe(4); // DETECTED -> DIAGNOSED -> ELIGIBILITY_CHECKED -> SCHEDULED
    expect(wf.scheduledTime).toBeDefined();
  });

  // ── 2. Illegal Transition Rejection ──────────────────────────────

  it('strictly rejects illegal direct state transitions', () => {
    const payment = makeMockPayment();
    const wf = initRecoveryWorkflow(payment);

    // Attempting to jump directly from DETECTED to RECOVERED must throw
    expect(() => {
      transitionWorkflowState(wf, 'RECOVERED', 'system_engine', 'ILLEGAL_JUMP');
    }).toThrow(/Illegal state transition violation/);
  });

  // ── 3. Safety Stopping Invariants ────────────────────────────────

  it('immediately halts opt-out payments at ELIGIBILITY_CHECKED stage', () => {
    const payment = makeMockPayment({ opt_out: true });
    const wf = initRecoveryWorkflow(payment);

    stepWorkflowDiagnosisAndEligibility(wf);

    expect(wf.currentState).toBe('STOPPED');
    expect(wf.terminalReason).toContain('opted out');
  });

  // ── 4. Human Reviewer Decisions ──────────────────────────────────

  it('supports reviewer approve, reject, and escalation operations', () => {
    const payment = makeMockPayment({ amount: 15_000_000 }); // High-value invoice
    const wf = initRecoveryWorkflow(payment);

    // Set to APPROVAL_REQUIRED
    stepWorkflowDiagnosisAndEligibility(wf);
    expect(wf.currentState).toBe('APPROVAL_REQUIRED');

    // Reviewer approves
    applyReviewerDecision(wf, {
      action: 'approve',
      actorId: 'user_risk_officer',
      timestamp: new Date().toISOString(),
      reviewerNote: 'Approved for automated payment link retry cycle.',
    });

    expect(wf.currentState).toBe('SCHEDULED');
    expect(wf.reviewerActions.length).toBe(1);
  });

  it('halts immediately when reviewer rejects workflow', () => {
    const payment = makeMockPayment({ amount: 15_000_000 });
    const wf = initRecoveryWorkflow(payment);

    stepWorkflowDiagnosisAndEligibility(wf);
    expect(wf.currentState).toBe('APPROVAL_REQUIRED');

    applyReviewerDecision(wf, {
      action: 'reject',
      actorId: 'user_risk_officer',
      timestamp: new Date().toISOString(),
      reviewerNote: 'Customer disputed offline — stop all recovery attempts.',
    });

    expect(wf.currentState).toBe('STOPPED');
    expect(wf.terminalReason).toContain('disputed offline');
  });

  // ── 5. Multi-Cycle Closed-Loop Execution ─────────────────────────

  it('runs multi-cycle recovery to terminal RECOVERED state on successful clearance', () => {
    const payment = makeMockPayment();
    const wf = initRecoveryWorkflow(payment);
    const outcomes = generatePotentialOutcomes(payment, 42);

    runClosedLoopWorkflowToCompletion(wf, outcomes, 3);

    expect(wf.currentState).toBe('RECOVERED');
    expect(wf.recoveredAmountPaise).toBe(payment.amount);
    expect(wf.cycleCount).toBeGreaterThanOrEqual(1);
    expect(wf.history.some((e) => e.nextState === 'OUTCOME_OBSERVED')).toBe(true);
  });
});
