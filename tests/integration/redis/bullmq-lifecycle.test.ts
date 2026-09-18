import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRedisTestHarness, type RedisTestContext } from '@recoverflow/jobs';
import { Worker } from 'bullmq';

describe('Redis & BullMQ 7 Real Infrastructure Lifecycle', () => {
  let harness: RedisTestContext;

  beforeAll(async () => {
    harness = await createRedisTestHarness();
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  it('proves Redis connectivity with real PING', async () => {
    const pong = await harness.redis.ping();
    expect(pong).toBe('PONG');
  });

  it('handles job submission, delayed execution, and worker processing lifecycle', async () => {
    const queueName = `test-queue-${Date.now()}`;
    const testQueue = harness.createTestQueue(queueName);

    const processedJobs: string[] = [];

    const testWorker = new Worker(
      queueName,
      async (job) => {
        processedJobs.push(job.data.cartId);
        return { recovered: true };
      },
      { connection: harness.redis }
    );

    // Add job with 50ms delay
    const job = await testQueue.add(
      'recovery-task',
      { cartId: 'cart_test_bullmq_001' },
      { delay: 50, jobId: 'job_bullmq_001' }
    );

    expect(job.id).toBe('job_bullmq_001');

    // Wait for worker execution
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(processedJobs).toContain('cart_test_bullmq_001');

    await testWorker.close();
  });
});
