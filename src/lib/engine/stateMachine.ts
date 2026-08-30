/**
 * PayBack AI — Closed-Loop Multi-Cycle Recovery State Machine.
 *
 * Implements an auditable, deterministic, multi-cycle recovery state machine:
 *
 *   DETECTED
 *     │
 *     ▼
 *   DIAGNOSED
 *     │
 *     ▼
 *   ELIGIBILITY_CHECKED
 *     │
 *     ├──[ Ineligible ]──► STOPPED (opt_out, max_attempts, permanent_failure)
 *     │
 *     ├──[ High Value ]──► APPROVAL_REQUIRED ──► [ Approved ] ──┐
 *     │                                      ──► [ Rejected ] ──┼──► STOPPED
 *     │
 *     ▼
 *   SCHEDULED (outside quiet hours)
 *     │
 *     ▼
 *   EXECUTING (Attempt 1..3 via Adapter)
 *     │
 *     ▼
 *   OUTCOME_OBSERVED
 *     │
 *     ├──[ Settled ]──────────────► RECOVERED (Terminal Success)
 *     │
 *     ├──[ Customer Promise ]─────► PROMISE_TO_PAY ──► [ Kept ] ──► RECOVERED
 *     │                                           ──► [ Broken ] ──► RETRY_SCHEDULED / ESCALATED
 *     │
 *     ├──[ Failed & attempts < 3 ]─► RETRY_SCHEDULED ──(backoff)──► SCHEDULED
 *     │
 *     └──[ Failed & attempts >= 3 ]► STOPPED (max_attempts_exceeded)
 */

import type { FailedPayment, InterventionType } from '@/types';
import { checkSafetyRules } from './safetyFilter';
import { calculateNextContactTime } from './quietHours';
import { evaluateApprovalStatus } from './approvalGate';
import { selectIntervention } from './interventions';
import { scorePaymentWithTrainedModel } from './trainModel';
import type { FrozenPotentialOutcomes } from './outcomeEnvironment';

export type RecoveryState =
  | 'DETECTED'
  | 'DIAGNOSED'
  | 'ELIGIBILITY_CHECKED'
  | 'APPROVAL_REQUIRED'
  | 'SCHEDULED'
  | 'EXECUTING'
  | 'OUTCOME_OBSERVED'
  | 'RECOVERED'
  | 'RETRY_SCHEDULED'
  | 'PROMISE_TO_PAY'
  | 'ESCALATED'
  | 'STOPPED';

export type StateActor =
  | 'system_engine'
  | 'reviewer'
  | 'outcome_observer'
  | 'gateway_webhook'
  | 'customer';

export interface StateTransitionEvent {
  eventId: string;
  recordId: string;
  previousState: RecoveryState;
  nextState: RecoveryState;
  actor: StateActor;
  timestamp: string;
  reasonCode: string;
  evidence: Record<string, unknown>;
  policyVersion: string;
  idempotencyKey: string;
}

export interface PromiseToPayRecord {
  promiseId: string;
  paymentId: string;
  promisedAmountPaise: number;
  promisedDueDate: string;
  status: 'active' | 'kept' | 'broken' | 'extended';
  reminderScheduledTime: string;
  notes: string;
}

export interface ReviewerAction {
  action: 'approve' | 'reject' | 'request_evidence' | 'defer' | 'flag' | 'stop_workflow';
  actorId: string;
  timestamp: string;
  reviewerNote: string;
}

export interface RecoveryWorkflowInstance {
  workflowId: string;
  payment: FailedPayment;
  currentState: RecoveryState;
  cycleCount: number; // Current attempt cycle (1, 2, 3)
  history: StateTransitionEvent[];
  activeIntervention: InterventionType;
  scheduledTime?: string;
  promiseToPay?: PromiseToPayRecord;
  reviewerActions: ReviewerAction[];
  recoveredAmountPaise: number;
  terminalReason?: string;
}

