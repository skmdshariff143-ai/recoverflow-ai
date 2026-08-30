/**
 * Script: generate-benchmarks.ts
 *
 * Generates frozen, reproducible benchmark datasets for PayBack AI:
 *  1. data/dev-payments-200.json (200 records)
 *  2. data/heldout-adversarial-80.json (80 adversarial boundary records)
 *  3. data/frozen-outcomes-200.json (independent ground-truth outcomes)
 *  4. data/frozen-outcomes-heldout-80.json (independent heldout outcomes)
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { generateSyntheticPayments } from '../src/lib/engine/generateData';
import { buildFrozenOutcomeEnvironment } from '../src/lib/engine/outcomeEnvironment';
import type { FailedPayment } from '../src/types/payment';

const dataDir = resolve(dirname(import.meta.dirname!), 'data');
mkdirSync(dataDir, { recursive: true });

// ── 1. Development Cohort (200 Records) ─────────────────────────────
console.log('Generating 200 development cohort records (seed=101)...');
const devPayments = generateSyntheticPayments({ totalRecords: 200, seed: 101 });
writeFileSync(
  resolve(dataDir, 'dev-payments-200.json'),
  JSON.stringify(devPayments, null, 2) + '\n',
  'utf-8',
);
console.log(`✓ Saved data/dev-payments-200.json (${devPayments.length} records)`);

// ── 2. Frozen Outcomes for Dev Cohort ───────────────────────────────
const devOutcomesMap = buildFrozenOutcomeEnvironment(devPayments, 202);
const devOutcomes = Array.from(devOutcomesMap.values());
writeFileSync(
  resolve(dataDir, 'frozen-outcomes-200.json'),
  JSON.stringify(devOutcomes, null, 2) + '\n',
  'utf-8',
);
console.log(`✓ Saved data/frozen-outcomes-200.json (${devOutcomes.length} outcome matrices)`);

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
    // Boundary 1: Customer Opt-Out
    mod.opt_out = true;
    mod.raw_gateway_error = 'Customer explicitly opted out of auto-debit recovery';
  } else if (idx < 16) {
    // Boundary 2: Max Attempts Exceeded (Hard Cap = 3)
    mod.attempt_count = 3;
    mod.raw_gateway_error = 'Exceeded maximum permitted merchant retry threshold';
  } else if (idx < 24) {
    // Boundary 3: Permanent Account Closure
    mod.failure_category = 'permanent_account_closure';
    mod.raw_gateway_error = 'BANK_ERR_ACCT_TERMINATED: Account permanently shut';
  } else if (idx < 32) {
    // Boundary 4: High Value Enterprise Invoices (> ₹1,00,000 requiring approval)
    mod.amount = 15_000_000 + idx * 500_000; // ₹1.5L to ₹1.9L in paise
    mod.invoice_value_tier = 'high_value';
  } else if (idx < 40) {
    // Boundary 5: Active Quiet Hours (simulate customer local time in quiet window)
    mod.quiet_hours_window = { start: 22, end: 8, timezone: 'Asia/Kolkata' };
  } else if (idx < 48) {
    // Boundary 6: Broken Promise-to-Pay Chronic Defaulter
    mod.failure_category = 'broken_promise_to_pay';
    mod.customer_payment_history.broken_promise_count = 3;
    mod.customer_payment_history.on_time_payment_rate = 0.15;
  } else if (idx < 56) {
    // Boundary 7: Duplicate Gateway Event Ingestion (same idempotency reference)
    mod.failure_category = 'duplicate_attempt';
    mod.raw_gateway_error = 'DUPLICATE_TRANSACTION_ID: Payment captured under sub_ref_8829';
  } else if (idx < 64) {
    // Boundary 8: Transient Gateway Degradation Spike
    mod.failure_category = 'gateway_degradation';
    mod.raw_gateway_error = 'GATEWAY_TIMEOUT_504: Secondary acquirer pipeline degraded';
  } else if (idx < 72) {
    // Boundary 9: Disputed / Fraud-Flagged Payment
    mod.failure_category = 'customer_cancellation';
    mod.raw_gateway_error = 'DISPUTE_RAISED: Cardholder notified issuing bank of unauthorized debit';
  } else {
    // Boundary 10: Expired Mandate Friction
    mod.failure_category = 'invalid_mandate';
    mod.raw_gateway_error = 'MANDATE_EXPIRED: E-mandate token requires customer re-authorization';
  }
  return mod;
});

writeFileSync(
  resolve(dataDir, 'heldout-adversarial-80.json'),
  JSON.stringify(adversarialPayments, null, 2) + '\n',
  'utf-8',
);
console.log(`✓ Saved data/heldout-adversarial-80.json (${adversarialPayments.length} adversarial records)`);

// ── 4. Frozen Outcomes for Held-Out Cohort ──────────────────────────
const heldoutOutcomesMap = buildFrozenOutcomeEnvironment(adversarialPayments, 777);
const heldoutOutcomes = Array.from(heldoutOutcomesMap.values());
writeFileSync(
  resolve(dataDir, 'frozen-outcomes-heldout-80.json'),
  JSON.stringify(heldoutOutcomes, null, 2) + '\n',
  'utf-8',
);
console.log(`✓ Saved data/frozen-outcomes-heldout-80.json (${heldoutOutcomes.length} outcome matrices)`);
console.log('\n✅ All benchmark datasets and frozen outcome matrices generated successfully.');
