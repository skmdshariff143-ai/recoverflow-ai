/**
 * RecoverFlow AI — Counterfactual Policy Simulator & Independent Evaluation Engine.
 *
 * Evaluates recovery policies against identical frozen ground-truth potential outcomes
 * to calculate true incremental yield, intervention efficiency, and safety compliance.
 */

import type { FailedPayment, PipelineOptions } from '@/types';
import { processRecoveryPipeline } from './rankAndAllocate';
import { checkSafetyRules } from './safetyFilter';
import { scorePayment } from './scoreRecovery';
import type { FrozenPotentialOutcomes } from './outcomeEnvironment';
import { sumPaise } from './financial';

export type PolicyType =
  | 'recoverflow_ai'
  | 'control_fixed_retry'
  | 'control_retry_all'
  | 'control_high_confidence_only'
  | 'control_no_action';

export interface PolicyEvaluationResult {
  policy: PolicyType;
  policyName: string;
  recordsProcessed: number;
  eligibleRecords: number;
  interventionsExecuted: number;
  totalAmountAtRiskPaise: number;
  recoveredAmountPaise: number;
  incrementalRecoveredPaise: number; // vs control_fixed_retry
  countRecoveryRatePercent: number;
  amountRecoveryRatePercent: number;
  recoveredCount: number;
  unsafeInterventionCount: number; // Opt-out or permanent category violated
  optOutViolations: number;
  duplicateExecutions: number;
  estimatedCostPaise: number; // Cost of API calls & customer messages
  netRecoveredPaise: number; // recoveredAmountPaise - estimatedCostPaise
  falsePositiveCount: number; // Predicted > 60% but failed
  falsePositiveExposurePaise: number; // Sum of failed high-prob amount
  falseNegativeCount: number; // Predicted < 40% but would recover
  unnecessaryInterventionRatePercent: number;
  brierScoreOnIndependentOutcomes: number;
}

export interface ErrorInspectorItem {
  payment_id: string;
  customer_id: string;
  amountPaise: number;
  failure_category: string;
  predictedProbability: number;
  expectedValuePaise: number;
  actualOutcome: boolean;
  errorType: 'false_positive' | 'false_negative' | 'unsafe_attempt' | 'high_value_misclassification';
  explanation: string;
}

export interface ComprehensiveEvaluationReport {
  datasetName: string;
  recordCount: number;
  policies: Record<PolicyType, PolicyEvaluationResult>;
  errorInspector: ErrorInspectorItem[];
  timestamp: string;
}

// Fixed operational intervention cost constants (in integer paise)
const COST_PER_GATEWAY_RETRY_PAISE = 1200; // ₹12.00
const COST_PER_REMINDER_PAISE = 500;       // ₹5.00
const COST_PER_BOTH_PAISE = 1700;           // ₹17.00

/**
 * Execute policy evaluation on a payment cohort with frozen potential outcomes.
 */
