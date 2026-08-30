/**
 * PayBack AI — Full Batch Orchestration Engine.
 *
 * Connects the entire end-to-end recovery intelligence pipeline:
 *   1. Feature Extraction & Scoring (Milestone 2)
 *   2. Safety Filtering, Approval Gating & Priority Queue Allocation (Milestone 3)
 *   3. Test-Mode Stochastic Outcome Simulation (Milestone 4)
 *   4. Probabilistic Calibration & Reliability Evaluation (Milestone 4)
 *
 * This single pure function produces all data required by the dashboard.
 */

import type {
  FailedPayment,
  PipelineOptions,
  BatchExecutionResult,
} from '@/types';
import { processRecoveryPipeline } from './rankAndAllocate';
import { executeBatchInterventions } from './executeIntervention';
import { computeCalibrationReport } from './calibration';

/**
 * Execute the end-to-end recovery intelligence and simulation pipeline for a batch of payments.
 */
export function runRecoveryBatch(
  payments: FailedPayment[],
  options: PipelineOptions = {},
): BatchExecutionResult {
  // Step 1 & 2: Score, filter safety rules, approve, rank, allocate budget
  const pipelineSummary = processRecoveryPipeline(payments, options);

  // Step 3: Simulate test-mode interventions
  const executedItems = executeBatchInterventions(pipelineSummary.items, options);

  // Step 4: Compute statistical calibration and reliability metrics
  const calibrationReport = computeCalibrationReport(executedItems);

  // Step 5: Compute financial totals
  const totalRevenueRecovered = Number(
    executedItems
      .reduce((sum, item) => sum + item.recovered_amount, 0)
      .toFixed(2),
  );

  const totalRecoveredCount = executedItems.filter(
    (item) => item.execution_status === 'recovered',
  ).length;

  const overallRecoveryRate =
    payments.length > 0
      ? Number((totalRecoveredCount / payments.length).toFixed(4))
      : 0;

  return {
    summary: pipelineSummary,
    total_revenue_at_risk: pipelineSummary.total_revenue_at_risk,
    total_revenue_recovered: totalRevenueRecovered,
    overall_recovery_rate: overallRecoveryRate,
    executed_items: executedItems,
    calibration: calibrationReport,
  };
}
