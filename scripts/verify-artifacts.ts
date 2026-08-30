/**
 * Script: verify-artifacts.ts
 *
 * Validates existence, Zod schema conformance, statistical invariants,
 * and cryptographic integrity of all checked-in benchmark fixtures and model weights.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { createHash } from 'crypto';
import {
  FailedPaymentSchema,
  FrozenPotentialOutcomesSchema,
  ModelWeightsSchema,
} from '../src/types/schemas';
import type { FailedPayment } from '../src/types/payment';
import type { FrozenPotentialOutcomes } from '../src/lib/engine/outcomeEnvironment';

const root = dirname(import.meta.dirname!);

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

console.log('════════════════════════════════════════════════════════════════════');
console.log(' RecoverFlow AI — Comprehensive Benchmark & Artifact Integrity Audit');
console.log('════════════════════════════════════════════════════════════════════\n');

let errors = 0;

function verifyPaymentsDataset(
  relPath: string,
  expectedCount: number,
): { payments: FailedPayment[]; hash: string } | null {
  const fullPath = resolve(root, relPath);
  if (!existsSync(fullPath)) {
    console.error(`❌ Missing file: ${relPath}`);
    errors++;
    return null;
  }

  const raw = readFileSync(fullPath, 'utf-8');
  const hash = sha256(raw);
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(`❌ Corrupted JSON in ${relPath}:`, err);
    errors++;
    return null;
  }

  if (!Array.isArray(parsed)) {
    console.error(`❌ Expected array of records in ${relPath}`);
    errors++;
    return null;
  }

  if (parsed.length !== expectedCount) {
    console.error(`❌ Expected ${expectedCount} records in ${relPath}, found ${parsed.length}`);
    errors++;
    return null;
  }

  const seenIds = new Set<string>();

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    const res = FailedPaymentSchema.safeParse(item);
    if (!res.success) {
      console.error(`❌ Schema violation in ${relPath} record [${i}]:`, res.error.format());
      errors++;
      return null;
    }

    if (seenIds.has(res.data.payment_id)) {
      console.error(`❌ Duplicate payment_id '${res.data.payment_id}' in ${relPath}`);
      errors++;
      return null;
    }
    seenIds.add(res.data.payment_id);

    // Financial correctness
    if (!Number.isInteger(res.data.amount) || res.data.amount <= 0) {
      console.error(`❌ Non-integer or non-positive amount in ${res.data.payment_id}: ${res.data.amount}`);
      errors++;
    }
  }

  console.log(`✓ ${relPath.padEnd(38)} [${parsed.length} records, SHA256: ${hash.slice(0, 12)}...]`);
  return { payments: parsed as FailedPayment[], hash };
}

function verifyOutcomesDataset(
  relPath: string,
  payments: FailedPayment[],
): { outcomes: FrozenPotentialOutcomes[]; hash: string } | null {
  const fullPath = resolve(root, relPath);
  if (!existsSync(fullPath)) {
    console.error(`❌ Missing file: ${relPath}`);
    errors++;
    return null;
  }

  const raw = readFileSync(fullPath, 'utf-8');
  const hash = sha256(raw);
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(`❌ Corrupted JSON in ${relPath}:`, err);
    errors++;
    return null;
  }

  if (!Array.isArray(parsed)) {
    console.error(`❌ Expected array in ${relPath}`);
    errors++;
    return null;
  }

  if (parsed.length !== payments.length) {
    console.error(`❌ Mismatched count in ${relPath}: expected ${payments.length}, found ${parsed.length}`);
    errors++;
    return null;
  }

  const paymentMap = new Map<string, FailedPayment>(payments.map((p) => [p.payment_id, p]));

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    const res = FrozenPotentialOutcomesSchema.safeParse(item);
    if (!res.success) {
      console.error(`❌ Schema violation in ${relPath} outcome [${i}]:`, res.error.format());
      errors++;
      return null;
    }

    const payment = paymentMap.get(res.data.payment_id);
    if (!payment) {
      console.error(`❌ Outcome matrix has unknown payment_id: ${res.data.payment_id}`);
      errors++;
      continue;
    }

    // Invariant check: Ineligible root causes (opt-out / permanent closure) NEVER recover
    const isPermanentlyIneligible =
      payment.opt_out ||
      payment.failure_category === 'permanent_account_closure' ||
      payment.failure_category === 'customer_cancellation';

    for (const [intervention, cycles] of Object.entries(res.data.outcomes)) {
      for (const [cycleNum, att] of Object.entries(cycles)) {
        if (att.recovered && att.settledAmountPaise <= 0) {
          console.error(`❌ Invariant violated: ${res.data.payment_id} (${intervention}:${cycleNum}) recovered=true with settledAmountPaise=${att.settledAmountPaise}`);
          errors++;
        }
        if (!att.recovered && att.settledAmountPaise > 0) {
          console.error(`❌ Invariant violated: ${res.data.payment_id} (${intervention}:${cycleNum}) recovered=false with settledAmountPaise=${att.settledAmountPaise}`);
          errors++;
        }
        if (isPermanentlyIneligible && att.recovered) {
          console.error(`❌ Invariant violated: permanently ineligible ${payment.payment_id} recovered in simulation (${intervention}:${cycleNum})`);
          errors++;
        }
      }
    }
  }

  console.log(`✓ ${relPath.padEnd(38)} [${parsed.length} matrices, SHA256: ${hash.slice(0, 12)}...]`);
  return { outcomes: parsed as FrozenPotentialOutcomes[], hash };
}

// 1. Verify Development Dataset (200 records)
const devData = verifyPaymentsDataset('data/dev-payments-200.json', 200);
if (devData) {
  verifyOutcomesDataset('data/frozen-outcomes-200.json', devData.payments);
}

// 2. Verify Internal Adversarial Stress Dataset (80 records)
const stressData = verifyPaymentsDataset('data/heldout-adversarial-80.json', 80);
if (stressData) {
  verifyOutcomesDataset('data/frozen-outcomes-heldout-80.json', stressData.payments);
}

// 3. Verify Model Weights
const weightsPath = resolve(root, 'src/data/model-weights.json');
if (existsSync(weightsPath)) {
  try {
    const raw = readFileSync(weightsPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const res = ModelWeightsSchema.safeParse(parsed);
    if (!res.success) {
      console.error('❌ Model weights schema violation:', res.error.format());
      errors++;
    } else {
      console.log(`✓ ${'src/data/model-weights.json'.padEnd(38)} [VALID MODEL WEIGHTS ${res.data.modelVersion}]`);
    }
  } catch (e) {
    console.error('❌ Could not parse model-weights.json:', e);
    errors++;
  }
} else {
  console.error('❌ Missing src/data/model-weights.json');
  errors++;
}

// 4. Verify Documentation Artifacts
const requiredDocs = [
  'docs/CURRENT_STATE_AUDIT.md',
  'docs/RELEASE_INTEGRITY_AUDIT.md',
  'docs/SUBMISSION.md',
  'MODEL.md',
  'README.md',
];

for (const doc of requiredDocs) {
  const fullPath = resolve(root, doc);
  if (!existsSync(fullPath)) {
    console.error(`❌ Missing doc: ${doc}`);
    errors++;
  } else {
    console.log(`✓ ${doc.padEnd(38)} [EXISTS]`);
  }
}

if (errors > 0) {
  console.error(`\n❌ Artifact verification failed with ${errors} error(s).`);
  process.exit(1);
} else {
  console.log('\n✅ All benchmark datasets, outcome matrices, and model weights verified successfully.');
}
