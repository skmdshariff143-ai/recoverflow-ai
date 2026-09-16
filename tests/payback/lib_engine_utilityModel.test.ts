import { describe, it, expect } from 'vitest';
import { ExpectedValueUtilityModel, RiskAdjustedUtilityModel } from '@recoverflow/core';
import { generateSyntheticPayments } from '@recoverflow/core';

describe('Utility Model Abstraction & Optimization Tests', () => {
  const payment = generateSyntheticPayments({ seed: 42, totalRecords: 10 })[0];

  it('Calculates baseline expected value utility without speculative multipliers', () => {
    const model = new ExpectedValueUtilityModel();
    const score = model.score({
      payment,
      predictedProbability: 0.8,
      selectedIntervention: 'retry',
    });

    expect(score.utilityPaise).toBeGreaterThan(0);
    expect(score.expectedRecoveredPaise).toBe(Math.round(payment.amount * 0.8));
    expect(score.interventionCostPaise).toBe(250);
    expect(score.isActionable).toBe(true);
  });

  it('Calculates risk-adjusted utility with dispute cost penalties', () => {
    const model = new RiskAdjustedUtilityModel(2.0, 0.05);
    const score = model.score({
      payment,
      predictedProbability: 0.8,
      selectedIntervention: 'both',
      disputeRiskRate: 0.05,
    });

    expect(score.disputePenaltyPaise).toBeGreaterThan(0);
    expect(score.utilityPaise).toBeLessThan(score.expectedRecoveredPaise);
  });

  it('Flags zero-probability and non-recoverable interventions as non-actionable', () => {
    const model = new ExpectedValueUtilityModel();
    const score = model.score({
      payment,
      predictedProbability: 0.0,
      selectedIntervention: 'none',
    });

    expect(score.isActionable).toBe(false);
    expect(score.utilityPaise).toBe(0);
  });
});
