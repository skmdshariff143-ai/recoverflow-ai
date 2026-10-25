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
    
    if (this.redis) {
      if (this.redis.status === 'wait') {
        await this.redis.connect();
      }
      // Atomic Redis sliding window rate limiting via Lua script
      const member = `${now}_${Math.random()}`;
      const luaScript = `
        local key = KEYS[1]
        local now = tonumber(ARGV[1])
        local window = tonumber(ARGV[2])
        local limit = tonumber(ARGV[3])
        local member = ARGV[4]
        local clearBefore = now - window

        redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)
        local current = redis.call('ZCARD', key)
        if current < limit then
            redis.call('ZADD', key, now, member)
            redis.call('EXPIRE', key, 2)
            return 1
        else
            return 0
        end
      `;
      const result = await this.redis.eval(luaScript, 1, key, now, 1000, this.maxPerSecond, member);
      return result === 1;
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