export function evaluateCohortPolicies(
  payments: FailedPayment[],
  frozenOutcomes: Map<string, FrozenPotentialOutcomes>,
  options: PipelineOptions = {},
): ComprehensiveEvaluationReport {
  const budget = options.budget ?? 40;
  const refDate = options.referenceDate ?? new Date('2025-08-30T10:00:00Z');
  const totalAmountAtRiskPaise = sumPaise(payments.map((p) => p.amount));

  // ── 1. RecoverFlow AI Dynamic Prioritization Policy ─────────────────
  const rfPipeline = processRecoveryPipeline(payments, {
    ...options,
    budget,
    referenceDate: refDate,
    scoringModel: 'trained_logistic',
  });

  let rfRecoveredPaise = 0;
  let rfInterventions = 0;
  let rfCostPaise = 0;
  let rfUnsafe = 0;
  let rfOptOutViolations = 0;
  let rfRecoveredCount = 0;
  let rfBrierSum = 0;
  let rfBrierCount = 0;
  const errors: ErrorInspectorItem[] = [];

  for (const item of rfPipeline.items) {
    const outcomeMatrix = frozenOutcomes.get(item.payment.payment_id);
    const safety = checkSafetyRules(item.payment);

    // Safety checks
    if (item.status === 'budgeted' && !safety.eligible) {
      rfUnsafe++;
      if (item.payment.opt_out) rfOptOutViolations++;
      errors.push({
        payment_id: item.payment.payment_id,
        customer_id: item.payment.customer_id,
        amountPaise: item.payment.amount,
        failure_category: item.payment.failure_category,
        predictedProbability: item.score.recovery_probability,
        expectedValuePaise: item.score.expected_value,
        actualOutcome: false,
        errorType: 'unsafe_attempt',
        explanation: `Safety violation: attempted recovery on ineligible payment (${safety.stop_reason})`,
      });
    }

    if (item.status === 'budgeted' && outcomeMatrix) {
      rfInterventions++;
      const intervention = item.suggested_intervention === 'none' ? 'retry' : item.suggested_intervention;
      const outcome = outcomeMatrix.outcomes[intervention]?.[1] ?? { recovered: false, settledAmountPaise: 0 };

      if (intervention === 'retry') rfCostPaise += COST_PER_GATEWAY_RETRY_PAISE;
      else if (intervention === 'reminder') rfCostPaise += COST_PER_REMINDER_PAISE;
      else rfCostPaise += COST_PER_BOTH_PAISE;

      if (outcome.recovered) {
        rfRecoveredPaise += item.payment.amount;
        rfRecoveredCount++;
      }

      // Independent Brier Score
      const actualBinary = outcome.recovered ? 1 : 0;
      rfBrierSum += Math.pow(item.score.recovery_probability - actualBinary, 2);
      rfBrierCount++;

      // Error Inspection: False Positives (High prob >= 0.70 but failed)
      if (item.score.recovery_probability >= 0.70 && !outcome.recovered) {
        errors.push({
          payment_id: item.payment.payment_id,
          customer_id: item.payment.customer_id,
          amountPaise: item.payment.amount,
          failure_category: item.payment.failure_category,
          predictedProbability: item.score.recovery_probability,
          expectedValuePaise: item.score.expected_value,
          actualOutcome: false,
          errorType: 'false_positive',
          explanation: `High confidence recovery (${(item.score.recovery_probability * 100).toFixed(1)}%) failed ground-truth clearance.`,
        });
      }

      // High-value misclassification (> ₹1 Lakh)
      if (item.payment.amount >= 10_000_000 && !outcome.recovered && item.score.recovery_probability >= 0.60) {
        errors.push({
          payment_id: item.payment.payment_id,
          customer_id: item.payment.customer_id,
          amountPaise: item.payment.amount,
          failure_category: item.payment.failure_category,
          predictedProbability: item.score.recovery_probability,
          expectedValuePaise: item.score.expected_value,
          actualOutcome: false,
          errorType: 'high_value_misclassification',
          explanation: `Enterprise invoice (₹${item.payment.amount / 100}) failed recovery despite positive score.`,
        });
      }
    } else if (item.status === 'deferred' && outcomeMatrix) {
      // False Negatives: Low score <= 0.30 but would have succeeded if attempted
      const potential = outcomeMatrix.outcomes['retry']?.[1];
      if (item.score.recovery_probability <= 0.30 && potential?.recovered) {
        errors.push({
          payment_id: item.payment.payment_id,
          customer_id: item.payment.customer_id,
          amountPaise: item.payment.amount,
          failure_category: item.payment.failure_category,
          predictedProbability: item.score.recovery_probability,
          expectedValuePaise: item.score.expected_value,
          actualOutcome: true,
          errorType: 'false_negative',
          explanation: `Low score (${(item.score.recovery_probability * 100).toFixed(1)}%) caused item to be deferred, though it was recoverable.`,
        });
      }
    }
  }

  // ── 2. Control Policy: Fixed Retry (No Prioritization, First 40 Eligible)
  let ctrlRecoveredPaise = 0;
  let ctrlInterventions = 0;
  let ctrlCostPaise = 0;
  let ctrlRecoveredCount = 0;
  let eligibleCount = 0;

  for (const payment of payments) {
    const safety = checkSafetyRules(payment);
    if (!safety.eligible) continue;
    eligibleCount++;

    if (ctrlInterventions < budget) {
      ctrlInterventions++;
      ctrlCostPaise += COST_PER_GATEWAY_RETRY_PAISE;
      const outcomeMatrix = frozenOutcomes.get(payment.payment_id);
      const outcome = outcomeMatrix?.outcomes['retry']?.[1];
      if (outcome?.recovered) {
        ctrlRecoveredPaise += payment.amount;
        ctrlRecoveredCount++;
      }
    }
  }

  // ── 3. Control Policy: Retry-All (Unbounded Budget) ─────────────────
  let retryAllRecoveredPaise = 0;
  let retryAllInterventions = 0;
  let retryAllCostPaise = 0;
  let retryAllRecoveredCount = 0;

  for (const payment of payments) {
    const safety = checkSafetyRules(payment);
    if (!safety.eligible) continue;
    retryAllInterventions++;
    retryAllCostPaise += COST_PER_GATEWAY_RETRY_PAISE;
    const outcomeMatrix = frozenOutcomes.get(payment.payment_id);
    const outcome = outcomeMatrix?.outcomes['retry']?.[1];
    if (outcome?.recovered) {
      retryAllRecoveredPaise += payment.amount;
      retryAllRecoveredCount++;
    }
  }

  // ── 4. Control Policy: High-Confidence Only (Prob >= 0.70) ──────────
  let highConfRecoveredPaise = 0;
  let highConfInterventions = 0;
  let highConfCostPaise = 0;
  let highConfRecoveredCount = 0;

  for (const payment of payments) {
    const safety = checkSafetyRules(payment);
    if (!safety.eligible) continue;
    const score = scorePayment(payment);
    if (score.recovery_probability >= 0.70) {
      highConfInterventions++;
      highConfCostPaise += COST_PER_GATEWAY_RETRY_PAISE;
      const outcomeMatrix = frozenOutcomes.get(payment.payment_id);
      const outcome = outcomeMatrix?.outcomes['retry']?.[1];
      if (outcome?.recovered) {
        highConfRecoveredPaise += payment.amount;
        highConfRecoveredCount++;
      }
    }
  }

  const rfResult: PolicyEvaluationResult = {
    policy: 'recoverflow_ai',
    policyName: 'RecoverFlow AI (EV Prioritization)',
    recordsProcessed: payments.length,
    eligibleRecords: eligibleCount,
    interventionsExecuted: rfInterventions,
    totalAmountAtRiskPaise,
    recoveredAmountPaise: rfRecoveredPaise,
    incrementalRecoveredPaise: rfRecoveredPaise - ctrlRecoveredPaise,
    countRecoveryRatePercent: Number(((rfRecoveredCount / Math.max(1, rfInterventions)) * 100).toFixed(1)),
    amountRecoveryRatePercent: Number(((rfRecoveredPaise / totalAmountAtRiskPaise) * 100).toFixed(1)),
    recoveredCount: rfRecoveredCount,
    unsafeInterventionCount: rfUnsafe,
    optOutViolations: rfOptOutViolations,
    duplicateExecutions: 0,
    estimatedCostPaise: rfCostPaise,
    netRecoveredPaise: rfRecoveredPaise - rfCostPaise,
    falsePositiveCount: errors.filter((e) => e.errorType === 'false_positive').length,
    falsePositiveExposurePaise: sumPaise(
      errors.filter((e) => e.errorType === 'false_positive').map((e) => e.amountPaise),
    ),
    falseNegativeCount: errors.filter((e) => e.errorType === 'false_negative').length,
    unnecessaryInterventionRatePercent: Number(
      (((rfInterventions - rfRecoveredCount) / Math.max(1, rfInterventions)) * 100).toFixed(1),
    ),
    brierScoreOnIndependentOutcomes: Number((rfBrierSum / Math.max(1, rfBrierCount)).toFixed(4)),
  };

  const ctrlFixedResult: PolicyEvaluationResult = {
    policy: 'control_fixed_retry',
    policyName: 'Fixed Retry Control (First 40 Eligible)',
    recordsProcessed: payments.length,
    eligibleRecords: eligibleCount,
    interventionsExecuted: ctrlInterventions,
    totalAmountAtRiskPaise,
    recoveredAmountPaise: ctrlRecoveredPaise,
    incrementalRecoveredPaise: 0,
    countRecoveryRatePercent: Number(((ctrlRecoveredCount / Math.max(1, ctrlInterventions)) * 100).toFixed(1)),
    amountRecoveryRatePercent: Number(((ctrlRecoveredPaise / totalAmountAtRiskPaise) * 100).toFixed(1)),
    recoveredCount: ctrlRecoveredCount,
    unsafeInterventionCount: 0,
    optOutViolations: 0,
    duplicateExecutions: 0,
    estimatedCostPaise: ctrlCostPaise,
    netRecoveredPaise: ctrlRecoveredPaise - ctrlCostPaise,
    falsePositiveCount: 0,
    falsePositiveExposurePaise: 0,
    falseNegativeCount: 0,
    unnecessaryInterventionRatePercent: Number(
      (((ctrlInterventions - ctrlRecoveredCount) / Math.max(1, ctrlInterventions)) * 100).toFixed(1),
    ),
    brierScoreOnIndependentOutcomes: 0,
  };

  const ctrlRetryAllResult: PolicyEvaluationResult = {
    policy: 'control_retry_all',
    policyName: 'Retry-All Control (Unbounded Budget)',
    recordsProcessed: payments.length,
    eligibleRecords: eligibleCount,
    interventionsExecuted: retryAllInterventions,
    totalAmountAtRiskPaise,
    recoveredAmountPaise: retryAllRecoveredPaise,
    incrementalRecoveredPaise: retryAllRecoveredPaise - ctrlRecoveredPaise,
    countRecoveryRatePercent: Number(((retryAllRecoveredCount / Math.max(1, retryAllInterventions)) * 100).toFixed(1)),
    amountRecoveryRatePercent: Number(((retryAllRecoveredPaise / totalAmountAtRiskPaise) * 100).toFixed(1)),
    recoveredCount: retryAllRecoveredCount,
    unsafeInterventionCount: 0,
    optOutViolations: 0,
    duplicateExecutions: 0,
    estimatedCostPaise: retryAllCostPaise,
    netRecoveredPaise: retryAllRecoveredPaise - retryAllCostPaise,
    falsePositiveCount: 0,
    falsePositiveExposurePaise: 0,
    falseNegativeCount: 0,
    unnecessaryInterventionRatePercent: Number(
      (((retryAllInterventions - retryAllRecoveredCount) / Math.max(1, retryAllInterventions)) * 100).toFixed(1),
    ),
    brierScoreOnIndependentOutcomes: 0,
  };

  const ctrlHighConfResult: PolicyEvaluationResult = {
    policy: 'control_high_confidence_only',
    policyName: 'High-Confidence Only (P ≥ 0.70)',
    recordsProcessed: payments.length,
    eligibleRecords: eligibleCount,
    interventionsExecuted: highConfInterventions,
    totalAmountAtRiskPaise,
    recoveredAmountPaise: highConfRecoveredPaise,
    incrementalRecoveredPaise: highConfRecoveredPaise - ctrlRecoveredPaise,
    countRecoveryRatePercent: Number(((highConfRecoveredCount / Math.max(1, highConfInterventions)) * 100).toFixed(1)),
    amountRecoveryRatePercent: Number(((highConfRecoveredPaise / totalAmountAtRiskPaise) * 100).toFixed(1)),
    recoveredCount: highConfRecoveredCount,
    unsafeInterventionCount: 0,
    optOutViolations: 0,
    duplicateExecutions: 0,
    estimatedCostPaise: highConfCostPaise,
    netRecoveredPaise: highConfRecoveredPaise - highConfCostPaise,
    falsePositiveCount: 0,
    falsePositiveExposurePaise: 0,
    falseNegativeCount: 0,
    unnecessaryInterventionRatePercent: Number(
      (((highConfInterventions - highConfRecoveredCount) / Math.max(1, highConfInterventions)) * 100).toFixed(1),
    ),
    brierScoreOnIndependentOutcomes: 0,
  };

  const ctrlNoActionResult: PolicyEvaluationResult = {
    policy: 'control_no_action',
    policyName: 'No-Action Baseline (0 Interventions)',
    recordsProcessed: payments.length,
    eligibleRecords: eligibleCount,
    interventionsExecuted: 0,
    totalAmountAtRiskPaise,
    recoveredAmountPaise: 0,
    incrementalRecoveredPaise: -ctrlRecoveredPaise,
    countRecoveryRatePercent: 0,
    amountRecoveryRatePercent: 0,
    recoveredCount: 0,
    unsafeInterventionCount: 0,
    optOutViolations: 0,
    duplicateExecutions: 0,
    estimatedCostPaise: 0,
    netRecoveredPaise: 0,
    falsePositiveCount: 0,
    falsePositiveExposurePaise: 0,
    falseNegativeCount: 0,
    unnecessaryInterventionRatePercent: 0,
    brierScoreOnIndependentOutcomes: 0,
  };

  return {
    datasetName: payments.length === 200 ? 'Development Cohort (200 Records)' : 'Held-Out Adversarial (80 Records)',
    recordCount: payments.length,
    policies: {
      recoverflow_ai: rfResult,
      control_fixed_retry: ctrlFixedResult,
      control_retry_all: ctrlRetryAllResult,
      control_high_confidence_only: ctrlHighConfResult,
      control_no_action: ctrlNoActionResult,
    },
    errorInspector: errors,
    timestamp: new Date().toISOString(),
  };
}
