/**
 * RecoverFlow AI — High-Value Approval Gate.
 *
 * High-value invoices (tier = 'high_value') require human-in-the-loop review
 * before recovery actions can be executed.
 *
 * For autonomous batch simulations, high-value invoices with high expected value
 * (>= ₹5,000 / 500,000 paise) are conditionally auto-approved, while remaining
 * high-value items remain in 'pending' status for operator sign-off.
 */

import type { FailedPayment, ApprovalStatus } from '@/types';
import type { PaymentScore } from './scoreRecovery';

/** High expected value threshold (500,000 paise = ₹5,000) for batch auto-approval simulation. */
export const HIGH_VALUE_AUTO_APPROVE_EV_THRESHOLD_PAISE = 500_000;

export interface ApprovalEvaluation {
  status: ApprovalStatus;
  note: string;
}

export interface ApprovalOptions {
  /** Enable simulated auto-approval for high-EV invoices during batch processing. */
  autoApproveHighEV?: boolean;
}

/**
 * Evaluate human approval requirement for a payment.
 */
export function evaluateApprovalStatus(
  payment: FailedPayment,
  score: PaymentScore,
  options: ApprovalOptions = { autoApproveHighEV: true },
): ApprovalEvaluation {
  if (payment.invoice_value_tier !== 'high_value') {
    return {
      status: 'not_required',
      note: 'Standard invoice value — no manual approval required.',
    };
  }

  // High-value invoice handling
  if (
    options.autoApproveHighEV &&
    score.expected_value >= HIGH_VALUE_AUTO_APPROVE_EV_THRESHOLD_PAISE
  ) {
    return {
      status: 'approved',
      note:
        `High-value invoice conditionally auto-approved in simulation ` +
        `(Expected Value: ₹${(score.expected_value / 100).toLocaleString('en-IN')} >= ₹5,000 threshold).`,
    };
  }

  return {
    status: 'pending',
    note:
      `High-value invoice (₹${(payment.amount / 100).toLocaleString('en-IN')}) ` +
      `requires explicit merchant authorization before recovery dispatch.`,
  };
}