/**
 * Valid state transitions mapping.
 */
const VALID_TRANSITIONS: Record<RecoveryState, RecoveryState[]> = {
  DETECTED: ['DIAGNOSED', 'STOPPED'],
  DIAGNOSED: ['ELIGIBILITY_CHECKED', 'STOPPED'],
  ELIGIBILITY_CHECKED: ['APPROVAL_REQUIRED', 'SCHEDULED', 'STOPPED'],
  APPROVAL_REQUIRED: ['SCHEDULED', 'ESCALATED', 'STOPPED'],
  SCHEDULED: ['EXECUTING', 'STOPPED'],
  EXECUTING: ['OUTCOME_OBSERVED', 'STOPPED'],
  OUTCOME_OBSERVED: ['RECOVERED', 'RETRY_SCHEDULED', 'PROMISE_TO_PAY', 'ESCALATED', 'STOPPED'],
  RETRY_SCHEDULED: ['SCHEDULED', 'STOPPED'],
  PROMISE_TO_PAY: ['RECOVERED', 'RETRY_SCHEDULED', 'ESCALATED', 'STOPPED'],
  ESCALATED: ['SCHEDULED', 'STOPPED'],
  RECOVERED: [], // Terminal
  STOPPED: [],   // Terminal
};

/**
 * Transition a workflow instance to a new state with strict invariant validation.
 */
export function transitionWorkflowState(
  workflow: RecoveryWorkflowInstance,
  nextState: RecoveryState,
  actor: StateActor,
  reasonCode: string,
  evidence: Record<string, unknown> = {},
): StateTransitionEvent {
  const allowed = VALID_TRANSITIONS[workflow.currentState];
  if (!allowed.includes(nextState)) {
    throw new Error(
      `Illegal state transition violation: Cannot transition workflow ${workflow.workflowId} from ${workflow.currentState} to ${nextState}`,
    );
  }

  const timestamp = new Date().toISOString();
  const eventId = `evt_${workflow.workflowId}_${workflow.history.length + 1}_${Date.now()}`;
  const idempotencyKey = `idemp_${workflow.payment.payment_id}_${workflow.currentState}_${nextState}_${workflow.cycleCount}`;

  const event: StateTransitionEvent = {
    eventId,
    recordId: workflow.payment.payment_id,
    previousState: workflow.currentState,
    nextState,
    actor,
    timestamp,
    reasonCode,
    evidence,
    policyVersion: 'v1.1.0-closed-loop',
    idempotencyKey,
  };

  workflow.history.push(event);
  workflow.currentState = nextState;
  return event;
}

/**
 * Initialize a closed-loop workflow for a failed payment.
 */
export function initRecoveryWorkflow(payment: FailedPayment): RecoveryWorkflowInstance {
  const workflowId = `wf_${payment.payment_id}`;
  const timestamp = new Date().toISOString();
  const initialEvent: StateTransitionEvent = {
    eventId: `evt_${workflowId}_1_${Date.now()}`,
    recordId: payment.payment_id,
    previousState: 'DETECTED',
    nextState: 'DETECTED',
    actor: 'gateway_webhook',
    timestamp,
    reasonCode: 'PAYMENT_FAILURE_DETECTED',
    evidence: { amount: payment.amount, failure_category: payment.failure_category },
    policyVersion: 'v1.1.0-closed-loop',
    idempotencyKey: `idemp_${payment.payment_id}_init`,
  };

  return {
    workflowId,
    payment,
    currentState: 'DETECTED',
    cycleCount: 0,
    history: [initialEvent],
    activeIntervention: 'none',
    reviewerActions: [],
    recoveredAmountPaise: 0,
  };
}

/**
 * Step the workflow through diagnosis and eligibility check.
 */
