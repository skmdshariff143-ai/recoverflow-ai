/**
 * PayBack AI — Counterfactual Policy Simulator & Independent Evaluation Engine.
 *
 * Evaluates recovery policies against identical frozen ground-truth potential outcomes
 * to calculate true incremental yield, intervention efficiency, and safety compliance.
 *
 * Evaluates 7 comprehensive policies:
 *   1. payback_ai: Expected Value prioritization
 *   2. control_fixed_retry: First-eligible fixed retry
 *   3. control_random_eligible: Random eligible selection (Equal budget)
 *   4. control_highest_amount: Highest gross amount first (Equal budget)
 *   5. control_highest_probability: Highest probability first (Equal budget)
 *   6. control_retry_all: Retry all eligible payments (Unequal budget capacity)
 *   7. control_no_action: 0 interventions baseline
 */

import type { FailedPayment, PipelineOptions } from '@/types';
import { processRecoveryPipeline } from './rankAndAllocate';
import { checkSafetyRules } from './safetyFilter';
import { scorePayment } from './scoreRecovery';
import type { FrozenPotentialOutcomes } from './outcomeEnvironment';
import { sumPaise } from './financial';

export type PolicyType =
  | 'payback_ai'
  | 'control_fixed_retry'
  | 'control_random_eligible'
  | 'control_highest_amount'
  | 'control_highest_probability'
  | 'control_retry_all'
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

export interface MultiSeedBenchmarkDistribution {
  seedsEvaluated: number[];
  recoveredPaise: {
    median: number;
    min: number;
    max: number;
    iqr: number;
    q1: number;
    q3: number;
  };
  recoveredCount: {
    median: number;
    min: number;
    max: number;
  };
  perSeedResults: {
    seed: number;
    recoveredAmountPaise: number;
    recoveredCount: number;
    brierScore: number;
  }[];
}

// Fixed operational intervention cost constants (in integer paise)
const COST_PER_GATEWAY_RETRY_PAISE = 1200; // ₹12.00
const COST_PER_REMINDER_PAISE = 500;       // ₹5.00
const COST_PER_BOTH_PAISE = 1700;           // ₹17.00

/**
 * Execute policy evaluation on a payment cohort with frozen potential outcomes across 7 policies.
 */
