/**
 * RecoverFlow AI — Normalized Outcome Observation Layer.
 *
 * Provides bounded, tamper-evident post-intervention outcome observation
 * without exposing public webhook HTTP receivers.
 *
 * Invariants Enforced:
 * 1. Integer-paise financial representation across all observed settlement values.
 * 2. Strict provenance attribution: sourceActor is restricted to 'outcome_observer' or 'gateway_webhook'.
 * 3. Monotonic state transitions: cannot transition from terminal states (RECOVERED, STOPPED).
 * 4. Recovery capping: observed settlement amount cannot exceed original amount at risk.
 * 5. Duplicate-settlement prevention: duplicate observation events for the same intervention are deduplicated.
 * 6. Evidence classification: explicitly tagged as verified_test_api, simulator_telemetry, or fixture_replay.
 */

import { z } from 'zod';
import { createHash } from 'crypto';
import type { RecoveryWorkflowInstance } from './stateMachine';
import { transitionWorkflowState } from './stateMachine';

// ─── Zod Schema for Normalized Outcome Event ─────────────────────────

export const EvidenceClassSchema = z.enum([
  'verified_test_api',
  'simulator_telemetry',
  'fixture_replay',
  'manual_reviewer_observed',
]);
export type EvidenceClass = z.infer<typeof EvidenceClassSchema>;

export const NormalizedOutcomeEventSchema = z.object({
  eventId: z.string().min(1),
  transactionReference: z.string().min(1).default('sim_txn_default').optional(),
  paymentId: z.string().min(1),
  attemptCycle: z.number().int().min(1).max(3).default(1).optional(),
  intervention: z.enum(['retry', 'reminder', 'both']).default('retry').optional(),
  interventionId: z.string().min(1),
  providerReference: z.string().min(1),
  sourceActor: z.enum(['outcome_observer', 'gateway_webhook']),
  observedStatus: z.enum(['captured', 'failed', 'pending', 'disputed', 'conflict']),
  observedAmountPaise: z.number().int().min(0),
  liveSettledAmountPaise: z.number().int().min(0).default(0).optional(),
  currency: z.literal('INR'),
  observedAt: z.string(),
  policyVersion: z.string().default('v1.1.0-logistic-calibrated').optional(),
  provenance: z.string(),
  evidenceClass: EvidenceClassSchema,
  rawSourceHash: z.string().min(1),
});

export type NormalizedOutcomeEvent = z.infer<typeof NormalizedOutcomeEventSchema>;

export interface ObservationProcessResult {
  accepted: boolean;
  duplicate: boolean;
  isConflict?: boolean;
  newState?: string;
  recoveredAmountPaise: number;
  message: string;
  event: NormalizedOutcomeEvent;
}

// ─── Outcome Observation Processor ───────────────────────────────────

class OutcomeObservationManager {
  private processedEventIds = new Set<string>();
  private processedInterventionKeys = new Map<string, { status: string; amountPaise: number }>();

  /**
   * Helper to compute SHA-256 hash of raw observation payload.
   */
  hashRawPayload(payload: unknown): string {
    return createHash('sha256')
      .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
      .digest('hex');
  }

