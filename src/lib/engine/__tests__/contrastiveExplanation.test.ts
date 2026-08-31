/**
 * PayBack AI — Unit Tests for Contrastive Explanation Engine.
 */

import { describe, test, expect } from 'vitest';
import { generateContrastiveReport } from '@/lib/engine/contrastiveExplanation';
import { runRecoveryBatch } from '@/lib/engine/runBatch';
import { generateSyntheticPayments } from '@/lib/engine/generateData';

describe('generateContrastiveReport', () => {
  const payments = generateSyntheticPayments({ seed: 42, totalRecords: 100 });
  const batchResult = runRecoveryBatch(payments, { budget: 40, simulationSeed: 42 });
  const items = batchResult.executed_items;

  test('picks similar payments with lower scores from the same failure category', () => {
    // Find a high-scoring item in bank_downtime or gateway_degradation
    const targetItem = items.find(
      (i) => i.score.recovery_probability > 0.6 && i.payment.failure_category === 'bank_downtime',
    );

    expect(targetItem).toBeDefined();
    if (!targetItem) return;

    const report = generateContrastiveReport(targetItem, items, 2);
    expect(report.hasComparisons).toBe(true);
    expect(report.comparisons.length).toBeGreaterThanOrEqual(1);

    for (const comp of report.comparisons) {
      // Comparison peer must have a lower score than target
      expect(comp.peerScore).toBeLessThan(targetItem.score.recovery_probability);
      expect(comp.scoreDelta).toBeGreaterThan(0);
      expect(comp.peerPaymentId).not.toBe(targetItem.payment.payment_id);
    }
  });

  test('correctly attributes factor deltas and produces plain English explanation', () => {
    // Pick the top-ranked item
    const topItem = items[0];
    const report = generateContrastiveReport(topItem, items, 2);

    expect(report.hasComparisons).toBe(true);
    const firstComparison = report.comparisons[0];

    expect(firstComparison.plainEnglishSummary).toContain('Ranked higher');
    expect(firstComparison.topDifferentiatingFactors.length).toBeGreaterThan(0);

    // Factor deltas must show valid values
    for (const factor of firstComparison.topDifferentiatingFactors) {
      expect(factor.factor).toBeTruthy();
      expect(factor.label).toBeTruthy();
      expect(typeof factor.delta).toBe('number');
      expect(factor.explanation).toBeTruthy();
    }
  });

  test('handles lowest-scoring payment gracefully when no lower-scored items exist in same category', () => {
    // Find a very low-scoring item (e.g. permanent_account_closure)
    const lowestItem = items.find((i) => i.score.recovery_probability < 0.05);
    expect(lowestItem).toBeDefined();
    if (!lowestItem) return;

    const report = generateContrastiveReport(lowestItem, items, 2);
    // If no peers with meaningfully lower scores exist, report should indicate empty comparisons safely
    expect(Array.isArray(report.comparisons)).toBe(true);
  });
});