export function stepWorkflowDiagnosisAndEligibility(
  workflow: RecoveryWorkflowInstance,
  options: { referenceDate?: Date; autoApproveHighEV?: boolean } = {},
): void {
  const refDate = options.referenceDate ?? new Date('2025-08-30T10:00:00Z');
  const autoApprove = options.autoApproveHighEV ?? false;

  // Step to DIAGNOSED
  const score = scorePaymentWithTrainedModel(workflow.payment, undefined, refDate);
  const intervention = selectIntervention(workflow.payment.failure_category);
  workflow.activeIntervention = intervention;

  transitionWorkflowState(workflow, 'DIAGNOSED', 'system_engine', 'DIAGNOSIS_COMPLETED', {
    recovery_probability: score.recovery_probability,
    expected_value: score.expected_value,
    recommended_intervention: intervention,
  });

  // Step to ELIGIBILITY_CHECKED
  const safety = checkSafetyRules(workflow.payment);
  transitionWorkflowState(workflow, 'ELIGIBILITY_CHECKED', 'system_engine', 'SAFETY_RULES_EVALUATED', {
    eligible: safety.eligible,
    stop_reason: safety.stop_reason,
  });

  if (!safety.eligible) {
    transitionWorkflowState(workflow, 'STOPPED', 'system_engine', safety.stop_reason ?? 'INELIGIBLE', {
      detail: safety.stop_detail,
    });
    workflow.terminalReason = safety.stop_detail;
    return;
  }

  // Check Approval Gate for high-value enterprise invoices
  const approval = evaluateApprovalStatus(workflow.payment, score, { autoApproveHighEV: autoApprove });
  if (approval.status === 'pending') {
    transitionWorkflowState(workflow, 'APPROVAL_REQUIRED', 'system_engine', 'HIGH_VALUE_REVIEW_REQUIRED', {
      amount: workflow.payment.amount,
      note: approval.note,
    });
  } else {
    // Schedule contact outside quiet hours
    const scheduled = calculateNextContactTime(refDate, workflow.payment.quiet_hours_window).toISOString();
    workflow.scheduledTime = scheduled;
    transitionWorkflowState(workflow, 'SCHEDULED', 'system_engine', 'CONTACT_TIME_SCHEDULED', {
      scheduled_contact_time: scheduled,
    });
  }
}

/**
 * Apply a human reviewer operational action to an approval-gated workflow.
 */
export function applyReviewerDecision(
  workflow: RecoveryWorkflowInstance,
  action: ReviewerAction,
): StateTransitionEvent {
  if (!action.reviewerNote || !action.reviewerNote.trim()) {
    throw new Error(`Reviewer note is required before applying reviewer action ${action.action}`);
  }
  if (!action.actorId || !action.actorId.trim()) {
    throw new Error(`Reviewer actor ID is required`);
  }
  workflow.reviewerActions.push(action);

  if (action.action === 'approve') {
    return transitionWorkflowState(workflow, 'SCHEDULED', 'reviewer', 'REVIEWER_APPROVED', {
      reviewerId: action.actorId,
      note: action.reviewerNote,
    });
  } else if (action.action === 'reject' || action.action === 'stop_workflow') {
    const evt = transitionWorkflowState(workflow, 'STOPPED', 'reviewer', 'REVIEWER_TERMINATED', {
      reviewerId: action.actorId,
      note: action.reviewerNote,
    });
    workflow.terminalReason = `Reviewer rejected recovery: ${action.reviewerNote}`;
    return evt;
  } else if (action.action === 'flag' || action.action === 'request_evidence') {
    return transitionWorkflowState(workflow, 'ESCALATED', 'reviewer', 'REVIEWER_ESCALATED_FOR_EVIDENCE', {
      reviewerId: action.actorId,
      note: action.reviewerNote,
    });
  }
  throw new Error(`Unsupported reviewer action: ${action.action}`);
}

export interface ExecutionAttemptResult {
  executed: boolean;
  recovered: boolean;
  disputed: boolean;
  settledAmountPaise: number;
  cycle: number;
}

