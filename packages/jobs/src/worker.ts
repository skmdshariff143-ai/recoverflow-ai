import http from 'http';
import crypto from 'crypto';
import Redis from 'ioredis';
import { Worker, type Job } from 'bullmq';
import { db, getRuntimeMode, StartupConfigurationError, globalRetentionService } from '@recoverflow/core';
import { QUEUE_NAMES, globalRecoveryQueue, type CartJobData, type FallbackJobData } from './queue';
import { globalOutboxWorker } from './outbox-worker';
import { DistributedMetaRateLimiter } from './rate-limiter';

/**
 * Scheduled Data Retention Pruner.
 * Invokes RetentionPolicyService with configurable retention rules.
 */
export function startDataRetentionPruner(intervalMs = 3600 * 1000): NodeJS.Timeout {
  const runPrune = async () => {
    try {
      const results = await globalRetentionService.executePruning(db);
      const pruned = results.filter((r) => r.prunedCount > 0);
      if (pruned.length > 0) {
        console.log(`[Retention Policy] Pruned expired records:`, pruned);
      }
    } catch (err) {
      console.error('[Retention Policy] Retention pruning error:', err);
    }
  };

  runPrune();
  return setInterval(runPrune, intervalMs);
}

export interface WorkerRuntimeCoordinator {
  workerId: string;
  workers: Worker[];
  rateLimiter: DistributedMetaRateLimiter;
  healthServer?: http.Server;
  isClosed: boolean;
  close: () => Promise<void>;
}

/**
 * Starts distributed BullMQ worker instances.
 */
export function startDistributedWorkers(connectionUrl?: string, rateLimiter?: DistributedMetaRateLimiter): Worker[] {
  const redisUrl = connectionUrl || process.env.REDIS_URL;
  const mode = getRuntimeMode();
  const limiter = rateLimiter || new DistributedMetaRateLimiter(redisUrl);

  if (!redisUrl) {
    if (mode === 'LIVE' || mode === 'SANDBOX' || process.env.NODE_ENV === 'production') {
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
      await limiter.waitForSlot(job.data.merchantId || 'default', job.data.cartEventId);
      return globalRecoveryQueue.executePrimaryRecovery(job.data.cartEventId);
    },
    { connection, concurrency: 5 }
  );

  // 2. Standard Queue Worker (Abandoned Checkouts, 30m delay)
  const standardWorker = new Worker<CartJobData>(
    QUEUE_NAMES.STANDARD,
    async (job: Job<CartJobData>) => {
      console.log(`[Standard Worker] Processing cart recovery job ${job.id} for cart ${job.data.cartEventId}`);
      await limiter.waitForSlot(job.data.merchantId || 'default', job.data.cartEventId);
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
 * Starts an HTTP health server on port 4000 for Kubernetes / Docker / ECS probes.
 */
export function startHealthServer(port = Number(process.env.HEALTH_PORT || 4000), redisUrl?: string): http.Server {
  const server = http.createServer(async (req, res) => {
    const url = req.url?.split('?')[0];

    if (req.method === 'GET' && url === '/live') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'live', uptime: process.uptime() }));
      return;
    }

    if (req.method === 'GET' && url === '/ready') {
      try {
        const mode = getRuntimeMode();
        const dbOk = await db.ping();
        if (!dbOk) {
          throw new Error('Database ping failed');
        }

        const rUrl = redisUrl || process.env.REDIS_URL;
        if (!rUrl && (mode === 'LIVE' || mode === 'SANDBOX' || process.env.NODE_ENV === 'production')) {
          throw new Error(`REDIS_URL is required in ${mode} mode; in-memory queue is not acceptable`);
        }

        if (rUrl) {
          const client = new Redis(rUrl, { connectTimeout: 3000, maxRetriesPerRequest: 1, lazyConnect: true });
          await client.connect();
          const pong = await client.ping();
          await client.quit();
          if (pong !== 'PONG') {
            throw new Error(`Redis ping returned unexpected: ${pong}`);
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ready',
          mode,
          db: dbOk ? 'ok' : 'failed',
          redis: rUrl ? 'ok' : 'in-memory',
        }));
      } catch (err: unknown) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'unready', error: err instanceof Error ? err.message : String(err) }));
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });

  server.listen(port, () => {
    console.log(`[Worker Health Server] Listening on port ${port} (/live, /ready)`);
  });

  return server;
}

/**
 * Unified Worker Runtime Coordinator for production daemons and integration test harnesses.
 */
export async function startWorkerRuntime(options?: {
  workerId?: string;
  redisUrl?: string;
  enablePruner?: boolean;
  enableHealthServer?: boolean;
  healthPort?: number;
}): Promise<WorkerRuntimeCoordinator> {
  const workerId = options?.workerId || `worker_${crypto.randomBytes(6).toString('hex')}`;
  const rateLimiter = new DistributedMetaRateLimiter(options?.redisUrl);
  const workers = startDistributedWorkers(options?.redisUrl, rateLimiter);

  // Start Transactional Outbox Worker
  globalOutboxWorker.start();

  let prunerTimer: NodeJS.Timeout | null = null;
  if (options?.enablePruner !== false) {
    prunerTimer = startDataRetentionPruner(3600 * 1000);
  }

  let healthServer: http.Server | undefined;
  if (options?.enableHealthServer !== false && process.env.NODE_ENV !== 'test') {
    healthServer = startHealthServer(options?.healthPort, options?.redisUrl);
  }

  let isClosed = false;

  const coordinator: WorkerRuntimeCoordinator = {
    workerId,
    workers,
    rateLimiter,
    healthServer,
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

      // 4. Close rate limiter
      await rateLimiter.close();

      // 5. Close health server
      if (healthServer) {
        await new Promise<void>((resolve) => healthServer!.close(() => resolve()));
      }

      // 6. Close queues
      await globalRecoveryQueue.close();

      // 7. Close DB
      await db.close();
    },
  };

  return coordinator;
}