  /**
   * Process a normalized outcome event against a live recovery workflow.
   */
  processOutcome(
    workflow: RecoveryWorkflowInstance,
    event: NormalizedOutcomeEvent,
  ): ObservationProcessResult {
    // Validate schema
    const validation = NormalizedOutcomeEventSchema.safeParse(event);
    if (!validation.success) {
      throw new Error(`Invalid NormalizedOutcomeEvent: ${validation.error.message}`);
    }

    const validatedEvent = validation.data;

    // 1. Idempotency & Deduplication on exact eventId
    if (this.processedEventIds.has(validatedEvent.eventId)) {
      return {
        accepted: false,
        duplicate: true,
        recoveredAmountPaise: workflow.recoveredAmountPaise,
        message: `Duplicate outcome eventId '${validatedEvent.eventId}' ignored.`,
        event: validatedEvent,
      };
    }

    // 2. Evidence Classification Boundary Enforcement
    if (
      validatedEvent.evidenceClass === 'simulator_telemetry' &&
      (validatedEvent.liveSettledAmountPaise ?? 0) > 0
    ) {
      throw new Error(
        'Financial invariant violation: Simulator observation cannot record liveSettledAmountPaise > 0.',
      );
    }

    const interventionKey = `${validatedEvent.paymentId}:${validatedEvent.interventionId}`;
    const previousOutcome = this.processedInterventionKeys.get(interventionKey);

    // 3. Conflict Detection: Contradictory outcome for the same intervention
    if (previousOutcome && previousOutcome.status !== validatedEvent.observedStatus) {
      if (workflow.currentState !== 'RECOVERED' && workflow.currentState !== 'STOPPED') {
        transitionWorkflowState(
          workflow,
          'OUTCOME_OBSERVED',
          validatedEvent.sourceActor,
          'OUTCOME_CONFLICT_DETECTED',
          {
            providerReference: validatedEvent.providerReference,
            previousStatus: previousOutcome.status,
            contradictoryStatus: validatedEvent.observedStatus,
            conflictResolution: 'HUMAN_REVIEW_REQUIRED',
          },
        );
      }

      // Conflict stops automatic settlement crediting
      return {
        accepted: true,
        duplicate: false,
        isConflict: true,
        newState: 'OUTCOME_CONFLICT',
        recoveredAmountPaise: 0,
        message: `OUTCOME CONFLICT: Contradictory status '${validatedEvent.observedStatus}' received for intervention '${interventionKey}' (previously '${previousOutcome.status}'). Case routed to human review.`,
        event: validatedEvent,
      };
    }

    // 4. Duplicate Settlement Prevention
    if (previousOutcome && previousOutcome.status === 'captured' && validatedEvent.observedStatus === 'captured') {
      return {
        accepted: false,
        duplicate: true,
        recoveredAmountPaise: workflow.recoveredAmountPaise,
        message: `Settlement already processed for intervention '${interventionKey}'. Double settlement prevented.`,
        event: validatedEvent,
      };
    }

    // 5. Monotonic State Invariant Check
    if (workflow.currentState === 'RECOVERED' || workflow.currentState === 'STOPPED') {
      return {
        accepted: false,
        duplicate: false,
        recoveredAmountPaise: workflow.recoveredAmountPaise,
        message: `Cannot apply outcome to workflow in terminal state '${workflow.currentState}'.`,
        event: validatedEvent,
      };
    }

    // 6. Amount Cap Check: Cannot recover more than amount at risk
    if (validatedEvent.observedAmountPaise > workflow.payment.amount) {
      throw new Error(
        `Financial invariant violation: observedAmountPaise (${validatedEvent.observedAmountPaise}) ` +
        `exceeds invoice amount at risk (${workflow.payment.amount}).`,
      );
    }

    // 7. Record Event in Idempotency / Monotonic Tracking Maps
    this.processedEventIds.add(validatedEvent.eventId);
    this.processedInterventionKeys.set(interventionKey, {
      status: validatedEvent.observedStatus,
      amountPaise: validatedEvent.observedAmountPaise,
    });

    // 8. Apply Workflow State Transition
    if (validatedEvent.observedStatus === 'captured' && validatedEvent.observedAmountPaise > 0) {
      transitionWorkflowState(
        workflow,
        'OUTCOME_OBSERVED',
        validatedEvent.sourceActor,
        'STATUS_POLLING_SETTLED',
        {
          providerReference: validatedEvent.providerReference,
          observedAmountPaise: validatedEvent.observedAmountPaise,
          evidenceClass: validatedEvent.evidenceClass,
          rawSourceHash: validatedEvent.rawSourceHash,
        },
      );

      transitionWorkflowState(
        workflow,
        'RECOVERED',
        validatedEvent.sourceActor,
        'INVOICE_SETTLED_VERIFIED',
        {
          settledAmountPaise: validatedEvent.observedAmountPaise,
        },
      );

      workflow.recoveredAmountPaise = validatedEvent.observedAmountPaise;

      return {
        accepted: true,
        duplicate: false,
        newState: 'RECOVERED',
        recoveredAmountPaise: workflow.recoveredAmountPaise,
        message: `Payment successfully observed and settled for ₹${(validatedEvent.observedAmountPaise / 100).toLocaleString('en-IN')}.`,
        event: validatedEvent,
      };
    } else if (validatedEvent.observedStatus === 'disputed') {
      transitionWorkflowState(
        workflow,
        'OUTCOME_OBSERVED',
        validatedEvent.sourceActor,
        'CHARGEBACK_DISPUTE_OBSERVED',
        {
          providerReference: validatedEvent.providerReference,
          evidenceClass: validatedEvent.evidenceClass,
        },
      );

      transitionWorkflowState(
        workflow,
        'STOPPED',
        validatedEvent.sourceActor,
        'DISPUTE_HALT_ENFORCED',
        {
          reason: 'Customer dispute or chargeback reported by gateway',
        },
      );

      workflow.terminalReason = 'Customer dispute halt enforced';

      return {
        accepted: true,
        duplicate: false,
        newState: 'STOPPED',
        recoveredAmountPaise: 0,
        message: 'Dispute observed. Safety stopping rule enforced immediately.',
        event: validatedEvent,
      };
    } else {
      // Pending or Failed Attempt
      transitionWorkflowState(
        workflow,
        'OUTCOME_OBSERVED',
        validatedEvent.sourceActor,
        'ATTEMPT_OBSERVED_UNSETTLED',
        {
          providerReference: validatedEvent.providerReference,
          observedStatus: validatedEvent.observedStatus,
        },
      );

      return {
        accepted: true,
        duplicate: false,
        newState: 'OUTCOME_OBSERVED',
        recoveredAmountPaise: 0,
        message: `Outcome observed: ${validatedEvent.observedStatus}. Invoice remains unsettled.`,
        event: validatedEvent,
      };
    }
  }

  /**
   * Reset processed events (used for test isolation).
   */
  clear(): void {
    this.processedEventIds.clear();
    this.processedInterventionKeys.clear();
  }
}

export const outcomeObserverManager = new OutcomeObservationManager();
