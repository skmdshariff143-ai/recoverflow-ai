import crypto from 'crypto';
import { Worker, type Job } from 'bullmq';
import { db, getRuntimeMode, StartupConfigurationError } from '@recoverflow/core';
import { QUEUE_NAMES, globalRecoveryQueue, type CartJobData, type FallbackJobData } from './queue';
import { globalOutboxWorker } from './outbox-worker';

/**
 * Data Sovereignty Compliance: Periodic 30-day retention hard-pruner.
 */
export function startDataRetentionPruner(intervalMs = 3600 * 1000): NodeJS.Timeout {
  const runPrune = async () => {
    try {
      const stats = await db.pruneRecordsOlderThan(30);
      if (stats.prunedCarts > 0 || stats.prunedLogs > 0) {
        console.log(`[Data Sovereignty] Pruned records older than 30 days: ${stats.prunedCarts} carts, ${stats.prunedLogs} logs`);
      }
    } catch (err) {
      console.error('[Data Sovereignty] Retention pruning error:', err);
    }
  };

  runPrune();
  return setInterval(runPrune, intervalMs);
}

/**
 * Meta Rate-Limit Pacer: Enforces max 50 messages/sec per phone number ID.
 */
export class MetaRateLimitPacer {
  private lastDispatchTimes: number[] = [];
  private readonly maxPerSecond = 50;

  async acquireSlot(): Promise<void> {
    const now = Date.now();
    this.lastDispatchTimes = this.lastDispatchTimes.filter((t) => now - t < 1000);

    if (this.lastDispatchTimes.length >= this.maxPerSecond) {
      const oldest = this.lastDispatchTimes[0];
      const waitTime = Math.max(0, 1000 - (now - oldest));
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastDispatchTimes.push(Date.now());
  }
}

export const globalMetaPacer = new MetaRateLimitPacer();

export interface WorkerRuntimeCoordinator {
  workerId: string;
  workers: Worker[];
  isClosed: boolean;
  close: () => Promise<void>;
}

/**
 * Starts distributed BullMQ worker instances.
 */
export function startDistributedWorkers(connectionUrl?: string): Worker[] {
  const redisUrl = connectionUrl || process.env.REDIS_URL;
  const mode = getRuntimeMode();

  if (!redisUrl) {
    if (mode === 'LIVE' || mode === 'SANDBOX') {
      throw new StartupConfigurationError(
        `REDIS_URL is required in '${mode}' mode. Production queue workers cannot fall back to in-memory queues.`
      );
    }
    console.log('[Worker Runtime] REDIS_URL not configured. Running in local in-memory queue mode.');
    return [];
  }

  const connection = { url: redisUrl };

  // 1. Immediate Queue Worker (Payment Failures, 3m delay)
  const immediateWorker = new Worker<CartJobData>(
    QUEUE_NAMES.IMMEDIATE,
    async (job: Job<CartJobData>) => {
      console.log(`[Immediate Worker] Processing payment recovery job ${job.id} for cart ${job.data.cartEventId}`);
      await globalMetaPacer.acquireSlot();
      return globalRecoveryQueue.executePrimaryRecovery(job.data.cartEventId);
    },
    { connection, concurrency: 5 }
  );

  // 2. Standard Queue Worker (Abandoned Checkouts, 30m delay)
  const standardWorker = new Worker<CartJobData>(
    QUEUE_NAMES.STANDARD,
    async (job: Job<CartJobData>) => {
      console.log(`[Standard Worker] Processing cart recovery job ${job.id} for cart ${job.data.cartEventId}`);
      await globalMetaPacer.acquireSlot();
      return globalRecoveryQueue.executePrimaryRecovery(job.data.cartEventId);
    },
    { connection, concurrency: 10 }
  );

  // 3. Fallback Email Queue Worker (3h unread check)
  const fallbackWorker = new Worker<FallbackJobData>(
    QUEUE_NAMES.FALLBACK_EMAIL,
    async (job: Job<FallbackJobData>) => {
      console.log(`[Fallback Worker] Processing 3h email fallback job ${job.id} for cart ${job.data.cartEventId}`);
      return globalRecoveryQueue.executeFallbackEmail(job.data.cartEventId);
    },
    { connection, concurrency: 5 }
  );

  const workers = [immediateWorker, standardWorker, fallbackWorker];

  for (const w of workers) {
    w.on('completed', (job) => {
      console.log(`[Worker] Job ${job.id} in queue ${job.queueName} completed successfully.`);
    });
    w.on('failed', (job, err) => {
      console.error(`[Worker] Job ${job?.id} in queue ${job?.queueName} failed:`, err);
    });
  }

  return workers;
}

/**
 * Unified Worker Runtime Coordinator for production daemons and integration test harnesses.
 */
export async function startWorkerRuntime(options?: {
  workerId?: string;
  redisUrl?: string;
  enablePruner?: boolean;
}): Promise<WorkerRuntimeCoordinator> {
  const workerId = options?.workerId || `worker_${crypto.randomBytes(6).toString('hex')}`;
  const workers = startDistributedWorkers(options?.redisUrl);

  // Start Transactional Outbox Worker
  globalOutboxWorker.start();

  let prunerTimer: NodeJS.Timeout | null = null;
  if (options?.enablePruner !== false) {
    prunerTimer = startDataRetentionPruner(3600 * 1000);
  }

  let isClosed = false;

  const coordinator: WorkerRuntimeCoordinator = {
    workerId,
    workers,
    isClosed: false,
    close: async () => {
      if (isClosed) return;
      isClosed = true;
      coordinator.isClosed = true;

      // 1. Stop claiming outbox work
      globalOutboxWorker.stop();

      // 2. Stop pruner
      if (prunerTimer) clearInterval(prunerTimer);

      // 3. Close BullMQ workers
      if (workers.length > 0) {
        await Promise.all(workers.map((w) => w.close()));
      }

      // 4. Close queues
      await globalRecoveryQueue.close();

      // 5. Close DB
      await db.close();
    },
  };

  return coordinator;
}

// Automatically start if executed as standalone script
if (process.argv[1] && process.argv[1].includes('worker')) {
  startWorkerRuntime().then((runtime) => {
    const shutdown = async (sig: string) => {
      console.log(`\n[Worker Runtime] Shutting down on ${sig}...`);
      await runtime.close();
      process.exit(0);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  });
}
