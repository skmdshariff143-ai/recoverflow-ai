/**
 * RecoverFlow AI — Standalone Production Worker Daemon.
 *
 * Runs BullMQ distributed recovery queues, the transactional outbox publisher worker,
 * and the 30-day compliance retention hard-pruner in a single resilient daemon process.
 */

import {
  startDistributedWorkers,
  startDataRetentionPruner,
  globalOutboxWorker,
} from '@recoverflow/jobs';

async function main() {
  console.log('====================================================');
  console.log('  RECOVERFLOW AI — PRODUCTION WORKER DAEMON STARTED  ');
  console.log('====================================================');
  console.log(`[Runtime] Node: ${process.version}, PID: ${process.pid}, Env: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[Runtime] Redis URL: ${process.env.REDIS_URL ? 'CONFIGURED' : 'LOCAL_IN_MEMORY_MODE'}`);

  // 1. Start BullMQ queue consumers (Immediate, Standard, Fallback Email)
  startDistributedWorkers();

  // 2. Start Transactional Outbox Worker
  globalOutboxWorker.start();
  console.log('[Worker Runtime] Transactional outbox worker polling started (1000ms cadence).');

  // 3. Start Data Sovereignty 30-day Retention Hard-Pruner
  const prunerTimer = startDataRetentionPruner(3600 * 1000);
  console.log('[Worker Runtime] Compliance data retention hard-pruner scheduled.');

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`\n[Worker Runtime] Received ${signal}. Initiating graceful shutdown...`);
    globalOutboxWorker.stop();
    clearInterval(prunerTimer);
    console.log('[Worker Runtime] Workers and background pollers drained.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

if (require.main === module || process.argv[1]?.includes('start-worker')) {
  main().catch((err) => {
    console.error('[Worker Runtime] Fatal error during startup:', err);
    process.exit(1);
  });
}
