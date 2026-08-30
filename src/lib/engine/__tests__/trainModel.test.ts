/**
 * Unit tests for the RecoverFlow AI Trained Logistic Calibration Model (Milestone 7a).
 *
 * Validates:
 *  1. Determinism: identical training set and hyperparameters produce identical model artifacts.
 *  2. Weight interpretability: category base rate and on-time rate have strong positive weights,
 *     penalties (broken promises, attempts) have negative logit effects.
 *  3. Inference validity: probability outputs bounded in [0, 1], valid 6-factor waterfall.
 *  4. Side-by-side comparison: compareModelCalibration calculates comparative metrics cleanly.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  trainLogisticRecoveryModel,
  scorePaymentWithTrainedModel,
  DEFAULT_TRAINED_MODEL,
  type TrainingSample,
} from '../trainModel';
import { compareModelCalibration } from '../calibration';
import type { FailedPayment } from '@/types';

describe('trainLogisticRecoveryModel', () => {

  // Load 100-record fixture
  const fixturePath = resolve(import.meta.dirname, '../../../../data/synthetic-payments.json');
  const raw = readFileSync(fixturePath, 'utf-8');
  const payments: FailedPayment[] = JSON.parse(raw);

  // Synthesize realistic labels based on category base rates + on-time history
  const syntheticTrainingSet: TrainingSample[] = payments.map((p, idx) => {
    const isRecoverableCategory =
      p.failure_category !== 'permanent_account_closure' &&
      p.failure_category !== 'customer_cancellation';
    const isReliable = p.customer_payment_history.on_time_payment_rate > 0.6;
    const outcome = (isRecoverableCategory && (isReliable || idx % 3 === 0) ? 1 : 0) as 0 | 1;
    return { payment: p, outcome };
  });

  // ── 1. Determinism ───────────────────────────────────────────────

  it('produces 100% deterministic weights across independent training runs', () => {
    const model1 = trainLogisticRecoveryModel(syntheticTrainingSet, { iterations: 100 });
    const model2 = trainLogisticRecoveryModel(syntheticTrainingSet, { iterations: 100 });

    expect(model1.weights).toEqual(model2.weights);
    expect(model1.bias).toBe(model2.bias);
    expect(model1.trainingMetrics.brierScore).toBe(model2.trainingMetrics.brierScore);
  });

  // ── 2. Weight Sanity & Directionality ────────────────────────────

  it('learns logically consistent positive and negative feature weights', () => {
    const model = trainLogisticRecoveryModel(syntheticTrainingSet, { iterations: 300 });

    // Category base rate and on-time rate must have strong positive weights
    expect(model.weights.category_base_rate).toBeGreaterThan(1.0);
    expect(model.weights.on_time_payment_rate).toBeGreaterThan(0.5);

    // Negative penalties must have positive weight multipliers applied to negative feature signals
    expect(model.weights.broken_promises_penalty).toBeGreaterThan(0);
    expect(model.weights.attempt_penalty).toBeGreaterThan(0);
  });

  // ── 3. Inference Validation ──────────────────────────────────────

  it('scores individual payments accurately with structured 6-factor explanations', () => {
    const payment = payments[0];
    const score = scorePaymentWithTrainedModel(payment, DEFAULT_TRAINED_MODEL);

    expect(score.payment_id).toBe(payment.payment_id);
    expect(score.recovery_probability).toBeGreaterThanOrEqual(0.01);
    expect(score.recovery_probability).toBeLessThanOrEqual(0.99);
    expect(score.expected_value).toBeGreaterThan(0);
    expect(score.model_version).toBe('v1.1.0-logistic-calibrated');

    expect(score.explanation).toHaveLength(6);
    for (const factor of score.explanation) {
      expect(factor.factor).toBeDefined();
      expect(factor.label).toBeDefined();
      expect(typeof factor.contribution).toBe('number');
      expect(factor.detail).toBeDefined();
    }
  });

  // ── 4. Side-by-Side Model Comparison (Heuristic vs Trained) ──────

  it('compares Heuristic v1.0.0 vs Trained Logistic v1.1.0 side by side', () => {
    const comparison = compareModelCalibration(payments, {
      budget: 40,
      simulationSeed: 42,
    });

    console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
    console.log('║    RecoverFlow AI — Model Calibration Comparison (Milestone 7a Upgrade)        ║');
    console.log('╠════════════════════════════════════════════════════════════════════════════╣');
    console.log(`║  Metric                       Heuristic (v1.0)     Trained Logistic (v1.1) ║`);
    console.log('╟────────────────────────────────────────────────────────────────────────────╢');
    console.log(`║  Brier Score (Lower is Better)  ${comparison.heuristic.brierScore.toFixed(4).padStart(14)}       ${comparison.trainedLogistic.brierScore.toFixed(4).padStart(20)}    ║`);
    console.log(`║  Calibration Error              ${(comparison.heuristic.overallCalibrationError * 100).toFixed(2).padStart(13)}%      ${(comparison.trainedLogistic.overallCalibrationError * 100).toFixed(2).padStart(19)}%   ║`);
    console.log(`║  Predicted Recovery Rate        ${(comparison.heuristic.predictedRecoveryRate * 100).toFixed(1).padStart(13)}%      ${(comparison.trainedLogistic.predictedRecoveryRate * 100).toFixed(1).padStart(19)}%   ║`);
    console.log(`║  Actual Recovery Rate           ${(comparison.heuristic.actualRecoveryRate * 100).toFixed(1).padStart(13)}%      ${(comparison.trainedLogistic.actualRecoveryRate * 100).toFixed(1).padStart(19)}%   ║`);
    console.log(`║  Recovered Revenue              ₹${(comparison.heuristic.totalRecoveredRevenue / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 }).padStart(13)}      ₹${(comparison.trainedLogistic.totalRecoveredRevenue / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 }).padStart(19)}   ║`);
    console.log(`║  Recovered Invoices Count       ${String(comparison.heuristic.recoveredCount).padStart(14)}       ${String(comparison.trainedLogistic.recoveredCount).padStart(20)}    ║`);
    console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

    expect(comparison.heuristic.modelVersion).toBe('v1.0.0-heuristic');
    expect(comparison.trainedLogistic.modelVersion).toBe('v1.1.0-logistic-calibrated');
    expect(comparison.trainedLogistic.brierScore).toBeLessThan(0.30);
    expect(comparison.trainedLogistic.totalRecoveredRevenue).toBeGreaterThan(0);
  });
});
