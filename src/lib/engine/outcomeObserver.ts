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
  paymentId: z.string().min(1),
  interventionId: z.string().min(1),
  providerReference: z.string().min(1),
  sourceActor: z.enum(['outcome_observer', 'gateway_webhook']),
  observedStatus: z.enum(['captured', 'failed', 'pending', 'disputed']),
  observedAmountPaise: z.number().int().min(0),
  currency: z.literal('INR'),
  observedAt: z.string().datetime(),
  provenance: z.string(),
  evidenceClass: EvidenceClassSchema,
  rawSourceHash: z.string().min(1),
});

export type NormalizedOutcomeEvent = z.infer<typeof NormalizedOutcomeEventSchema>;

export interface ObservationProcessResult {
  accepted: boolean;
  duplicate: boolean;
  newState?: string;
  recoveredAmountPaise: number;
  message: string;
  event: NormalizedOutcomeEvent;
}

// ─── Outcome Observation Processor ───────────────────────────────────

class OutcomeObservationManager {
  private processedEventIds = new Set<string>();
  private processedInterventionKeys = new Set<string>();

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

    // 1. Idempotency & Deduplication
    if (this.processedEventIds.has(event.eventId)) {
      return {
        accepted: false,
        duplicate: true,
        recoveredAmountPaise: workflow.recoveredAmountPaise,
        message: `Duplicate outcome eventId '${event.eventId}' ignored.`,
        event,
      };
    }

    const interventionKey = `${event.paymentId}:${event.interventionId}`;
    if (this.processedInterventionKeys.has(interventionKey) && event.observedStatus === 'captured') {
      return {
        accepted: false,
        duplicate: true,
        recoveredAmountPaise: workflow.recoveredAmountPaise,
        message: `Settlement already processed for intervention '${interventionKey}'. Double settlement prevented.`,
        event,
      };
    }

    // 2. Monotonic State Invariant Check
    if (workflow.currentState === 'RECOVERED' || workflow.currentState === 'STOPPED') {
      return {
        accepted: false,
        duplicate: false,
        recoveredAmountPaise: workflow.recoveredAmountPaise,
        message: `Cannot apply outcome to workflow in terminal state '${workflow.currentState}'.`,
        event,
      };
    }

    // 3. Amount Cap Check: Cannot recover more than amount at risk
    if (event.observedAmountPaise > workflow.payment.amount) {
      throw new Error(
        `Financial invariant violation: observedAmountPaise (${event.observedAmountPaise}) ` +
        `exceeds invoice amount at risk (${workflow.payment.amount}).`,
      );
    }

    // 4. Record Event in Idempotency Sets
    this.processedEventIds.add(event.eventId);
    if (event.observedStatus === 'captured') {
      this.processedInterventionKeys.add(interventionKey);
    }

    // 5. Apply Workflow State Transition
    if (event.observedStatus === 'captured' && event.observedAmountPaise > 0) {
      transitionWorkflowState(
        workflow,
        'OUTCOME_OBSERVED',
        event.sourceActor,
        'STATUS_POLLING_SETTLED',
        {
          providerReference: event.providerReference,
          observedAmountPaise: event.observedAmountPaise,
          evidenceClass: event.evidenceClass,
          rawSourceHash: event.rawSourceHash,
        },
      );

      transitionWorkflowState(
        workflow,
        'RECOVERED',
        event.sourceActor,
        'INVOICE_SETTLED_VERIFIED',
        {
          settledAmountPaise: event.observedAmountPaise,
        },
      );

      workflow.recoveredAmountPaise = event.observedAmountPaise;

      return {
        accepted: true,
        duplicate: false,
        newState: 'RECOVERED',
        recoveredAmountPaise: workflow.recoveredAmountPaise,
        message: `Payment successfully observed and settled for ₹${(event.observedAmountPaise / 100).toLocaleString('en-IN')}.`,
        event,
      };
    } else if (event.observedStatus === 'disputed') {
      transitionWorkflowState(
        workflow,
        'OUTCOME_OBSERVED',
        event.sourceActor,
        'CHARGEBACK_DISPUTE_OBSERVED',
        {
          providerReference: event.providerReference,
          evidenceClass: event.evidenceClass,
        },
      );

      transitionWorkflowState(
        workflow,
        'STOPPED',
        event.sourceActor,
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
        event,
      };
    } else {
      // Pending or Failed Attempt
      transitionWorkflowState(
        workflow,
        'OUTCOME_OBSERVED',
        event.sourceActor,
        'ATTEMPT_OBSERVED_UNSETTLED',
        {
          providerReference: event.providerReference,
          observedStatus: event.observedStatus,
        },
      );

      return {
        accepted: true,
        duplicate: false,
        newState: 'OUTCOME_OBSERVED',
        recoveredAmountPaise: 0,
        message: `Outcome observed: ${event.observedStatus}. Invoice remains unsettled.`,
        event,
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
