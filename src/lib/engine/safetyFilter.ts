/**
 * RecoverFlow AI — Safety Rule Filter.
 *
 * Enforces non-negotiable safety rules before any recovery action
 * or budget allocation can occur.
 *
 * Non-negotiable Rules:
 *  1. Hard attempt cap: Payments with attempt_count >= 3 are permanently stopped.
 *  2. Non-recoverable categories: Permanent account closures and customer
 *     cancellations are NEVER retried or contacted.
 *  3. Customer opt-out: Opted-out customers are NEVER contacted under any circumstance.
 *
 * Ineligible payments are preserved as 'stopped' records with explicit audit reasons.
 */

import type { FailedPayment, FailureCategory, StopReason } from '@/types';

/** Maximum allowed recovery attempts per payment before hard stop. */
export const MAX_RECOVERY_ATTEMPTS = 3;

/** Categories that are fundamentally non-recoverable and must never be retried. */
export const NON_RECOVERABLE_CATEGORIES: ReadonlySet<FailureCategory> = new Set([
  'permanent_account_closure',
  'customer_cancellation',
]);

export interface SafetyCheckResult {
  /** Whether the payment is eligible to proceed into the recovery pipeline. */
  eligible: boolean;
  /** Categorical reason if stopped. */
  stop_reason?: StopReason;
  /** Human-readable explanation for compliance and audit logs. */
  stop_detail?: string;
}

/**
 * Evaluate safety rules for a single failed payment.
 *
 * Pure function. Order of precedence:
 *  1. Customer opt-out (privacy/compliance takes absolute precedence).
 *  2. Non-recoverable category (fundamental impossibility).
 *  3. Max attempt cap (diminishing return & anti-harassment limit).
 */
export function checkSafetyRules(payment: FailedPayment): SafetyCheckResult {
  // 1. Customer Opt-Out Check
  if (payment.opt_out) {
    return {
      eligible: false,
      stop_reason: 'customer_opted_out',
      stop_detail: 'Customer has explicitly opted out of recovery communications.',
    };
  }

  // 2. Non-Recoverable Category Check
  if (NON_RECOVERABLE_CATEGORIES.has(payment.failure_category)) {
    return {
      eligible: false,
      stop_reason: 'non_recoverable_category',
      stop_detail:
        `Failure category '${payment.failure_category}' is permanently non-recoverable. ` +
        `Retries are strictly suppressed to avoid wasted fees and customer friction.`,
    };
  }

  // 3. Attempt Count Hard Cap Check
  if (payment.attempt_count >= MAX_RECOVERY_ATTEMPTS) {
    return {
      eligible: false,
      stop_reason: 'max_attempts_exceeded',
      stop_detail:
        `Payment has reached the hard recovery attempt cap (${payment.attempt_count}/${MAX_RECOVERY_ATTEMPTS}). ` +
        `No further automated retries permitted.`,
    };
  }

  return { eligible: true };
}
