import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import { setupRedisTestHarness, teardownRedisTestHarness } from '../../../packages/jobs/src/redisTestHarness';
import { DistributedMetaRateLimiter } from '../../../packages/jobs/src/rate-limiter';

describe('RecoverFlow AI — Distributed Meta WhatsApp Rate Limiting (Redis 7)', () => {
  let redisUrl: string;

  beforeAll(async () => {
    const harness = await setupRedisTestHarness();
    redisUrl = harness.redisUrl;
  });

  afterAll(async () => {
    await teardownRedisTestHarness();
  });

  it('enforces shared 50 req/sec limit across 3 independent worker limiter instances', async () => {
    const merchantId = `merch_rl_${crypto.randomBytes(4).toString('hex')}`;
    const phoneId = `phone_${crypto.randomBytes(4).toString('hex')}`;

    // Create 3 independent limiter instances pointing to same Redis
    const limiter1 = new DistributedMetaRateLimiter(redisUrl);
    const limiter2 = new DistributedMetaRateLimiter(redisUrl);
    const limiter3 = new DistributedMetaRateLimiter(redisUrl);

    try {
      // Rapidly attempt 70 requests across the 3 workers
      const promises: Promise<boolean>[] = [];
      for (let i = 0; i < 70; i++) {
        const limiter = i % 3 === 0 ? limiter1 : i % 3 === 1 ? limiter2 : limiter3;
        promises.push(limiter.acquireSlot(merchantId, phoneId));
      }

      const results = await Promise.all(promises);
      const acquiredCount = results.filter((r) => r === true).length;
      const rejectedCount = results.filter((r) => r === false).length;

      // In a single 1-second window, at most 50 requests can be granted
      expect(acquiredCount).toBeLessThanOrEqual(50);
      expect(rejectedCount).toBeGreaterThanOrEqual(20);
    } finally {
      await limiter1.close();
      await limiter2.close();
      await limiter3.close();
    }
  });
});
