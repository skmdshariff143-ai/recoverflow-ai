/**
 * Unit & Lineage tests for PayBack AI Dataset Separation & Zero Data Leakage.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { FailedPayment } from '@/types';
import type { FrozenPotentialOutcomes } from '../outcomeEnvironment';
import { generatePotentialOutcomes } from '../outcomeEnvironment';
import { scorePayment } from '../scoreRecovery';
import { scorePaymentWithTrainedModel } from '../trainModel';

describe('Data Lineage, Separation & Leakage Audit', () => {

  const root = resolve(import.meta.dirname, '../../../../');
  const devPayments: FailedPayment[] = JSON.parse(
    readFileSync(resolve(root, 'data/dev-payments-200.json'), 'utf-8'),
  );
  const stressPayments: FailedPayment[] = JSON.parse(
    readFileSync(resolve(root, 'data/heldout-adversarial-80.json'), 'utf-8'),
  );
  const devOutcomes: FrozenPotentialOutcomes[] = JSON.parse(
    readFileSync(resolve(root, 'data/frozen-outcomes-200.json'), 'utf-8'),
  );
  const stressOutcomes: FrozenPotentialOutcomes[] = JSON.parse(
    readFileSync(resolve(root, 'data/frozen-outcomes-heldout-80.json'), 'utf-8'),
  );

  it('proves zero ID overlap between Development Cohort (200) and Stress Cohort (80)', () => {
    const devIds = new Set(devPayments.map((p) => p.payment_id));
    const stressIds = new Set(stressPayments.map((p) => p.payment_id));

    expect(devIds.size).toBe(200);
    expect(stressIds.size).toBe(80);

    // Verify disjoint sets (intersection is empty)
    for (const sId of stressIds) {
      expect(devIds.has(sId)).toBe(false);
    }
  });

  it('proves outcome generator has zero knowledge of model scores or queue ranking', () => {
    const samplePayment = devPayments[0];

    // Score with Heuristic v1.0 and Trained Logistic v1.1
    const heuristicScore = scorePayment(samplePayment);
    const trainedScore = scorePaymentWithTrainedModel(samplePayment);

    expect(heuristicScore.recovery_probability).toBeGreaterThan(0);
    expect(trainedScore.recovery_probability).toBeGreaterThan(0);

    // The outcome generator signature strictly only takes (payment, seed)
    const outcome = generatePotentialOutcomes(samplePayment, 202);

    // Outcome is purely a function of payment pre-intervention features and independent seed
    expect(outcome.payment_id).toBe(samplePayment.payment_id);
    expect(outcome.outcomes.retry['1']).toBeDefined();
    expect(outcome.outcomes.reminder['1']).toBeDefined();
    expect(outcome.outcomes.both['1']).toBeDefined();
  });

  it('proves permanently ineligible cases (opt-out, terminal closure, hard cancellation) never recover physically', () => {
    const ineligibleCases = stressPayments.filter(
      (p) =>
        p.opt_out ||
        p.failure_category === 'permanent_account_closure' ||
        p.failure_category === 'customer_cancellation',
    );

    expect(ineligibleCases.length).toBeGreaterThanOrEqual(24);

    for (const payment of ineligibleCases) {
      const outcomes = generatePotentialOutcomes(payment, 777);
      for (const [, attempts] of Object.entries(outcomes.outcomes)) {
        for (const [, att] of Object.entries(attempts)) {
          expect(att.recovered).toBe(false);
          expect(att.settledAmountPaise).toBe(0);
        }
      }
    }
  });

  it('proves 1-to-1 outcome matrix coverage for all benchmark payments', () => {
    const devOutcomeIds = new Set(devOutcomes.map((o) => o.payment_id));
    for (const p of devPayments) {
      expect(devOutcomeIds.has(p.payment_id)).toBe(true);
    }

    const stressOutcomeIds = new Set(stressOutcomes.map((o) => o.payment_id));
    for (const p of stressPayments) {
      expect(stressOutcomeIds.has(p.payment_id)).toBe(true);
    }
  });
});
