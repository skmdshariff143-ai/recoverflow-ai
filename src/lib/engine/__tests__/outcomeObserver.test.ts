/**
 * Unit tests for PayBack AI Normalized Outcome Observation Layer.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  outcomeObserverManager,
  NormalizedOutcomeEventSchema,
  type NormalizedOutcomeEvent,
} from '../outcomeObserver';
import { initRecoveryWorkflow, stepWorkflowDiagnosisAndEligibility } from '../stateMachine';
import type { FailedPayment } from '@/types';

const MOCK_PAYMENT: FailedPayment = {
  payment_id: 'pay_test_obs_001',
  customer_id: 'cust_obs_001',
  amount: 250000, // ₹2,500.00
  currency: 'INR',
  invoice_value_tier: 'standard',
  failure_category: 'insufficient_funds',
  raw_gateway_error: 'INSUFFICIENT_FUNDS_BALANCE_LOW',
  attempt_count: 0,
  opt_out: false,
  quiet_hours_window: { start: 22, end: 8, timezone: 'Asia/Kolkata' },
  failure_timestamp: '2026-08-30T10:00:00Z',
  customer_payment_history: {
    on_time_payment_rate: 0.85,
    broken_promise_count: 0,
    tenure_months: 12,
    total_transactions: 15,
    past_recovery_successes: 1,
    past_recovery_failures: 0,
  },
};

describe('Normalized Outcome Observation Layer', () => {
  beforeEach(() => {
    outcomeObserverManager.clear();
  });

  const validEvent: NormalizedOutcomeEvent = {
    eventId: 'evt_obs_001',
    paymentId: 'pay_test_obs_001',
    interventionId: 'int_cycle_1',
    providerReference: 'plink_test_998877',
    sourceActor: 'outcome_observer',
    observedStatus: 'captured',
    observedAmountPaise: 250000,
    currency: 'INR',
    observedAt: new Date().toISOString(),
    provenance: 'Razorpay Test Mode Status Polling (GET /v1/payment_links/:id)',
    evidenceClass: 'verified_test_api',
    rawSourceHash: outcomeObserverManager.hashRawPayload({ status: 'paid', id: 'plink_test_998877' }),
  };

  it('validates schema correctly and rejects invalid sourceActor or non-INR currency', () => {
    expect(NormalizedOutcomeEventSchema.safeParse(validEvent).success).toBe(true);

    const invalidActor = { ...validEvent, sourceActor: 'unauthorized_bot' };
    expect(NormalizedOutcomeEventSchema.safeParse(invalidActor).success).toBe(false);

    const invalidCurrency = { ...validEvent, currency: 'USD' };
    expect(NormalizedOutcomeEventSchema.safeParse(invalidCurrency).success).toBe(false);
  });

  it('processes valid captured settlement, transitions workflow to RECOVERED, and updates amounts', () => {
    const workflow = initRecoveryWorkflow(MOCK_PAYMENT);
    stepWorkflowDiagnosisAndEligibility(workflow);
    // Move to executing state for attempt
    workflow.currentState = 'EXECUTING';

    const result = outcomeObserverManager.processOutcome(workflow, validEvent);

    expect(result.accepted).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(result.newState).toBe('RECOVERED');
    expect(result.recoveredAmountPaise).toBe(250000);
    expect(workflow.currentState).toBe('RECOVERED');
    expect(workflow.recoveredAmountPaise).toBe(250000);
  });

  it('deduplicates duplicate eventId submissions', () => {
    const workflow = initRecoveryWorkflow(MOCK_PAYMENT);
    stepWorkflowDiagnosisAndEligibility(workflow);
    workflow.currentState = 'EXECUTING';

    const firstRun = outcomeObserverManager.processOutcome(workflow, validEvent);
    expect(firstRun.accepted).toBe(true);

    const duplicateRun = outcomeObserverManager.processOutcome(workflow, validEvent);
    expect(duplicateRun.accepted).toBe(false);
    expect(duplicateRun.duplicate).toBe(true);
  });

  it('prevents double settlement for the same intervention under different eventIds', () => {
    const workflow = initRecoveryWorkflow(MOCK_PAYMENT);
    stepWorkflowDiagnosisAndEligibility(workflow);
    workflow.currentState = 'EXECUTING';

    const firstRun = outcomeObserverManager.processOutcome(workflow, validEvent);
    expect(firstRun.accepted).toBe(true);

    const secondEventWithDifferentId: NormalizedOutcomeEvent = {
      ...validEvent,
      eventId: 'evt_obs_002_different',
    };

    const secondRun = outcomeObserverManager.processOutcome(workflow, secondEventWithDifferentId);
    expect(secondRun.accepted).toBe(false);
    expect(secondRun.duplicate).toBe(true);
    expect(secondRun.message).toContain('Double settlement prevented');
  });

  it('strictly throws error if observed settlement amount exceeds invoice amount at risk', () => {
    const workflow = initRecoveryWorkflow(MOCK_PAYMENT);
    stepWorkflowDiagnosisAndEligibility(workflow);
    workflow.currentState = 'EXECUTING';

    const excessiveEvent: NormalizedOutcomeEvent = {
      ...validEvent,
      observedAmountPaise: 99999999, // ₹999,999.99 vs ₹2,500.00
    };

    expect(() => {
      outcomeObserverManager.processOutcome(workflow, excessiveEvent);
    }).toThrow(/Financial invariant violation: observedAmountPaise/);
  });

  it('enforces safety halt when dispute outcome is observed from gateway_webhook', () => {
    const workflow = initRecoveryWorkflow(MOCK_PAYMENT);
    stepWorkflowDiagnosisAndEligibility(workflow);
    workflow.currentState = 'EXECUTING';

    const disputeEvent: NormalizedOutcomeEvent = {
      ...validEvent,
      eventId: 'evt_dispute_001',
      sourceActor: 'gateway_webhook',
      observedStatus: 'disputed',
      observedAmountPaise: 0,
      evidenceClass: 'simulator_telemetry',
    };

    const result = outcomeObserverManager.processOutcome(workflow, disputeEvent);
    expect(result.accepted).toBe(true);
    expect(result.newState).toBe('STOPPED');
    expect(workflow.currentState).toBe('STOPPED');
    expect(workflow.terminalReason).toContain('dispute halt');
  });

  it('detects contradictory outcomes for the same intervention, transitions to OUTCOME_CONFLICT, and halts revenue crediting', () => {
    const workflow = initRecoveryWorkflow(MOCK_PAYMENT);
    stepWorkflowDiagnosisAndEligibility(workflow);
    workflow.currentState = 'EXECUTING';

    const firstSuccessEvent: NormalizedOutcomeEvent = {
      ...validEvent,
      eventId: 'evt_conflict_1',
      observedStatus: 'captured',
      observedAmountPaise: 250000,
    };

    const firstRun = outcomeObserverManager.processOutcome(workflow, firstSuccessEvent);
    expect(firstRun.accepted).toBe(true);
    expect(firstRun.newState).toBe('RECOVERED');

    // Contradictory event for the same payment & intervention
    const contradictoryFailedEvent: NormalizedOutcomeEvent = {
      ...validEvent,
      eventId: 'evt_conflict_2',
      observedStatus: 'failed',
      observedAmountPaise: 0,
    };

    const conflictRun = outcomeObserverManager.processOutcome(workflow, contradictoryFailedEvent);
    expect(conflictRun.accepted).toBe(true);
    expect(conflictRun.isConflict).toBe(true);
    expect(conflictRun.newState).toBe('OUTCOME_CONFLICT');
    expect(conflictRun.recoveredAmountPaise).toBe(0);
    expect(conflictRun.message).toContain('OUTCOME CONFLICT');
  });

  it('strictly throws error if simulator observation attempts to record liveSettledAmountPaise > 0', () => {
    const workflow = initRecoveryWorkflow(MOCK_PAYMENT);
    stepWorkflowDiagnosisAndEligibility(workflow);
    workflow.currentState = 'EXECUTING';

    const invalidSimulatorEvent: NormalizedOutcomeEvent = {
      ...validEvent,
      eventId: 'evt_sim_invalid_live_amt',
      evidenceClass: 'simulator_telemetry',
      liveSettledAmountPaise: 250000, // Invariant violation: Simulator live settled amount must be 0
    };

    expect(() => {
      outcomeObserverManager.processOutcome(workflow, invalidSimulatorEvent);
    }).toThrow(/Financial invariant violation: Simulator observation cannot record liveSettledAmountPaise > 0/);
  });
});
