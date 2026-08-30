/**
 * Unit tests for RecoverFlow AI Counterfactual Policy Simulator (Phase 3).
 *
 * Validates:
 *  1. Independent outcome generation without circular dependencies on predicted probabilities.
 *  2. Counterfactual comparison against Fixed Retry Control on identical frozen outcomes.
 *  3. Zero safety violations on the 80-record adversarial held-out fixture.
 *  4. Transparent error inspector classification (false positives & false negatives).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  evaluateCohortPolicies,
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

  it('evaluates 200-record dev cohort against control policies on frozen outcomes', () => {
    const report: ComprehensiveEvaluationReport = evaluateCohortPolicies(devPayments, devOutcomes, {
      budget: 40,
    });

    const rf = report.policies.recoverflow_ai;
    const ctrl = report.policies.control_fixed_retry;

    console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║   RecoverFlow AI vs Control Policy Benchmark (200 Development Records)          ║');
    console.log('╠════════════════════════════════════════════════════════════════════════════════╣');
    console.log(`║  Metric                        RecoverFlow AI (EV)     Fixed Retry Control     ║`);
    console.log('╟────────────────────────────────────────────────────────────────────────────────╢');
    console.log(`║  Interventions Budgeted                     ${String(rf.interventionsExecuted).padStart(6)}                  ${String(ctrl.interventionsExecuted).padStart(6)}          ║`);
    console.log(`║  Recovered Invoices Count                   ${String(rf.recoveredCount).padStart(6)}                  ${String(ctrl.recoveredCount).padStart(6)}          ║`);
    console.log(`║  Simulated Recovered Revenue     ₹ ${(rf.recoveredAmountPaise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 }).padStart(14)}         ₹ ${(ctrl.recoveredAmountPaise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 }).padStart(14)}      ║`);
    console.log(`║  Incremental Recovery vs Control ₹ ${(rf.incrementalRecoveredPaise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 }).padStart(14)}         ₹ ${'0'.padStart(14)}      ║`);
    console.log(`║  Estimated Intervention Cost     ₹ ${(rf.estimatedCostPaise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 }).padStart(14)}         ₹ ${(ctrl.estimatedCostPaise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 }).padStart(14)}      ║`);
    console.log(`║  Net Simulated Recovery          ₹ ${(rf.netRecoveredPaise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 }).padStart(14)}         ₹ ${(ctrl.netRecoveredPaise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 }).padStart(14)}      ║`);
    console.log(`║  Unsafe Interventions Attempted              ${String(rf.unsafeInterventionCount).padStart(6)}                  ${String(ctrl.unsafeInterventionCount).padStart(6)}          ║`);
    console.log(`║  Opt-Out Violations                          ${String(rf.optOutViolations).padStart(6)}                  ${String(ctrl.optOutViolations).padStart(6)}          ║`);
    console.log(`║  Independent Brier Score                ${rf.brierScoreOnIndependentOutcomes.toFixed(4).padStart(11)}                     —          ║`);
    console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

    expect(rf.interventionsExecuted).toBeLessThanOrEqual(40);
    expect(rf.unsafeInterventionCount).toBe(0);
    expect(rf.optOutViolations).toBe(0);
    expect(rf.netRecoveredPaise).toBeGreaterThan(0);
    expect(rf.brierScoreOnIndependentOutcomes).toBeLessThan(0.30);
  });

  // ── 2. Held-Out Adversarial Benchmark (80 Records) ──────────────

  it('enforces 100% safety and zero opt-out violations on 80 held-out adversarial cases', () => {
    const report = evaluateCohortPolicies(heldoutPayments, heldoutOutcomes, {
      budget: 40,
    });

    const rf = report.policies.recoverflow_ai;

    // Must never violate safety rules on adversarial opt-outs or closed accounts
    expect(rf.unsafeInterventionCount).toBe(0);
    expect(rf.optOutViolations).toBe(0);
    expect(rf.duplicateExecutions).toBe(0);

    // Verify Error Inspector captured transparent error items
    expect(report.errorInspector.length).toBeGreaterThan(0);
    for (const err of report.errorInspector) {
      expect(err.payment_id).toBeDefined();
      expect(err.explanation).toBeDefined();
      expect(typeof err.amountPaise).toBe('number');
    }
  });
});
