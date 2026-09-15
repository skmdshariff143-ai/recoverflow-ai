import type Redis from 'ioredis';

interface MemoryItem {
  value: string;
  expiresAt: number;
}

export class IdempotencyManager {
  private memoryStore = new Map<string, MemoryItem>();
  private redisClient: Redis | null = null;
  private isRedisHealthy = false;

  constructor(redisClient?: Redis | null) {
    if (redisClient) {
      this.redisClient = redisClient;
      this.isRedisHealthy = true;
      this.redisClient.on('error', () => {
        this.isRedisHealthy = false;
      });
      this.redisClient.on('connect', () => {
        this.isRedisHealthy = true;
      });
    }
  }

  /**
   * Attempts to acquire an idempotency lock for the given key.
   * Returns true if newly acquired, or false if already processed / locked.
   */
  async acquire(key: string, ttlSeconds = 86400): Promise<boolean> {
    const prefixedKey = `idemp:${key}`;

    if (this.redisClient && this.isRedisHealthy) {
      try {
        const res = await this.redisClient.set(prefixedKey, '1', 'EX', ttlSeconds, 'NX');
        return res === 'OK';
      } catch {
        // Fall back to memory store on network glitch
      }
    }

    // In-memory fallback
    const now = Date.now();
    const existing = this.memoryStore.get(prefixedKey);
    if (existing && existing.expiresAt > now) {
      return false; // Already locked/processed
    }

    this.memoryStore.set(prefixedKey, {
      value: '1',
      expiresAt: now + ttlSeconds * 1000,
    });

    // Clean up expired entries lazily
    if (this.memoryStore.size > 2000) {
      for (const [k, v] of this.memoryStore.entries()) {
        if (v.expiresAt <= now) {
          this.memoryStore.delete(k);
        }
      }
    }

    return true;
  }

  /**
   * Explicitly release a key (e.g. if the webhook transaction aborted).
   */
  async release(key: string): Promise<void> {
    const prefixedKey = `idemp:${key}`;
    if (this.redisClient && this.isRedisHealthy) {
      try {
        await this.redisClient.del(prefixedKey);
      } catch {
        // Ignore
      }
    }
    this.memoryStore.delete(prefixedKey);
  }
}

export const globalIdempotency = new IdempotencyManager();
