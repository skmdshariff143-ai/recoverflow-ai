import { Worker, type Job } from 'bullmq';
import { QUEUE_NAMES, globalRecoveryQueue, type CartJobData, type FallbackJobData } from './queue';

/**
 * Meta Rate-Limit Pacer: Enforces max 50 messages/sec per phone number ID.
 */
export class MetaRateLimitPacer {
  private lastDispatchTimes: number[] = [];
  private readonly maxPerSecond = 50;

  async acquireSlot(): Promise<void> {
    const now = Date.now();
    // Prune timestamps older than 1 second
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

/**
 * Starts the distributed BullMQ worker instances.
 */
export function startDistributedWorkers() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log('[Worker Runtime] REDIS_URL not configured. Running in local in-memory queue mode.');
    return;
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

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[Worker Runtime] Shutting down workers gracefully...');
    await Promise.all(workers.map((w) => w.close()));
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  console.log('[Worker Runtime] Distributed BullMQ workers started successfully with Meta 50 msg/sec rate pacer.');
}

// Automatically start if executed as standalone script
if (process.argv[1] && process.argv[1].includes('worker')) {
  startDistributedWorkers();
}
