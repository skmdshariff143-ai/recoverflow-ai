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

export const INTERVENTION_TYPES = ['retry', 'reminder', 'both', 'none'] as const;
export type InterventionType = (typeof INTERVENTION_TYPES)[number];

export const STOP_REASONS = [
  'customer_opted_out',
  'non_recoverable_category',
  'max_attempts_exceeded',
  'dispute_or_cancellation_signaled',
] as const;
export type StopReason = (typeof STOP_REASONS)[number];

export type ApprovalStatus = 'approved' | 'auto_approved' | 'pending' | 'rejected' | 'not_required';

export type DashboardTab =
  | 'dashboard'
  | 'live_runner'
  | 'evaluation_lab'
  | 'audit_ledger'
  | 'promise_to_pay'
  | 'methodology_guide';

// ─── Pipeline Item Interfaces ───────────────────────────────────────

export interface PipelineItem {
  payment: FailedPayment;
  score: PaymentScore;
  safety_eligible?: boolean;
  stop_reason?: StopReason;
  stop_detail?: string;
  status: PipelineItemStatus;
  rank?: number;
  suggested_intervention: InterventionType;
  scheduled_time?: string;
  requires_approval?: boolean;
  approval_status?: ApprovalStatus;
  approval_note?: string;
  scheduled_contact_time?: string;
}

export interface ExecutedItem extends PipelineItem {
  execution_status: ExecutionStatus;
  recovered_amount: number;
  attempts_taken?: number;
  final_attempt_count: number;
  cycle_count?: number;
  final_reason?: string;
  dispute_signaled?: boolean;
  simulated_outcome_detail?: string;
  timeline?: {
    scheduled_at?: string;
    executed_at?: string;
    settled_at?: string;
  };
}

// ─── Calibration Metrics Interfaces ─────────────────────────────────

export interface CategoryCalibrationMetric {
  category: FailureCategory;
  budgeted_count: number;
  recovered_count: number;
  predicted_recovery_rate: number;
  actual_recovery_rate: number;
  calibration_error: number;
  expected_value?: number;
  recovered_amount?: number;
}

export interface BinnedCalibrationMetric {
  bin_index?: number;
  bin_label: string;
  bin_min?: number;
  bin_max?: number;
  min_prob: number;
  max_prob: number;
  sample_count: number;
  predicted_avg_probability?: number;
  avg_predicted_prob: number;
  actual_recovery_rate: number;
  calibration_error: number;
}

export interface CalibrationReport {
  overall_brier_score: number;
  brier_score: number;
  overall_calibration_error: number;
  predicted_recovery_rate: number;
  overall_predicted_rate: number;
  actual_recovery_rate: number;
  overall_actual_rate: number;
  mean_category_calibration_error: number;
  by_category: CategoryCalibrationMetric[];
  category_metrics: CategoryCalibrationMetric[];
  by_bin: BinnedCalibrationMetric[];
  binned_metrics: BinnedCalibrationMetric[];
}

export interface ModelComparisonReport {
  heuristic: {
    modelVersion?: string;
    brierScore: number;
    calibrationError: number;
    overallCalibrationError: number;
    predictedRecoveryRate: number;
    actualRecoveryRate: number;
    recoveredRevenue: number;
    totalRecoveredRevenue: number;
    recoveredCount: number;
  };
  trainedLogistic: {
    modelVersion?: string;
    brierScore: number;
    calibrationError: number;
    overallCalibrationError: number;
    predictedRecoveryRate: number;
    actualRecoveryRate: number;
    recoveredRevenue: number;
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

export interface PipelineOptions {
  budget?: number;
  simulationSeed?: number;
  scoringModel?: 'heuristic' | 'trained_logistic';
  autoApproveHighValueWithHighEV?: boolean;
  referenceDate?: Date;
  disputeRate?: number;
}
