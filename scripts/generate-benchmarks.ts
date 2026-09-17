/**
 * Script: generate-benchmarks.ts
 *
 * Generates frozen, reproducible benchmark datasets for PayBack AI:
 *  1. data/dev-payments-200.json (200 records)
 *  2. data/heldout-adversarial-80.json (80 adversarial boundary records)
 *  3. data/frozen-outcomes-200.json (independent ground-truth outcomes)
 *  4. data/frozen-outcomes-heldout-80.json (independent heldout outcomes)
 *  5. data/benchmarks/benchmark-manifest.json (canonical benchmark manifest)
 */

import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { createHash } from 'crypto';
import {
  generateSyntheticPayments,
  buildFrozenOutcomeEnvironment,
  evaluateCohortPolicies,
} from '@recoverflow/core';
import type { FailedPayment } from '@recoverflow/core';

const rootDir = dirname(import.meta.dirname!);
const dataDir = resolve(rootDir, 'data');
const benchmarksDir = resolve(dataDir, 'benchmarks');
mkdirSync(dataDir, { recursive: true });
mkdirSync(benchmarksDir, { recursive: true });

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

// ── 1. Development Cohort (200 Records) ─────────────────────────────
console.log('Generating 200 development cohort records (seed=101)...');
const devPayments = generateSyntheticPayments({ totalRecords: 200, seed: 101 });
const devPaymentsJson = JSON.stringify(devPayments, null, 2) + '\n';
writeFileSync(resolve(dataDir, 'dev-payments-200.json'), devPaymentsJson, 'utf-8');
const devPaymentsHash = sha256(devPaymentsJson);
console.log(`✓ Saved data/dev-payments-200.json (${devPayments.length} records, SHA: ${devPaymentsHash.slice(0, 12)})`);

// ── 2. Frozen Outcomes for Dev Cohort ───────────────────────────────
const devOutcomesMap = buildFrozenOutcomeEnvironment(devPayments, 202);
const devOutcomes = Array.from(devOutcomesMap.values());
const devOutcomesJson = JSON.stringify(devOutcomes, null, 2) + '\n';
writeFileSync(resolve(dataDir, 'frozen-outcomes-200.json'), devOutcomesJson, 'utf-8');
const devOutcomesHash = sha256(devOutcomesJson);
console.log(`✓ Saved data/frozen-outcomes-200.json (${devOutcomes.length} outcome matrices, SHA: ${devOutcomesHash.slice(0, 12)})`);

// ── 3. Frozen Internal Adversarial Stress Fixture (80 Records) ─────
console.log('\nGenerating 80 internal adversarial stress records (seed=999, start=501)...');
const baseAdversarial = generateSyntheticPayments({ totalRecords: 80, seed: 999, startCounter: 501 });

// Enrich with specific boundary test cases
const adversarialPayments: FailedPayment[] = baseAdversarial.map((p, idx) => {
  const mod: FailedPayment = {
    ...p,
    customer_payment_history: { ...p.customer_payment_history },
  };
  if (idx < 8) {
    mod.opt_out = true;
    mod.raw_gateway_error = 'Customer explicitly opted out of auto-debit recovery';
  } else if (idx < 16) {
    mod.attempt_count = 3;
    mod.raw_gateway_error = 'Exceeded maximum permitted merchant retry threshold';
  } else if (idx < 24) {
    mod.failure_category = 'permanent_account_closure';
    mod.raw_gateway_error = 'BANK_ERR_ACCT_TERMINATED: Account permanently shut';
  } else if (idx < 32) {
    mod.amount = 15_000_000 + idx * 500_000;
    mod.invoice_value_tier = 'high_value';
  } else if (idx < 40) {
    mod.quiet_hours_window = { start: 22, end: 8, timezone: 'Asia/Kolkata' };
  } else if (idx < 48) {
    mod.failure_category = 'broken_promise_to_pay';
    mod.customer_payment_history.broken_promise_count = 3;
    mod.customer_payment_history.on_time_payment_rate = 0.15;
  } else if (idx < 56) {
    mod.failure_category = 'duplicate_attempt';
    mod.raw_gateway_error = 'DUPLICATE_TRANSACTION_ID: Payment captured under sub_ref_8829';
  } else if (idx < 64) {
    mod.failure_category = 'gateway_degradation';
    mod.raw_gateway_error = 'GATEWAY_TIMEOUT_504: Secondary acquirer pipeline degraded';
  } else if (idx < 72) {
    mod.failure_category = 'customer_cancellation';
    mod.raw_gateway_error = 'DISPUTE_RAISED: Cardholder notified issuing bank of unauthorized debit';
  } else {
    mod.failure_category = 'invalid_mandate';
    mod.raw_gateway_error = 'MANDATE_EXPIRED: E-mandate token requires customer re-authorization';
  }
  return mod;
});

const heldoutJson = JSON.stringify(adversarialPayments, null, 2) + '\n';
writeFileSync(resolve(dataDir, 'heldout-adversarial-80.json'), heldoutJson, 'utf-8');
const heldoutHash = sha256(heldoutJson);
console.log(`✓ Saved data/heldout-adversarial-80.json (${adversarialPayments.length} adversarial records, SHA: ${heldoutHash.slice(0, 12)})`);

