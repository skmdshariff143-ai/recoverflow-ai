/**
 * RecoverFlow AI — Standalone Production Worker Daemon.
 *
 * Runs BullMQ distributed recovery queues, the transactional outbox publisher worker,
 * and the compliance retention pruner in a single unified, resilient runtime.
 */

import { startWorkerRuntime } from '@recoverflow/jobs';

async function main() {
  console.log('====================================================');
  console.log('  RECOVERFLOW AI — PRODUCTION WORKER DAEMON STARTED  ');
  console.log('====================================================');
  console.log(`[Runtime] Node: ${process.version}, PID: ${process.pid}, Env: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[Runtime] Mode: ${process.env.RECOVERFLOW_RUNTIME_MODE || 'DEMO'}`);
  console.log(`[Runtime] Redis: ${process.env.REDIS_URL ? 'CONFIGURED' : 'LOCAL_IN_MEMORY_MODE'}`);

  const runtime = await startWorkerRuntime();

  const shutdown = async (signal: string) => {
    console.log(`\n[Worker Runtime] Received ${signal}. Draining and closing...`);
    await runtime.close();
    console.log('[Worker Runtime] Gracefully terminated.');
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
