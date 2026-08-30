/**
 * PayBack AI — Pipeline domain types.
 *
 * Types for safety filtering, approval gating, quiet-hours scheduling,
 * ranking, budget allocation, and batch pipeline summaries.
 */

import type { FailedPayment } from './payment';
import type { PaymentScore } from '@/lib/engine/scoreRecovery';

// ─── Status Enums ───────────────────────────────────────────────────

export const PIPELINE_STATUSES = [
  'budgeted',
  'deferred',
  'pending_approval',
  'stopped',
] as const;

export type PipelineItemStatus = (typeof PIPELINE_STATUSES)[number];

export const STOP_REASONS = [
  'customer_opted_out',
  'non_recoverable_category',
  'max_attempts_exceeded',
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
 * An enriched payment record passing through the PayBack AI pipeline.
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

// ─── Pipeline Configuration ─────────────────────────────────────────

export interface PipelineOptions {
  /** Maximum number of contact slots to allocate per cycle. Default: 40. */
  budget?: number;
  /** Current simulated reference time. Default: 2025-08-30T10:00:00Z. */
  referenceDate?: Date;
  /** Whether to simulate auto-approval for high EV high-value invoices. Default: true. */
  autoApproveHighValueWithHighEV?: boolean;
}

// ─── Batch Pipeline Summary ─────────────────────────────────────────

export interface BatchPipelineSummary {
  /** Total payments processed in the batch. */
  total_payments: number;
  /** Total revenue at risk in minor units (paise/cents). */
  total_revenue_at_risk: number;
  /** Configured budget capacity (slots). */
  budget_limit: number;

  /** Number of items successfully budgeted for recovery. */
  budgeted_count: number;
  /** Total expected recovered revenue from budgeted items. */
  budgeted_expected_value: number;

  /** Number of items deferred due to budget capacity constraints. */
  deferred_count: number;
  /** Expected revenue left on the table from deferred items. */
  deferred_expected_value: number;

  /** Number of high-value items held pending human approval. */
  pending_approval_count: number;
  /** Expected value tied up in pending approval queue. */
  pending_approval_expected_value: number;

  /** Number of items stopped by safety rules. */
  stopped_count: number;
  /** Breakdown of stopped items by specific safety rule. */
  stopped_by_reason: Record<StopReason, number>;

  /** Full array of processed pipeline items. */
  items: PipelineItem[];
}
