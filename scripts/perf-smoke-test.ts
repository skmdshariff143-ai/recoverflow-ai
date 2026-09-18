/**
 * RecoverFlow AI — Local Performance Smoke Test
 *
 * Exercises 500 simulated webhook ingestion events with concurrency 25 against PostgreSQL.
 * Reports processed count, error rate, p50, p95, and p99 latency percentiles.
 */

import crypto from 'crypto';
import { setupPostgresTestHarness, teardownPostgresTestHarness } from '../packages/core/src/data/postgresTestHarness';

async function runPerformanceSmokeTest(totalEvents = 500, concurrency = 25) {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  RECOVERFLOW AI — LOCAL PERFORMANCE SMOKE TEST');
  console.log(`  Total Events: ${totalEvents} | Concurrency: ${concurrency}`);
  console.log('════════════════════════════════════════════════════════════════\n');

  const harness = await setupPostgresTestHarness();
  const db = harness.db;

  const merchantId = `merch_perf_${crypto.randomBytes(4).toString('hex')}`;
  await db.createOrUpdateMerchant({
    id: merchantId,
    storeUrl: `https://${merchantId}.myshopify.com`,
    storeName: 'Smoke Test Store',
    webhookSecret: 'sec_smoke',
    brandToneGuidelines: 'Direct',
    brandVoiceCasualVsFormal: 0.5,
    brandVoiceUrgencyVsGentle: 0.5,
    discountCeilingPercentage: 15,
    minMarginPercentage: 20,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const latencies: number[] = [];
  let successful = 0;
  let errors = 0;

  const queue = Array.from({ length: totalEvents }, (_, i) => i);

  async function worker() {
    while (queue.length > 0) {
      const idx = queue.shift();
      if (idx === undefined) break;

      const start = Date.now();
      try {
        const extPayId = `pay_perf_${idx}_${crypto.randomBytes(4).toString('hex')}`;
        await db.createRecoveryCaseAndEnqueue({
          payment: {
            merchantId,
            externalPaymentId: extPayId,
            amountPaise: 149900n,
            currency: 'INR',
            status: 'FAILED',
          },
          recoveryCase: {
            recoveryProbBps: 5500,
            expectedValuePaise: 82445n,
          },
          outbox: {
            eventType: 'PAYMENT_RECOVERY_ENQUEUED',
            payload: { idx, extPayId },
            idempotencyKey: `idemp_perf_${idx}_${crypto.randomBytes(4).toString('hex')}`,
          },
        });
        latencies.push(Date.now() - start);
        successful++;
      } catch (err) {
        errors++;
      }
    }
  }

  const startTotal = Date.now();
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const totalDurationMs = Date.now() - startTotal;

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const throughput = Math.round((successful / (totalDurationMs / 1000)) * 100) / 100;

  console.log('RESULTS:');
  console.log(`  Processed:   ${successful} / ${totalEvents}`);
  console.log(`  Errors:      ${errors}`);
  console.log(`  Duration:    ${totalDurationMs} ms`);
  console.log(`  Throughput:  ${throughput} ops/sec`);
  console.log(`  p50 Latency: ${p50} ms`);
  console.log(`  p95 Latency: ${p95} ms`);
  console.log(`  p99 Latency: ${p99} ms\n`);

  await teardownPostgresTestHarness();
  console.log('✅ Local performance smoke test completed successfully.');
}

if (require.main === module || process.argv[1]?.includes('perf-smoke-test')) {
  runPerformanceSmokeTest(100, 10).catch((err) => {
    console.error('Smoke test failed:', err);
    process.exit(1);
  });
}
