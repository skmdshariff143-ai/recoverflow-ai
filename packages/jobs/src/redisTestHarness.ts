/**
 * RecoverFlow AI — Redis Real Infrastructure Test Harness (Phase 4)
 *
 * Enforces fail-closed semantics for Redis/BullMQ integration testing.
 * If REDIS_URL is missing or Redis is unreachable, throws InfrastructureUnavailableError.
 * Tests under tests/integration/redis/** MUST use this harness.
 */

import Redis from 'ioredis';
import { Queue } from 'bullmq';

export class InfrastructureUnavailableError extends Error {
  constructor(service: string, reason: string) {
    super(`[FAIL-CLOSED] Required test infrastructure ${service} is unavailable: ${reason}`);
    this.name = 'InfrastructureUnavailableError';
  }
}

export interface RedisTestContext {
  redis: Redis;
  redisUrl: string;
  createTestQueue: (queueName: string) => Queue;
  cleanup: () => Promise<void>;
}

export async function createRedisTestHarness(): Promise<RedisTestContext> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new InfrastructureUnavailableError(
      'Redis',
      'REDIS_URL environment variable is not defined. Real Redis 7 container is required for integration tests.'
    );
  }

  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    connectTimeout: 5000,
    retryStrategy: () => null, // Fail fast on connection failure in harness setup
  });

  try {
    const pong = await redis.ping();
    if (pong !== 'PONG') {
      throw new Error(`Expected PONG, received: ${pong}`);
    }
  } catch (err: unknown) {
    redis.disconnect();
    throw new InfrastructureUnavailableError(
      'Redis',
      `Could not connect to Redis at ${redisUrl}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const createdQueues: Queue[] = [];

  const createTestQueue = (queueName: string) => {
    const queue = new Queue(queueName, { connection: redis });
    createdQueues.push(queue);
    return queue;
  };

  const cleanup = async () => {
    for (const q of createdQueues) {
      try {
        await q.obliterate({ force: true });
        await q.close();
      } catch {
        // Ignore
      }
    }
    await redis.quit();
  };

  return {
    redis,
    redisUrl,
    createTestQueue,
    cleanup,
  };
}

export const setupRedisTestHarness = createRedisTestHarness;

export async function teardownRedisTestHarness(ctx?: RedisTestContext): Promise<void> {
  if (ctx) {
    await ctx.cleanup();
  }
}
