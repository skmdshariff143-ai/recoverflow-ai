import { describe, it, expect } from 'vitest';
import {
  computeECE,
  computeLogLoss,
  computeCalibrationSlopeAndIntercept,
} from '@recoverflow/core';

describe('Statistical Model Calibration Metrics (ECE, MCE, LogLoss, Slope/Intercept)', () => {
  it('Calculates near-zero ECE and MCE on perfectly calibrated synthetic distributions', () => {
    // Generate 1000 samples where P(y=1|p) = p
    const predictions: number[] = [];
    const outcomes: number[] = [];

    for (let i = 0; i < 1000; i++) {
      const p = (i % 10) / 10 + 0.05; // 0.05, 0.15, ... 0.95
      predictions.push(p);
      outcomes.push(Math.random() < p ? 1 : 0);
    }

    const { ece, mce, bins } = computeECE(predictions, outcomes, 10);
    expect(ece).toBeLessThan(0.08); // Close to 0 with finite-sample variance
    expect(mce).toBeLessThanOrEqual(0.18);
    expect(bins.length).toBe(10);
  });

  it('Calculates high ECE on deliberately miscalibrated overconfident predictions', () => {
    // Predicts 0.90 for everything, but actual outcome rate is only 0.20
    const predictions = Array(100).fill(0.9);
    const outcomes = Array(100).fill(0).map((_, i) => (i < 20 ? 1 : 0));

    const { ece, mce } = computeECE(predictions, outcomes, 10);
    expect(ece).toBeGreaterThanOrEqual(0.69);
    expect(mce).toBeGreaterThanOrEqual(0.69);
  });

  it('Calculates binary cross-entropy log loss correctly', () => {
    // Perfect confident predictions
    const loss1 = computeLogLoss([0.99, 0.01], [1, 0]);
    expect(loss1).toBeLessThan(0.05);

    // Completely wrong predictions
    const loss2 = computeLogLoss([0.01, 0.99], [1, 0]);
    expect(loss2).toBeGreaterThan(4.0);
  });

  it('Calculates calibration slope and intercept', () => {
    const preds = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    const acts = [0, 0, 0, 0, 1, 1, 1, 1, 1];
    const { slope, intercept } = computeCalibrationSlopeAndIntercept(preds, acts);
    expect(slope).toBeGreaterThan(0);
    expect(typeof intercept).toBe('number');
  });
});
