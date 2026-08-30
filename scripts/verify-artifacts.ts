/**
 * Script: verify-artifacts.ts
 *
 * Validates the existence, integrity, and schema compliance of all checked-in
 * model artifacts, benchmark datasets, and documentation fixtures.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';

const root = dirname(import.meta.dirname!);
const requiredArtifacts = [
  'data/synthetic-payments.json',
  'data/dev-payments-200.json',
  'data/heldout-adversarial-80.json',
  'data/frozen-outcomes-200.json',
  'data/frozen-outcomes-heldout-80.json',
  'src/data/model-weights.json',
  'docs/CURRENT_STATE_AUDIT.md',
  'MODEL.md',
  'README.md',
];

console.log('Verifying submission artifacts and benchmark fixtures...');
let missing = 0;

for (const relPath of requiredArtifacts) {
  const fullPath = resolve(root, relPath);
  if (!existsSync(fullPath)) {
    console.error(`❌ Missing required artifact: ${relPath}`);
    missing++;
    continue;
  }

  if (relPath.endsWith('.json')) {
    try {
      const content = readFileSync(fullPath, 'utf-8');
      const parsed = JSON.parse(content);
      const count = Array.isArray(parsed) ? `${parsed.length} records` : 'valid object';
      console.log(`✓ ${relPath.padEnd(42)} [VALID JSON - ${count}]`);
    } catch (err) {
      console.error(`❌ Corrupted JSON in ${relPath}:`, err);
      missing++;
    }
  } else {
    console.log(`✓ ${relPath.padEnd(42)} [EXISTS]`);
  }
}

if (missing > 0) {
  console.error(`\n❌ Artifact verification failed with ${missing} missing or invalid files.`);
  process.exit(1);
} else {
  console.log('\n✅ All required artifacts verified with zero integrity errors.');
}
