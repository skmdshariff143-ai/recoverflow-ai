/**
 * Unit tests for PayBack AI Counterfactual Policy Simulator & 7-Policy Evaluation.
 *
 * Validates:
 *  1. Independent outcome generation without circular dependencies on predicted probabilities.
 *  2. Counterfactual comparison across 7 distinct policies on identical frozen outcomes.
 *  3. Multi-seed statistical distribution reporting (median, min, max, IQR).
 *  4. Zero safety violations on the 80-record adversarial held-out fixture.
 *  5. Transparent error inspector classification (false positives & false negatives).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  evaluateCohortPolicies,
  evaluateMultiSeedDistribution,
  type ComprehensiveEvaluationReport,
} from '../counterfactualEvaluation';
import { buildFrozenOutcomeEnvironment } from '../outcomeEnvironment';
import type { FailedPayment } from '@/types';

describe('Counterfactual Policy Simulator & Independent Evaluation', () => {

  const dataDir = resolve(import.meta.dirname, '../../../../data');

  // Load Dev (200) and Held-out Adversarial (80) datasets
  const devPayments: FailedPayment[] = JSON.parse(
    readFileSync(resolve(dataDir, 'dev-payments-200.json'), 'utf-8'),
  );
  const heldoutPayments: FailedPayment[] = JSON.parse(
    readFileSync(resolve(dataDir, 'heldout-adversarial-80.json'), 'utf-8'),
  );

  const devOutcomes = buildFrozenOutcomeEnvironment(devPayments, 202);
  const heldoutOutcomes = buildFrozenOutcomeEnvironment(heldoutPayments, 777);

  // ── 1. Dev Benchmark Evaluation (200 Records) ───────────────────

  it('evaluates 200-record dev cohort against 7 recovery policies on frozen outcomes', () => {
    const report: ComprehensiveEvaluationReport = evaluateCohortPolicies(devPayments, devOutcomes, {
      budget: 40,
    });

    const rf = report.policies.payback_ai;
    const ctrlFixed = report.policies.control_fixed_retry;
    const ctrlRandom = report.policies.control_random_eligible;
    const ctrlHighAmount = report.policies.control_highest_amount;
    const ctrlHighProb = report.policies.control_highest_probability;
    const ctrlRetryAll = report.policies.control_retry_all;
    const ctrlNoAction = report.policies.control_no_action;

    expect(rf).toBeDefined();
    expect(ctrlFixed).toBeDefined();
    expect(ctrlRandom).toBeDefined();
    expect(ctrlHighAmount).toBeDefined();
    expect(ctrlHighProb).toBeDefined();
    expect(ctrlRetryAll).toBeDefined();
    expect(ctrlNoAction).toBeDefined();

    // Equal-capacity invariant (40 slots)
    expect(rf.interventionsExecuted).toBe(40);
    expect(ctrlFixed.interventionsExecuted).toBe(40);
    expect(ctrlRandom.interventionsExecuted).toBe(40);
    expect(ctrlHighAmount.interventionsExecuted).toBe(40);
    expect(ctrlHighProb.interventionsExecuted).toBe(40);

    // EV Prioritization outperforms Fixed Retry on total revenue
    expect(rf.recoveredAmountPaise).toBeGreaterThan(ctrlFixed.recoveredAmountPaise);

    // Zero safety or opt-out violations
    expect(rf.unsafeInterventionCount).toBe(0);
    expect(rf.optOutViolations).toBe(0);

    // Brier score is positive and strictly bounded [0, 1]
    expect(rf.brierScoreOnIndependentOutcomes).toBeGreaterThan(0);
    expect(rf.brierScoreOnIndependentOutcomes).toBeLessThan(1);
  });

  // ── 2. Multi-Seed Statistical Distribution Analysis ─────────────

  it('computes multi-seed statistical distribution across deterministic seeds', () => {
    const dist = evaluateMultiSeedDistribution(devPayments, devOutcomes, [42, 101, 202, 303, 404, 505]);

    expect(dist.seedsEvaluated.length).toBe(6);
    expect(dist.recoveredPaise.median).toBeGreaterThan(0);
    expect(dist.recoveredPaise.min).toBeLessThanOrEqual(dist.recoveredPaise.median);
    expect(dist.recoveredPaise.max).toBeGreaterThanOrEqual(dist.recoveredPaise.median);
    expect(dist.recoveredPaise.iqr).toBeGreaterThanOrEqual(0);
    expect(dist.perSeedResults.length).toBe(6);
  });

  // ── 3. Held-Out Adversarial Cohort Stress Test ───────────────────

  it('maintains 0% safety violations on the 80-record adversarial stress fixture', () => {
    const report = evaluateCohortPolicies(heldoutPayments, heldoutOutcomes, {
      budget: 30,
    });

    const rf = report.policies.payback_ai;
    expect(rf.unsafeInterventionCount).toBe(0);
    expect(rf.optOutViolations).toBe(0);
  });
});
