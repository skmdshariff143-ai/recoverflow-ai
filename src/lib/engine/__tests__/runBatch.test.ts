/**
 * Unit & Integration tests for the PayBack AI Full Batch Orchestrator.
 *
 * Validates:
 *  1. End-to-end execution of the full 100-record fixture.
 *  2. Conservation of financial totals: total_revenue_recovered <= total_revenue_at_risk.
 *  3. Full calibration report generation (predicted vs actual, category breakdown, Brier score).
 *  4. Deterministic reproducibility when rerun with same seed.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { runRecoveryBatch } from '../runBatch';
import type { FailedPayment } from '@/types';

describe('runRecoveryBatch', () => {

  it('runs complete 100-record fixture end-to-end and outputs full calibration metrics', () => {
    const fixturePath = resolve(import.meta.dirname, '../../../../data/synthetic-payments.json');
    const raw = readFileSync(fixturePath, 'utf-8');
    const payments: FailedPayment[] = JSON.parse(raw);

    const result = runRecoveryBatch(payments, {
      budget: 40,
      simulationSeed: 42,
      disputeRate: 0.03,
    });

    console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
    console.log('║        PayBack AI — Empirical Batch Recovery & Calibration Results         ║');
    console.log('╠════════════════════════════════════════════════════════════════════════════╣');
    console.log(`║  Total Revenue at Risk:           ₹${(result.total_revenue_at_risk / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 }).padStart(18)}                  ║`);
    console.log(`║  Total Revenue Recovered:         ₹${(result.total_revenue_recovered / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 }).padStart(18)}                  ║`);
    console.log(`║  Overall Recovery Rate (Batch):     ${(result.overall_recovery_rate * 100).toFixed(1).padStart(18)}%                 ║`);
    console.log(`║  Predicted Recovery Rate (Budget):  ${(result.calibration.overall_predicted_rate * 100).toFixed(1).padStart(18)}%                 ║`);
    console.log(`║  Actual Recovery Rate (Budget):     ${(result.calibration.overall_actual_rate * 100).toFixed(1).padStart(18)}%                 ║`);
    console.log(`║  Overall Calibration Error:         ${(result.calibration.overall_calibration_error * 100).toFixed(2).padStart(18)}%                 ║`);
    console.log(`║  Brier Score (0 = Perfect Calib):   ${result.calibration.brier_score.toFixed(4).padStart(18)}                   ║`);
    console.log('╠════════════════════════════════════════════════════════════════════════════╣');
    console.log('║  Category-Level Calibration Breakdown (Budgeted Cohort):                  ║');
    console.log('║  Category                Budgeted   Recovered   Predicted   Actual   Error║');
    console.log('╟────────────────────────────────────────────────────────────────────────────╢');
    for (const cat of result.calibration.category_metrics) {
      const name = cat.category.padEnd(24);
      const bud = String(cat.budgeted_count).padStart(8);
      const rec = String(cat.recovered_count).padStart(11);
      const pred = `${(cat.predicted_recovery_rate * 100).toFixed(1)}%`.padStart(11);
      const act = `${(cat.actual_recovery_rate * 100).toFixed(1)}%`.padStart(8);
      const err = `${(cat.calibration_error * 100).toFixed(1)}%`.padStart(7);
      console.log(`║  ${name} ${bud} ${rec} ${pred} ${act} ${err}║`);
    }
    console.log('╠════════════════════════════════════════════════════════════════════════════╣');
    console.log('║  5-Bin Probability Reliability Diagram Breakdown:                          ║');
    console.log('║  Probability Bin         Samples   Predicted Avg   Actual Rate   Error     ║');
    console.log('╟────────────────────────────────────────────────────────────────────────────╢');
    for (const bin of result.calibration.binned_metrics) {
      const label = bin.bin_label.padEnd(20);
      const samples = String(bin.sample_count).padStart(7);
      const pred = `${(bin.avg_predicted_prob * 100).toFixed(1)}%`.padStart(15);
      const act = `${(bin.actual_recovery_rate * 100).toFixed(1)}%`.padStart(13);
      const err = `${(bin.calibration_error * 100).toFixed(1)}%`.padStart(9);
      console.log(`║  ${label} ${samples} ${pred} ${act} ${err}     ║`);
    }
    console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

    // Asserts
    expect(result.summary.total_payments).toBe(100);
    expect(result.executed_items).toHaveLength(100);
    expect(result.total_revenue_recovered).toBeGreaterThan(0);
    expect(result.total_revenue_recovered).toBeLessThanOrEqual(result.total_revenue_at_risk);
    expect(result.calibration.brier_score).toBeLessThan(0.30); // Valid statistical calibration bound
    expect(result.calibration.category_metrics.length).toBeGreaterThan(0);
    expect(result.calibration.binned_metrics).toHaveLength(5);
  });

  it('same seed produces identical batch results', () => {
    const fixturePath = resolve(import.meta.dirname, '../../../../data/synthetic-payments.json');
    const raw = readFileSync(fixturePath, 'utf-8');
    const payments: FailedPayment[] = JSON.parse(raw);

    const r1 = runRecoveryBatch(payments, { simulationSeed: 99 });
    const r2 = runRecoveryBatch(payments, { simulationSeed: 99 });

    expect(r1.total_revenue_recovered).toBe(r2.total_revenue_recovered);
    expect(r1.overall_recovery_rate).toBe(r2.overall_recovery_rate);
    expect(r1.calibration.brier_score).toBe(r2.calibration.brier_score);
  });
});
