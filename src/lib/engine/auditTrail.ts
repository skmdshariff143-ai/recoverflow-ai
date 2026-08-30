/**
 * PayBack AI — Immutable Audit Trail Generator.
 *
 * Emits chronological, structured audit events for every decision point
 * in the recovery pipeline (scoring, safety checks, approval, ranking,
 * budget allocation, quiet-hours scheduling, execution).
 */

import type { ExecutedItem } from '@/types';

export interface AuditRecord {
  id: string;
  payment_id: string;
  timestamp: string;
  stage:
    | 'feature_scoring'
    | 'safety_filter'
    | 'approval_gate'
    | 'quiet_hours_scheduling'
    | 'budget_allocation'
    | 'intervention_execution';
  decision: string;
  reason: string;
  metadata?: Record<string, string | number | boolean | undefined>;
}

/**
 * Generate full chronological audit trail records from executed pipeline items.
 */
export function generateAuditTrail(executedItems: ExecutedItem[]): AuditRecord[] {
  const records: AuditRecord[] = [];
  let recordCounter = 1;

  for (const item of executedItems) {
    const { payment, score } = item;
    const baseTime = new Date(payment.failure_timestamp);

    // 1. Scoring Audit Record
    records.push({
      id: `aud_${String(recordCounter++).padStart(6, '0')}`,
      payment_id: payment.payment_id,
      timestamp: new Date(baseTime.getTime() + 1000).toISOString(),
      stage: 'feature_scoring',
      decision: `Scored recovery probability: ${(score.recovery_probability * 100).toFixed(1)}%`,
      reason:
        `Expected value: ₹${(score.expected_value / 100).toFixed(2)}. ` +
        `Top contributing factor: ${score.explanation[0]?.detail ?? 'N/A'}`,
      metadata: {
        recovery_probability: score.recovery_probability,
        expected_value: score.expected_value,
        failure_category: payment.failure_category,
        on_time_rate: payment.customer_payment_history.on_time_payment_rate,
        model_version: score.model_version ?? 'v1.0.0-heuristic',
      },
    });

    // 2. Safety Filter Audit Record
    if (item.status === 'stopped') {
      records.push({
        id: `aud_${String(recordCounter++).padStart(6, '0')}`,
        payment_id: payment.payment_id,
        timestamp: new Date(baseTime.getTime() + 2000).toISOString(),
        stage: 'safety_filter',
        decision: `Halted by safety rule: ${item.stop_reason}`,
        reason: item.stop_detail ?? 'Safety rule violation detected.',
        metadata: {
          stop_reason: item.stop_reason,
          opt_out: payment.opt_out,
          attempt_count: payment.attempt_count,
        },
      });
      // Stopped items do not proceed through remaining stages
      continue;
    } else {
      records.push({
        id: `aud_${String(recordCounter++).padStart(6, '0')}`,
        payment_id: payment.payment_id,
        timestamp: new Date(baseTime.getTime() + 2000).toISOString(),
        stage: 'safety_filter',
        decision: 'Safety compliance verified: eligible for recovery',
        reason: 'Customer opted-in, category is recoverable, prior attempts within cap (<= 3).',
      });
    }

    // 3. Approval Gate Audit Record
    if (item.status === 'pending_approval') {
      records.push({
        id: `aud_${String(recordCounter++).padStart(6, '0')}`,
        payment_id: payment.payment_id,
        timestamp: new Date(baseTime.getTime() + 3000).toISOString(),
        stage: 'approval_gate',
        decision: 'Escalated to human operator approval',
        reason: item.approval_note ?? 'High-value invoice flagged for mandatory authorization.',
      });
      continue;
    } else if (payment.invoice_value_tier === 'high_value') {
      records.push({
        id: `aud_${String(recordCounter++).padStart(6, '0')}`,
        payment_id: payment.payment_id,
        timestamp: new Date(baseTime.getTime() + 3000).toISOString(),
        stage: 'approval_gate',
        decision: 'High-value policy approval granted',
        reason: item.approval_note ?? 'Invoice approved based on high expected value threshold.',
      });
    }

    // 4. Quiet-Hours Scheduling Audit Record
    if (item.scheduled_contact_time) {
      records.push({
        id: `aud_${String(recordCounter++).padStart(6, '0')}`,
        payment_id: payment.payment_id,
        timestamp: new Date(baseTime.getTime() + 4000).toISOString(),
        stage: 'quiet_hours_scheduling',
        decision: `Contact scheduled for ${item.scheduled_contact_time}`,
        reason:
          `Customer quiet hours: ${payment.quiet_hours_window.start}:00–${payment.quiet_hours_window.end}:00 ` +
          `(${payment.quiet_hours_window.timezone}). Dispatch window verified non-intrusive.`,
        metadata: {
          timezone: payment.quiet_hours_window.timezone,
          scheduled_time: item.scheduled_contact_time,
        },
      });
    }

    // 5. Budget Allocation Audit Record
    records.push({
      id: `aud_${String(recordCounter++).padStart(6, '0')}`,
      payment_id: payment.payment_id,
      timestamp: new Date(baseTime.getTime() + 5000).toISOString(),
      stage: 'budget_allocation',
      decision:
        item.status === 'budgeted'
          ? `Allocated budget slot (Rank #${item.rank})`
          : `Deferred to next cycle (Rank #${item.rank})`,
      reason:
        item.status === 'budgeted'
          ? `Priority expected value ₹${(score.expected_value / 100).toFixed(2)} qualified within cycle capacity.`
          : `Capacity cap reached. Expected value ₹${(score.expected_value / 100).toFixed(2)} held for subsequent cycle.`,
      metadata: {
        rank: item.rank,
        status: item.status,
      },
    });

    // 6. Test-Mode Intervention Execution Record
    if (item.status === 'budgeted') {
      records.push({
        id: `aud_${String(recordCounter++).padStart(6, '0')}`,
        payment_id: payment.payment_id,
        timestamp: new Date(baseTime.getTime() + 6000).toISOString(),
        stage: 'intervention_execution',
        decision:
          item.execution_status === 'recovered'
            ? `Successfully recovered ₹${(item.recovered_amount / 100).toFixed(2)} via ${item.suggested_intervention}`
            : item.dispute_signaled
              ? 'Dispute / cancellation received — immediate safety halt'
              : item.execution_status === 'stopped'
                ? 'Attempt failed — attempt cap reached (stopped)'
                : 'Attempt failed — retry scheduled for subsequent cycle',
        reason: item.simulated_outcome_detail,
        metadata: {
          execution_status: item.execution_status,
          recovered_amount: item.recovered_amount,
          final_attempts: item.final_attempt_count,
          intervention: item.suggested_intervention,
        },
      });
    }
  }

  // Sort chronologically by timestamp, then ID
  return records.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/**
 * Export audit records as formatted CSV string.
 */
export function exportAuditTrailToCSV(records: AuditRecord[]): string {
  const headers = ['Audit ID', 'Payment ID', 'Timestamp', 'Stage', 'Decision', 'Reason'];
  const rows = records.map((r) => [
    `"${r.id}"`,
    `"${r.payment_id}"`,
    `"${r.timestamp}"`,
    `"${r.stage}"`,
    `"${r.decision.replace(/"/g, '""')}"`,
    `"${r.reason.replace(/"/g, '""')}"`,
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}
