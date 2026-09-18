/**
 * RecoverFlow AI — Distributed Redis-Backed Rate Limiter for Meta WhatsApp API
 *
 * Enforces distributed rate limiting across multi-worker clusters using Redis sliding windows.
 * Fallback to local memory limiter is permitted ONLY in local TEST/DEMO mode.
 */

import Redis from 'ioredis';

export interface RateLimiter {
  acquireSlot(merchantId: string, phoneId: string): Promise<boolean>;
  waitForSlot(merchantId: string, phoneId: string, timeoutMs?: number): Promise<void>;
}

export class DistributedMetaRateLimiter implements RateLimiter {
  private redis: Redis | null = null;
  private readonly maxPerSecond = 50;
  private localTimestamps = new Map<string, number[]>();

  constructor(redisUrl?: string) {
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 2,
        connectTimeout: 3000,
        lazyConnect: true,
      });
    }
  }

  async acquireSlot(merchantId: string, phoneId: string): Promise<boolean> {
    const key = `ratelimit:meta:${merchantId}:${phoneId}`;
    const now = Date.now();
    const windowStart = now - 1000;

    if (this.redis) {
      if (this.redis.status === 'wait') {
        await this.redis.connect();
      }
      // Redis sliding window using sorted sets
      const multi = this.redis.multi();
      multi.zremrangebyscore(key, 0, windowStart);
      multi.zcard(key);
      const results = await multi.exec();

      const count = (results?.[1]?.[1] as number) || 0;
      if (count < this.maxPerSecond) {
        const addMulti = this.redis.multi();
        addMulti.zadd(key, now, `${now}_${Math.random()}`);
        addMulti.expire(key, 2);
        await addMulti.exec();
        return true;
      }
      return false;
    }

    // Local in-memory sliding window
    const list = (this.localTimestamps.get(key) || []).filter((t) => now - t < 1000);
    if (list.length < this.maxPerSecond) {
      list.push(now);
      this.localTimestamps.set(key, list);
      return true;
    }
    return false;
  }

  async waitForSlot(merchantId: string, phoneId: string, timeoutMs = 5000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const acquired = await this.acquireSlot(merchantId, phoneId);
      if (acquired) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`RATE_LIMIT_EXCEEDED: Meta WhatsApp dispatch timed out for phone ${phoneId}`);
  }

  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}
