/**
 * RecoverFlow AI — Pipeline domain types.
 *
 * Types for safety filtering, approval gating, quiet-hours scheduling,
 * ranking, budget allocation, test-mode execution, and calibration analysis.
 */

import type { FailedPayment, FailureCategory } from './payment';
import type { PaymentScore } from '@/lib/engine/scoreRecovery';

// ─── Status Enums ───────────────────────────────────────────────────

export const PIPELINE_STATUSES = [
  'budgeted',
  'deferred',
  'pending_approval',
  'stopped',
] as const;

export type PipelineItemStatus = (typeof PIPELINE_STATUSES)[number];

export const EXECUTION_STATUSES = [
  'recovered',
  'retry_scheduled',
  'stopped',
  'deferred',
  'pending_approval',
] as const;

export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

export const STOP_REASONS = [
  'customer_opted_out',
  'non_recoverable_category',
  'max_attempts_exceeded',
  'dispute_or_cancellation_signaled',
] as const;

export type StopReason = (typeof STOP_REASONS)[number];

export const INTERVENTION_TYPES = ['retry', 'reminder', 'both', 'none'] as const;
export type InterventionType = (typeof INTERVENTION_TYPES)[number];

export const APPROVAL_STATUSES = [
  'not_required',
  'approved',
  'rejected',
  'pending',
] as const;

export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

// ─── Pipeline Item ──────────────────────────────────────────────────

/**
 * An enriched payment record passing through the RecoverFlow AI pipeline.
 */
export interface PipelineItem {
  payment: FailedPayment;
  score: PaymentScore;
  status: PipelineItemStatus;
  stop_reason?: StopReason;
  stop_detail?: string;
  approval_status: ApprovalStatus;
  approval_note?: string;
  suggested_intervention: InterventionType;
  scheduled_contact_time?: string;
  rank?: number;
}

/**
 * An executed payment record with simulated recovery outcomes.
 */
export interface ExecutedItem extends PipelineItem {
  execution_status: ExecutionStatus;
  final_attempt_count: number;
  recovered_amount: number;
  simulated_outcome_detail: string;
  dispute_signaled?: boolean;
}

// ─── Calibration Domain Types ───────────────────────────────────────

export interface CategoryCalibrationMetric {
  category: FailureCategory;
  budgeted_count: number;
  recovered_count: number;
  predicted_recovery_rate: number;
  actual_recovery_rate: number;
  calibration_error: number;
  expected_value: number;
  recovered_amount: number;
}

export interface BinnedCalibrationMetric {
  bin_index: number;
  bin_label: string;
  min_prob: number;
  max_prob: number;
  sample_count: number;
  avg_predicted_prob: number;
  actual_recovery_rate: number;
  calibration_error: number;
}

export interface CalibrationReport {
  overall_predicted_rate: number;
  overall_actual_rate: number;
  overall_calibration_error: number;
  brier_score: number;
  mean_category_calibration_error: number;
  category_metrics: CategoryCalibrationMetric[];
  binned_metrics: BinnedCalibrationMetric[];
}

// ─── Pipeline Configuration & Summaries ─────────────────────────────

export interface PipelineOptions {
  /** Scoring algorithm to use: 'heuristic' (v1.0.0) or 'trained_logistic' (v1.1.0). Default: 'trained_logistic'. */
  scoringModel?: 'heuristic' | 'trained_logistic';
  /** Maximum number of contact slots to allocate per cycle. Default: 40. */
  budget?: number;
  /** Current simulated reference time. Default: 2025-08-30T10:00:00Z. */
  referenceDate?: Date;
  /** Whether to simulate auto-approval for high EV high-value invoices. Default: true. */
  autoApproveHighValueWithHighEV?: boolean;
  /** Seed for deterministic stochastic simulation. Default: 42. */
  simulationSeed?: number;
  /** Simulated dispute/cancellation probability rate on budgeted items. Default: 0.03. */
  disputeRate?: number;
}

export interface ModelComparisonReport {
  heuristic: {
    modelVersion: string;
    brierScore: number;
    overallCalibrationError: number;
    predictedRecoveryRate: number;
    actualRecoveryRate: number;
    totalRecoveredRevenue: number;
    recoveredCount: number;
  };
  trainedLogistic: {
    modelVersion: string;
    brierScore: number;
    overallCalibrationError: number;
    predictedRecoveryRate: number;
    actualRecoveryRate: number;
    totalRecoveredRevenue: number;
    recoveredCount: number;
  };
  brierImprovementPercent: number;
  calibrationErrorDelta: number;
}

export interface BatchPipelineSummary {
  total_payments: number;
  total_revenue_at_risk: number;
  budget_limit: number;

  budgeted_count: number;
  budgeted_expected_value: number;

  deferred_count: number;
  deferred_expected_value: number;

  pending_approval_count: number;
  pending_approval_expected_value: number;

  stopped_count: number;
  stopped_by_reason: Record<StopReason, number>;

  items: PipelineItem[];
}

export interface BatchExecutionResult {
  summary: BatchPipelineSummary;
  total_revenue_at_risk: number;
  total_revenue_recovered: number;
  overall_recovery_rate: number;
  executed_items: ExecutedItem[];
  calibration: CalibrationReport;
}