/**
 * Execute a single bounded recovery attempt cycle.
 */
export function executeWorkflowAttempt(
  workflow: RecoveryWorkflowInstance,
  outcomeMatrix: FrozenPotentialOutcomes,
  maxAttempts: number = 3,
): ExecutionAttemptResult {
  if (workflow.currentState === 'RECOVERED' || workflow.currentState === 'STOPPED') {
    throw new Error(`Cannot execute workflow in terminal state: ${workflow.currentState}`);
  }

  if (workflow.currentState === 'APPROVAL_REQUIRED') {
    throw new Error(`Cannot execute workflow ${workflow.workflowId} while pending human approval`);
  }

  if (workflow.currentState === 'RETRY_SCHEDULED' || workflow.currentState === 'ESCALATED') {
    transitionWorkflowState(workflow, 'SCHEDULED', 'system_engine', 'CYCLE_BACKOFF_ELAPSED', {
      cycle: workflow.cycleCount + 1,
    });
  }

  if (workflow.currentState !== 'SCHEDULED') {
    throw new Error(`Workflow ${workflow.workflowId} is in state ${workflow.currentState}, expected SCHEDULED for execution`);
  }

  workflow.cycleCount++;
  transitionWorkflowState(workflow, 'EXECUTING', 'system_engine', 'INTERVENTION_TRIGGERED', {
    cycle: workflow.cycleCount,
    intervention: workflow.activeIntervention,
  });

  // Sample independent ground-truth outcome
  const outcome =
    outcomeMatrix.outcomes[workflow.activeIntervention]?.[workflow.cycleCount] ??
    { recovered: false, settledAmountPaise: 0, disputed: false, reason: 'Failed attempt' };

  transitionWorkflowState(workflow, 'OUTCOME_OBSERVED', 'gateway_webhook', 'OUTCOME_TELEMETRY_RECEIVED', {
    recovered: outcome.recovered,
    settledAmountPaise: outcome.settledAmountPaise,
    disputed: outcome.disputed,
  });

  if (outcome.disputed) {
    transitionWorkflowState(workflow, 'STOPPED', 'gateway_webhook', 'DISPUTE_SIGNALED', {
      reason: 'Customer filed dispute / chargeback during recovery attempt.',
    });
    workflow.terminalReason = 'Customer dispute signaled';
    return {
      executed: true,
      recovered: false,
      disputed: true,
      settledAmountPaise: 0,
      cycle: workflow.cycleCount,
    };
  }

  if (outcome.recovered) {
    workflow.recoveredAmountPaise = outcome.settledAmountPaise;
    transitionWorkflowState(workflow, 'RECOVERED', 'system_engine', 'INVOICE_SETTLED_SUCCESSFULLY', {
      recoveredAmountPaise: outcome.settledAmountPaise,
      attemptCycle: workflow.cycleCount,
    });
    return {
      executed: true,
      recovered: true,
      disputed: false,
      settledAmountPaise: outcome.settledAmountPaise,
      cycle: workflow.cycleCount,
    };
  } else {
    if (workflow.cycleCount >= maxAttempts) {
      transitionWorkflowState(workflow, 'STOPPED', 'system_engine', 'MAX_ATTEMPTS_EXCEEDED', {
        maxAttempts,
      });
      workflow.terminalReason = 'Exceeded maximum permitted attempts (3)';
    } else {
      if (workflow.activeIntervention === 'retry') {
        workflow.activeIntervention = 'both';
      }
      transitionWorkflowState(workflow, 'RETRY_SCHEDULED', 'system_engine', 'SCHEDULED_FOR_RETRY_CYCLE', {
        nextAttempt: workflow.cycleCount + 1,
        switchedIntervention: workflow.activeIntervention,
      });
    }
    return {
      executed: true,
      recovered: false,
      disputed: false,
      settledAmountPaise: 0,
      cycle: workflow.cycleCount,
    };
  }
}

