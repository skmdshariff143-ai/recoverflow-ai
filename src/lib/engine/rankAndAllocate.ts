/**
 * PayBack AI — Recovery Queue Ranking & Budget Allocation Engine.
 *
 * Orchestrates the full triage and prioritization pipeline:
 *  1. Feature scoring (recovery probability & expected value).
 *  2. Safety-rule filtering (opt-outs, non-recoverable categories, attempt caps).
 *  3. High-value invoice approval gating.
 *  4. Quiet-hours contact window calculation.
 *  5. Expected value ranking and limited budget allocation.
 */

import type {
  FailedPayment,
  PipelineItem,
  PipelineOptions,
  BatchPipelineSummary,
  StopReason,
} from '@/types';
import { scorePayment } from './scoreRecovery';
import { scorePaymentWithTrainedModel } from './trainModel';
import { checkSafetyRules } from './safetyFilter';
import { evaluateApprovalStatus } from './approvalGate';
import { calculateNextContactTime } from './quietHours';
import { selectIntervention } from './interventions';

export const DEFAULT_RECOVERY_BUDGET = 40;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Process a batch of failed payments through the entire PayBack AI prioritization pipeline.
 */
export function processRecoveryPipeline(
  payments: FailedPayment[],
  options: PipelineOptions = {},
): BatchPipelineSummary {
  const budget = options.budget ?? DEFAULT_RECOVERY_BUDGET;
  const refDate = options.referenceDate ?? new Date('2025-08-30T10:00:00Z');
  const autoApprove = options.autoApproveHighValueWithHighEV ?? true;
  const useTrainedModel = options.scoringModel === 'trained_logistic';

  const stoppedItems: PipelineItem[] = [];
  const pendingApprovalItems: PipelineItem[] = [];
  const actionableItems: PipelineItem[] = [];

  let totalRevenueAtRisk = 0;

  for (const payment of payments) {
    totalRevenueAtRisk += payment.amount;
    const score = useTrainedModel
      ? scorePaymentWithTrainedModel(payment, undefined, refDate)
      : scorePayment(payment, { referenceDate: refDate });

    // Step 1: Safety Rule Filter
    const safety = checkSafetyRules(payment);
    if (!safety.eligible) {
      stoppedItems.push({
        payment,
        score,
        status: 'stopped',
        stop_reason: safety.stop_reason,
        stop_detail: safety.stop_detail,
        approval_status: 'not_required',
        suggested_intervention: 'none',
      });
      continue;
    }

    // Step 2: High-Value Approval Gate
    const approval = evaluateApprovalStatus(payment, score, {
      autoApproveHighEV: autoApprove,
    });

    const intervention = selectIntervention(payment.failure_category);
    const scheduledTime = calculateNextContactTime(
      refDate,
      payment.quiet_hours_window,
    ).toISOString();

    if (approval.status === 'pending') {
      pendingApprovalItems.push({
        payment,
        score,
        status: 'pending_approval',
        approval_status: 'pending',
        approval_note: approval.note,
        suggested_intervention: intervention,
        scheduled_contact_time: scheduledTime,
      });
      continue;
    }

    // Step 3: Eligible & Approved Actionable Item
    actionableItems.push({
      payment,
      score,
      status: 'budgeted', // Temporary, will be finalized in budget allocation
      approval_status: approval.status,
      approval_note: approval.note,
      suggested_intervention: intervention,
      scheduled_contact_time: scheduledTime,
    });
  }

  // Step 4: Rank actionable items strictly descending by expected value
  actionableItems.sort((a, b) => {
    // Primary: Expected value descending
    if (b.score.expected_value !== a.score.expected_value) {
      return b.score.expected_value - a.score.expected_value;
    }
    // Secondary: Recovery probability descending
    if (b.score.recovery_probability !== a.score.recovery_probability) {
      return b.score.recovery_probability - a.score.recovery_probability;
    }
    // Tertiary: Payment ID ascending (deterministic tie-breaker)
    return a.payment.payment_id.localeCompare(b.payment.payment_id);
  });

  // Step 5: Allocate budget slots
  const budgetedItems: PipelineItem[] = [];
  const deferredItems: PipelineItem[] = [];

  for (let i = 0; i < actionableItems.length; i++) {
    const item = actionableItems[i];
    item.rank = i + 1;

    if (i < budget) {
      item.status = 'budgeted';
      budgetedItems.push(item);
    } else {
      item.status = 'deferred';
      deferredItems.push(item);
    }
  }

  // Step 6: Compute Summary Metrics
  const budgetedEV = round2(
    budgetedItems.reduce((sum, item) => sum + item.score.expected_value, 0),
  );
  const deferredEV = round2(
    deferredItems.reduce((sum, item) => sum + item.score.expected_value, 0),
  );
  const pendingApprovalEV = round2(
    pendingApprovalItems.reduce((sum, item) => sum + item.score.expected_value, 0),
  );

  const stoppedByReason: Record<StopReason, number> = {
    customer_opted_out: 0,
    non_recoverable_category: 0,
    max_attempts_exceeded: 0,
    dispute_or_cancellation_signaled: 0,
  };

  for (const item of stoppedItems) {
    if (item.stop_reason) {
      stoppedByReason[item.stop_reason] =
        (stoppedByReason[item.stop_reason] ?? 0) + 1;
    }
  }

  // Combine items into structured array: Budgeted -> Deferred -> Pending Approval -> Stopped
  const allItems: PipelineItem[] = [
    ...budgetedItems,
    ...deferredItems,
    ...pendingApprovalItems,
    ...stoppedItems,
  ];

  return {
    total_payments: payments.length,
    total_revenue_at_risk: totalRevenueAtRisk,
    budget_limit: budget,
    budgeted_count: budgetedItems.length,
    budgeted_expected_value: budgetedEV,
    deferred_count: deferredItems.length,
    deferred_expected_value: deferredEV,
    pending_approval_count: pendingApprovalItems.length,
    pending_approval_expected_value: pendingApprovalEV,
    stopped_count: stoppedItems.length,
    stopped_by_reason: stoppedByReason,
    items: allItems,
  };
}
