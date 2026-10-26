/**
 * PayBack AI — High-Value Approval Gate.
 *
 * High-value invoices (tier = 'high_value', amount > ₹10,000 / 1,000,000 paise)
 * require human-in-the-loop review before recovery actions can be executed.
 *
 * In offline benchmark simulations (DEMO / TEST mode only), high-value invoices
 * with expected value >= ₹5,000 (500,000 paise) can be conditionally auto-approved
 * if simulateAutoApproval is explicitly enabled.
 *
 * In SANDBOX and LIVE modes, the approval gate fails closed to manual review:
 * NO code path may auto-approve.
 */

import type { FailedPayment, ApprovalStatus } from './index';
import type { PaymentScore } from './scoreRecovery';
import { getRuntimeMode, type RuntimeMode } from './data/databaseFactory';

/** High expected value threshold (500,000 paise = ₹5,000) for batch auto-approval simulation. */
export const HIGH_VALUE_AUTO_APPROVE_EV_THRESHOLD_PAISE = 500_000;

/** Policy invoice value threshold (1,000,000 paise = ₹10,000) where invoices are classified as high-value requiring review. */
export const HIGH_VALUE_POLICY_THRESHOLD_PAISE = 1_000_000;

export interface ApprovalEvaluation {
  status: ApprovalStatus;
  note: string;
}

export interface ApprovalOptions {
  /** Enable simulated auto-approval for high-EV invoices during batch processing (DEMO/TEST only). Default: false. */
  simulateAutoApproval?: boolean;
  /** Backwards compatibility alias for simulateAutoApproval. */
  autoApproveHighEV?: boolean;
  /** Explicit runtime mode override (defaults to getRuntimeMode()). */
  runtimeMode?: RuntimeMode;
}

/**
 * Evaluate human approval requirement for a payment.
 *
 * Invariants:
 * 1. Standard invoice values (< ₹10,000) do not require manual approval ('not_required').
 * 2. High-value invoices (>= ₹10,000) fail-closed to manual review ('pending') in SANDBOX and LIVE modes.
 * 3. In DEMO and TEST modes, high-value invoices with EV >= ₹5,000 (500,000 paise) can be auto-approved
 *    ONLY if simulateAutoApproval is explicitly enabled.
 */
export function evaluateApprovalStatus(
  payment: FailedPayment,
  score: PaymentScore,
  options: ApprovalOptions = {},
): ApprovalEvaluation {
  if (payment.invoice_value_tier !== 'high_value') {
    return {
      status: 'not_required',
      note: 'Standard invoice value — no manual approval required.',
    };
  }

  // Resolve runtime mode (explicit override takes precedence; fallback to environment)
  const mode = options.runtimeMode ?? getRuntimeMode();

  // In SANDBOX and LIVE modes, fail closed: NEVER auto-approve
  if (mode === 'SANDBOX' || mode === 'LIVE') {
    return {
      status: 'pending',
      note:
        `High-value invoice (₹${(payment.amount / 100).toLocaleString('en-IN')}) ` +
        `requires explicit merchant authorization in ${mode} mode before recovery dispatch.`,
    };
  }

  // Auto-approval in DEMO/TEST modes is strictly simulation-opt-in
  const simulateAutoApproval = options.simulateAutoApproval ?? options.autoApproveHighEV ?? false;

  if (
    simulateAutoApproval &&
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
