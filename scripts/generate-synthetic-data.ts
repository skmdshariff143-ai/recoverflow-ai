/**
 * Script: generate synthetic-payments.json fixture.
 *
 * Usage:
 *   npx tsx scripts/generate-synthetic-data.ts              # 100 records, seed=42
 *   npx tsx scripts/generate-synthetic-data.ts --count=200  # custom count
 *   npx tsx scripts/generate-synthetic-data.ts --random     # non-deterministic
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { generateSyntheticPayments } from '../src/lib/engine/generateData';

const args = process.argv.slice(2);
const isRandom = args.includes('--random');
const countArg = args.find((a) => a.startsWith('--count='));
const seedArg = args.find((a) => a.startsWith('--seed='));

const count = Number(countArg?.split('=')[1] ?? '100');
const seed = isRandom ? undefined : Number(seedArg?.split('=')[1] ?? '42');

console.log(
  `Generating ${count} synthetic failed-payment records` +
    (seed !== undefined ? ` (seed=${seed})` : ' (random)') +
    '...',
);

const payments = generateSyntheticPayments({ totalRecords: count, seed });

const outPath = resolve(dirname(import.meta.dirname!), 'data', 'synthetic-payments.json');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(payments, null, 2) + '\n', 'utf-8');

console.log(`✓ Wrote ${payments.length} records to ${outPath}`);

// Category distribution summary.
const dist: Record<string, number> = {};
for (const p of payments) {
  dist[p.failure_category] = (dist[p.failure_category] ?? 0) + 1;
}
console.log('\nCategory distribution:');
for (const [cat, n] of Object.entries(dist).sort()) {
  console.log(`  ${cat}: ${n}`);
}