// ── 4. Frozen Outcomes for Held-Out Cohort ──────────────────────────
const heldoutOutcomesMap = buildFrozenOutcomeEnvironment(adversarialPayments, 777);
const heldoutOutcomes = Array.from(heldoutOutcomesMap.values());
const heldoutOutcomesJson = JSON.stringify(heldoutOutcomes, null, 2) + '\n';
writeFileSync(resolve(dataDir, 'frozen-outcomes-heldout-80.json'), heldoutOutcomesJson, 'utf-8');
const heldoutOutcomesHash = sha256(heldoutOutcomesJson);
console.log(`✓ Saved data/frozen-outcomes-heldout-80.json (${heldoutOutcomes.length} outcome matrices, SHA: ${heldoutOutcomesHash.slice(0, 12)})`);

// ── 5. Generate Canonical Benchmark Manifest ────────────────────────
console.log('\nEvaluating counterfactual benchmarks against frozen environments...');
const weightsPath = resolve(dataDir, 'model-weights.json');
const weightsHash = sha256(readFileSync(weightsPath, 'utf-8'));

const devReport = evaluateCohortPolicies(devPayments, devOutcomesMap, { budget: 40 });
const heldoutReport = evaluateCohortPolicies(adversarialPayments, heldoutOutcomesMap, { budget: 40 });

const manifest = {
  manifest_version: '1.0.0',
  generated_at: new Date().toISOString(),
  environment: 'FROZEN_COUNTERFACTUAL_BENCHMARK',
  invariants: {
    currency_unit: 'INTEGER_PAISE',
    ai_role: 'BOUNDED_ADVISORY_ONLY',
    audit_chain: 'SHA256_APPEND_ONLY',
    test_mode_isolated: true,
  },
  model_metadata: {
    model_name: 'L2_Regularized_Logistic_Recovery_Scorer',
    model_version: '1.0.0',
    weights_sha256: weightsHash,
    features: [
      'category_prior',
      'on_time_ratio',
      'broken_promise_penalty',
      'recency_penalty',
      'tenure_fraction',
      'attempt_penalty',
      'laplace_past_ratio',
    ],
  },
  datasets: [
    {
      id: 'dev_payments_200',
      filename: 'data/dev-payments-200.json',
      record_count: devPayments.length,
      sha256: devPaymentsHash,
      provenance: 'SIMULATED',
      description: '200 synthetic payment failures spanning 10 failure categories for statistical calibration',
    },
    {
      id: 'frozen_outcomes_200',
      filename: 'data/frozen-outcomes-200.json',
      record_count: devOutcomes.length,
      sha256: devOutcomesHash,
      provenance: 'FROZEN_GROUND_TRUTH',
      description: 'Independent ground-truth potential outcome matrices for dev cohort',
    },
    {
      id: 'heldout_adversarial_80',
      filename: 'data/heldout-adversarial-80.json',
      record_count: adversarialPayments.length,
      sha256: heldoutHash,
      provenance: 'SIMULATED_ADVERSARIAL_BOUNDARY',
      description: '80 boundary records targeting opt-outs, max attempts, closed accounts, and high-value approvals',
    },
    {
      id: 'frozen_outcomes_heldout_80',
      filename: 'data/frozen-outcomes-heldout-80.json',
      record_count: heldoutOutcomes.length,
      sha256: heldoutOutcomesHash,
      provenance: 'FROZEN_GROUND_TRUTH',
      description: 'Independent ground-truth potential outcome matrices for heldout cohort',
    },
  ],
  benchmarks: {
    dev_cohort_200: {
      budget_slots: 40,
      total_amount_at_risk_paise: devReport.policies.payback_ai.totalAmountAtRiskPaise,
      policies: {
        payback_ai: devReport.policies.payback_ai,
        control_fixed_retry: devReport.policies.control_fixed_retry,
        control_random_eligible: devReport.policies.control_random_eligible,
        control_highest_amount: devReport.policies.control_highest_amount,
        control_highest_probability: devReport.policies.control_highest_probability,
        control_retry_all: devReport.policies.control_retry_all,
        control_no_action: devReport.policies.control_no_action,
      },
    },
    heldout_adversarial_80: {
      budget_slots: 40,
      total_amount_at_risk_paise: heldoutReport.policies.payback_ai.totalAmountAtRiskPaise,
      policies: {
        payback_ai: heldoutReport.policies.payback_ai,
        control_fixed_retry: heldoutReport.policies.control_fixed_retry,
        control_random_eligible: heldoutReport.policies.control_random_eligible,
        control_highest_amount: heldoutReport.policies.control_highest_amount,
        control_highest_probability: heldoutReport.policies.control_highest_probability,
        control_retry_all: heldoutReport.policies.control_retry_all,
        control_no_action: heldoutReport.policies.control_no_action,
      },
    },
  },
};

const manifestJson = JSON.stringify(manifest, null, 2) + '\n';
const manifestPath = resolve(benchmarksDir, 'benchmark-manifest.json');
writeFileSync(manifestPath, manifestJson, 'utf-8');
console.log(`✓ Saved canonical manifest to data/benchmarks/benchmark-manifest.json (SHA: ${sha256(manifestJson).slice(0, 12)})`);

console.log('\n✅ All benchmark datasets, frozen outcome matrices, and canonical manifest generated successfully.');