export function evaluateCohortPolicies(
  payments: FailedPayment[],
  frozenOutcomes: Map<string, FrozenPotentialOutcomes>,
  options: PipelineOptions = {},
): ComprehensiveEvaluationReport {
  const budget = options.budget ?? 40;
  const refDate = options.referenceDate ?? new Date('2025-08-30T10:00:00Z');
  const totalAmountAtRiskPaise = sumPaise(payments.map((p) => p.amount));

  // ── 1. PayBack AI Dynamic Prioritization Policy ─────────────────
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

  // Pre-filter eligible payments
  const eligiblePayments = payments.filter((p) => checkSafetyRules(p).eligible);
  const eligibleCount = eligiblePayments.length;

  // ── 2. Control Policy: Fixed Retry (First N eligible) ──────────────
  let ctrlRecoveredPaise = 0;
  let ctrlInterventions = 0;
  let ctrlCostPaise = 0;
  let ctrlRecoveredCount = 0;

  for (const payment of eligiblePayments.slice(0, budget)) {
    ctrlInterventions++;
    ctrlCostPaise += COST_PER_GATEWAY_RETRY_PAISE;
    const outcome = frozenOutcomes.get(payment.payment_id)?.outcomes['retry']?.[1];
    if (outcome?.recovered) {
      ctrlRecoveredPaise += payment.amount;
      ctrlRecoveredCount++;
    }
  }

  // ── 3. Control Policy: Random Eligible Selection ───────────────────
  let randomRecoveredPaise = 0;
  let randomInterventions = 0;
  let randomCostPaise = 0;
  let randomRecoveredCount = 0;

  // Deterministic pseudo-random stride across eligible payments
  const randomSample = eligiblePayments
    .map((p, idx) => ({ p, weight: (idx * 37 + 13) % 100 }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, budget)
    .map((item) => item.p);

  for (const payment of randomSample) {
    randomInterventions++;
    randomCostPaise += COST_PER_GATEWAY_RETRY_PAISE;
    const outcome = frozenOutcomes.get(payment.payment_id)?.outcomes['retry']?.[1];
    if (outcome?.recovered) {
      randomRecoveredPaise += payment.amount;
      randomRecoveredCount++;
    }
  }

  // ── 4. Control Policy: Highest Amount First ────────────────────────
  let highAmountRecoveredPaise = 0;
  let highAmountInterventions = 0;
  let highAmountCostPaise = 0;
  let highAmountRecoveredCount = 0;

  const highestAmountSample = [...eligiblePayments]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, budget);

  for (const payment of highestAmountSample) {
    highAmountInterventions++;
    highAmountCostPaise += COST_PER_GATEWAY_RETRY_PAISE;
    const outcome = frozenOutcomes.get(payment.payment_id)?.outcomes['retry']?.[1];
    if (outcome?.recovered) {
      highAmountRecoveredPaise += payment.amount;
      highAmountRecoveredCount++;
    }
  }

  // ── 5. Control Policy: Highest Probability First ───────────────────
  let highProbRecoveredPaise = 0;
  let highProbInterventions = 0;
  let highProbCostPaise = 0;
  let highProbRecoveredCount = 0;

  const highestProbSample = [...eligiblePayments]
    .map((p) => ({ p, score: scorePayment(p) }))
    .sort((a, b) => b.score.recovery_probability - a.score.recovery_probability)
    .slice(0, budget)
    .map((item) => item.p);

  for (const payment of highestProbSample) {
    highProbInterventions++;
    highProbCostPaise += COST_PER_GATEWAY_RETRY_PAISE;
    const outcome = frozenOutcomes.get(payment.payment_id)?.outcomes['retry']?.[1];
    if (outcome?.recovered) {
      highProbRecoveredPaise += payment.amount;
      highProbRecoveredCount++;
    }
  }

  // ── 6. Control Policy: Retry-All (Unbounded Budget) ─────────────────
  let retryAllRecoveredPaise = 0;
  let retryAllInterventions = 0;
  let retryAllCostPaise = 0;
  let retryAllRecoveredCount = 0;

  for (const payment of eligiblePayments) {
    retryAllInterventions++;
    retryAllCostPaise += COST_PER_GATEWAY_RETRY_PAISE;
    const outcome = frozenOutcomes.get(payment.payment_id)?.outcomes['retry']?.[1];
    if (outcome?.recovered) {
      retryAllRecoveredPaise += payment.amount;
      retryAllRecoveredCount++;
    }
  }

  // Build Structured Policy Results
  const buildPolicyResult = (
    policy: PolicyType,
    name: string,
    interventions: number,
    recoveredAmount: number,
    recoveredCnt: number,
    costPaise: number,
    brier: number = 0,
    unsafeCnt: number = 0,
    optOutCnt: number = 0,
  ): PolicyEvaluationResult => ({
    policy,
    policyName: name,
    recordsProcessed: payments.length,
    eligibleRecords: eligibleCount,
    interventionsExecuted: interventions,
    totalAmountAtRiskPaise,
    recoveredAmountPaise: recoveredAmount,
    incrementalRecoveredPaise: recoveredAmount - ctrlRecoveredPaise,
    countRecoveryRatePercent: Number(((recoveredCnt / Math.max(1, interventions)) * 100).toFixed(1)),
    amountRecoveryRatePercent: Number(((recoveredAmount / totalAmountAtRiskPaise) * 100).toFixed(1)),
    recoveredCount: recoveredCnt,
    unsafeInterventionCount: unsafeCnt,
    optOutViolations: optOutCnt,
    duplicateExecutions: 0,
    estimatedCostPaise: costPaise,
    netRecoveredPaise: recoveredAmount - costPaise,
    falsePositiveCount: policy === 'payback_ai' ? errors.filter((e) => e.errorType === 'false_positive').length : 0,
    falsePositiveExposurePaise: policy === 'payback_ai' ? sumPaise(errors.filter((e) => e.errorType === 'false_positive').map((e) => e.amountPaise)) : 0,
    falseNegativeCount: policy === 'payback_ai' ? errors.filter((e) => e.errorType === 'false_negative').length : 0,
    unnecessaryInterventionRatePercent: Number((((interventions - recoveredCnt) / Math.max(1, interventions)) * 100).toFixed(1)),
    brierScoreOnIndependentOutcomes: brier,
  });

  return {
    datasetName: payments.length === 200 ? 'Development Cohort (200 Records)' : 'Held-Out Adversarial (80 Records)',
    recordCount: payments.length,
    policies: {
      payback_ai: buildPolicyResult(
        'payback_ai',
        'PayBack AI (EV Prioritization)',
        rfInterventions,
        rfRecoveredPaise,
        rfRecoveredCount,
        rfCostPaise,
        Number((rfBrierSum / Math.max(1, rfBrierCount)).toFixed(4)),
        rfUnsafe,
        rfOptOutViolations,
      ),
      control_fixed_retry: buildPolicyResult(
        'control_fixed_retry',
        'Fixed Retry Control (First 40 Eligible)',
        ctrlInterventions,
        ctrlRecoveredPaise,
        ctrlRecoveredCount,
        ctrlCostPaise,
      ),
      control_random_eligible: buildPolicyResult(
        'control_random_eligible',
        'Random Selection Control (40 Slots)',
        randomInterventions,
        randomRecoveredPaise,
        randomRecoveredCount,
        randomCostPaise,
      ),
      control_highest_amount: buildPolicyResult(
        'control_highest_amount',
        'Highest Amount First Control (40 Slots)',
        highAmountInterventions,
        highAmountRecoveredPaise,
        highAmountRecoveredCount,
        highAmountCostPaise,
      ),
      control_highest_probability: buildPolicyResult(
        'control_highest_probability',
        'Highest Probability First Control (40 Slots)',
        highProbInterventions,
        highProbRecoveredPaise,
        highProbRecoveredCount,
        highProbCostPaise,
      ),
      control_retry_all: buildPolicyResult(
        'control_retry_all',
        'Retry-All Control (Unbounded / Unequal Capacity)',
        retryAllInterventions,
        retryAllRecoveredPaise,
        retryAllRecoveredCount,
        retryAllCostPaise,
      ),
      control_no_action: buildPolicyResult(
        'control_no_action',
        'No-Action Baseline (0 Interventions)',
        0,
        0,
        0,
        0,
      ),
    },
    errorInspector: errors,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Multi-seed statistical evaluation distribution helper.
 */
export function evaluateMultiSeedDistribution(
  payments: FailedPayment[],
  frozenOutcomes: Map<string, FrozenPotentialOutcomes>,
  seeds: number[] = [42, 101, 202, 303, 404, 505, 999],
): MultiSeedBenchmarkDistribution {
  const results = seeds.map((seed) => {
    const report = evaluateCohortPolicies(payments, frozenOutcomes, { simulationSeed: seed });
    const rf = report.policies.payback_ai;
    return {
      seed,
      recoveredAmountPaise: rf.recoveredAmountPaise,
      recoveredCount: rf.recoveredCount,
      brierScore: rf.brierScoreOnIndependentOutcomes,
    };
  });

  const amounts = [...results.map((r) => r.recoveredAmountPaise)].sort((a, b) => a - b);
  const counts = [...results.map((r) => r.recoveredCount)].sort((a, b) => a - b);

  const getPercentile = (arr: number[], p: number) => {
    const idx = (arr.length - 1) * p;
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    const weight = idx - lower;
    return Math.round(arr[lower] * (1 - weight) + arr[upper] * weight);
  };

  const q1 = getPercentile(amounts, 0.25);
  const median = getPercentile(amounts, 0.50);
  const q3 = getPercentile(amounts, 0.75);

  return {
    seedsEvaluated: seeds,
    recoveredPaise: {
      median,
      min: amounts[0],
      max: amounts[amounts.length - 1],
      q1,
      q3,
      iqr: q3 - q1,
    },
    recoveredCount: {
      median: counts[Math.floor(counts.length / 2)],
      min: counts[0],
      max: counts[counts.length - 1],
    },
    perSeedResults: results,
  };
}