/**
 * Simulate closed-loop multi-cycle execution across all attempts up to terminal state.
 */
export function runClosedLoopWorkflowToCompletion(
  workflow: RecoveryWorkflowInstance,
  outcomeMatrix: FrozenPotentialOutcomes,
  maxAttempts: number = 3,
): void {
  if (workflow.currentState === 'DETECTED') {
    stepWorkflowDiagnosisAndEligibility(workflow);
  }

  while (
    workflow.currentState !== 'RECOVERED' &&
    workflow.currentState !== 'STOPPED' &&
    workflow.cycleCount < maxAttempts
  ) {
    if (workflow.currentState === 'APPROVAL_REQUIRED') {
      // Auto-approve in batch simulation
      applyReviewerDecision(workflow, {
        action: 'approve',
        actorId: 'risk_officer_auto',
        timestamp: new Date().toISOString(),
        reviewerNote: 'Approved high-value enterprise invoice based on acceptable EV threshold.',
      });
    }

    if (workflow.currentState === 'RETRY_SCHEDULED' || workflow.currentState === 'ESCALATED') {
      transitionWorkflowState(workflow, 'SCHEDULED', 'system_engine', 'CYCLE_BACKOFF_ELAPSED', {
        cycle: workflow.cycleCount + 1,
      });
    }

    if (workflow.currentState === 'SCHEDULED') {
      workflow.cycleCount++;
      transitionWorkflowState(workflow, 'EXECUTING', 'system_engine', 'INTERVENTION_TRIGGERED', {
        cycle: workflow.cycleCount,
        intervention: workflow.activeIntervention,
      });

      // Sample independent ground-truth outcome
      const outcome =
        outcomeMatrix.outcomes[workflow.activeIntervention]?.[workflow.cycleCount] ??
        { recovered: false, settledAmountPaise: 0, disputed: false, reason: 'Failed attempt' };

      transitionWorkflowState(workflow, 'OUTCOME_OBSERVED', 'gateway_webhook', 'OUTCOME_TELEMETRY_RECEIVED', {
        recovered: outcome.recovered,
        settledAmountPaise: outcome.settledAmountPaise,
        disputed: outcome.disputed,
      });

      if (outcome.disputed) {
        transitionWorkflowState(workflow, 'STOPPED', 'gateway_webhook', 'DISPUTE_SIGNALED', {
          reason: 'Customer filed dispute / chargeback during recovery attempt.',
        });
        workflow.terminalReason = 'Customer dispute signaled';
        break;
      }

      if (outcome.recovered) {
        workflow.recoveredAmountPaise = outcome.settledAmountPaise;
        transitionWorkflowState(workflow, 'RECOVERED', 'system_engine', 'INVOICE_SETTLED_SUCCESSFULLY', {
          recoveredAmountPaise: outcome.settledAmountPaise,
          attemptCycle: workflow.cycleCount,
        });
        break;
      } else {
        // Did not recover this cycle
        if (workflow.cycleCount >= maxAttempts) {
          transitionWorkflowState(workflow, 'STOPPED', 'system_engine', 'MAX_ATTEMPTS_EXCEEDED', {
            maxAttempts,
          });
          workflow.terminalReason = 'Exceeded maximum permitted attempts (3)';
          break;
        } else {
          // Switch to secondary channel intervention on attempt 2 (e.g. retry -> reminder or both)
          if (workflow.activeIntervention === 'retry') {
            workflow.activeIntervention = 'both';
          }
          transitionWorkflowState(workflow, 'RETRY_SCHEDULED', 'system_engine', 'SCHEDULED_FOR_RETRY_CYCLE', {
            nextAttempt: workflow.cycleCount + 1,
            switchedIntervention: workflow.activeIntervention,
          });
        }
      }
    }
  }
}
