/**
 * PayBack AI — Single Source of Truth Benchmark Data Layer.
 *
 * Imports checked-in, schema-verified benchmark datasets and frozen outcome
 * matrices directly, guaranteeing that the live UI evaluates the exact same
 * artifacts verified by CI.
 */

import devPaymentsRaw from '../../../data/dev-payments-200.json';
import stressPaymentsRaw from '../../../data/heldout-adversarial-80.json';
import devOutcomesRaw from '../../../data/frozen-outcomes-200.json';
import stressOutcomesRaw from '../../../data/frozen-outcomes-heldout-80.json';

import type { FailedPayment } from '@/types';
import type { FrozenPotentialOutcomes } from '../engine/outcomeEnvironment';

export interface DatasetMetadata {
  id: 'dev_benchmark_200' | 'adversarial_stress_80';
  name: string;
  badgeLabel: string;
  recordCount: number;
  sha256Prefix: string;
  sourceFile: string;
  outcomesFile: string;
  generatorVersion: string;
  policyVersion: string;
  provenanceDisclosure: string;
}

export const DATASET_METADATA: Record<'dev' | 'adversarial_stress', DatasetMetadata> = {
  dev: {
    id: 'dev_benchmark_200',
    name: 'Development Benchmark Cohort (200 Records)',
    badgeLabel: 'Development Cohort',
    recordCount: 200,
    sha256Prefix: '6e1da848473e',
    sourceFile: 'data/dev-payments-200.json',
    outcomesFile: 'data/frozen-outcomes-200.json',
    generatorVersion: 'v2.1.0-deterministic',
    policyVersion: 'v1.1.0-logistic-calibrated',
    provenanceDisclosure: 'Pre-generated synthetic cohort across 10 failure categories for statistical calibration.',
  },
  adversarial_stress: {
    id: 'adversarial_stress_80',
    name: 'Frozen Internal Adversarial Stress Fixture (80 Records)',
    badgeLabel: 'Internal Stress Fixture',
    recordCount: 80,
    sha256Prefix: '8d99ef8e9f6f',
    sourceFile: 'data/heldout-adversarial-80.json',
    outcomesFile: 'data/frozen-outcomes-heldout-80.json',
    generatorVersion: 'v2.1.0-deterministic',
    policyVersion: 'v1.1.0-logistic-calibrated',
    provenanceDisclosure: 'Internally authored boundary stress fixture targeting opt-outs, max attempts, closed accounts, and high-value approvals.',
  },
};

export function loadDevelopmentBenchmark(): {
  payments: FailedPayment[];
  outcomesMap: Map<string, FrozenPotentialOutcomes>;
  metadata: DatasetMetadata;
} {
  const payments = devPaymentsRaw as unknown as FailedPayment[];
  const outcomesList = devOutcomesRaw as unknown as FrozenPotentialOutcomes[];
  const outcomesMap = new Map<string, FrozenPotentialOutcomes>();
  for (const o of outcomesList) {
    outcomesMap.set(o.payment_id, o);
  }

  return {
    payments,
    outcomesMap,
    metadata: DATASET_METADATA.dev,
  };
}

export function loadAdversarialStressFixture(): {
  payments: FailedPayment[];
  outcomesMap: Map<string, FrozenPotentialOutcomes>;
  metadata: DatasetMetadata;
} {
  const payments = stressPaymentsRaw as unknown as FailedPayment[];
  const outcomesList = stressOutcomesRaw as unknown as FrozenPotentialOutcomes[];
  const outcomesMap = new Map<string, FrozenPotentialOutcomes>();
  for (const o of outcomesList) {
    outcomesMap.set(o.payment_id, o);
  }

  return {
    payments,
    outcomesMap,
    metadata: DATASET_METADATA.adversarial_stress,
  };
}
