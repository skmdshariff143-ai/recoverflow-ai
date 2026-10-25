import crypto from 'crypto';
import type Redis from 'ioredis';

export interface IdempotencyStoreConfig {
  defaultTtlMs?: number;
  executionTimeoutMs?: number;
}

export interface IdempotencyReservation<T = unknown> {
  status: 'ACQUIRED' | 'REPLAY' | 'IN_PROGRESS' | 'CONFLICT';
  result?: T;
  message?: string;
  version?: number;
}

interface StoredEntry<T = unknown> {
  payloadHash: string;
  status: 'IN_PROGRESS' | 'COMMITTED';
  result?: T;
  lockedUntil: number;
  version: number;
}

export class AtomicTransactionalIdempotencyStore<T = unknown> {
  private store = new Map<string, StoredEntry<T>>();
  private config: IdempotencyStoreConfig;

  constructor(config?: IdempotencyStoreConfig) {
    this.config = config || { defaultTtlMs: 30000, executionTimeoutMs: 5000 };
  }

  private hashPayload(payload: unknown): string {
    return crypto.createHash('sha256').update(JSON.stringify(payload || {})).digest('hex');
  }

  public reserve(key: string, payload: unknown, lockTtlMs?: number): IdempotencyReservation<T> {
    const payloadHash = this.hashPayload(payload);
    const ttl = lockTtlMs ?? this.config.executionTimeoutMs ?? this.config.defaultTtlMs ?? 5000;
    const now = Date.now();
    const existing = this.store.get(key);

    if (existing) {
      if (existing.payloadHash !== payloadHash) {
        return {
          status: 'CONFLICT',
          message: 'Payload mismatch: idempotency key reused with a different request payload hash.',
        };
      }

      if (existing.status === 'COMMITTED') {
        return {
          status: 'REPLAY',
          result: existing.result,
          version: existing.version,
        };
      }

      if (existing.status === 'IN_PROGRESS' && existing.lockedUntil > now) {
        return {
          status: 'IN_PROGRESS',
          version: existing.version,
        };
      }

      existing.lockedUntil = now + ttl;
      existing.status = 'IN_PROGRESS';
      existing.version += 1;
      return { status: 'ACQUIRED', version: existing.version };
    }

    this.store.set(key, {
      payloadHash,
      status: 'IN_PROGRESS',
      lockedUntil: now + ttl,
      version: 1,
    });

    return { status: 'ACQUIRED', version: 1 };
  }

  public commit(key: string, payload: unknown, result: T, version?: number): void {
    const payloadHash = this.hashPayload(payload);
    const existing = this.store.get(key);
    if (!existing || existing.payloadHash !== payloadHash || existing.status !== 'IN_PROGRESS' || existing.lockedUntil <= Date.now() || (version !== undefined && existing.version !== version)) {
      throw new Error('Idempotency reservation is missing, expired, or no longer owned by this execution.');
    }
    this.store.set(key, {
      payloadHash,
      status: 'COMMITTED',
      result,
      lockedUntil: 0,
      version: existing.version,
    });
  }

  public release(key: string): void {
    this.store.delete(key);
  }

  public clear(): void {
    this.store.clear();
  }
}

export type IdempotencyBeginResult<T = any> =
  | { status: 'new' }
  | { status: 'replay'; receipt: T }
  | { status: 'conflict'; message: string }
  | { status: 'in_progress'; message: string };

interface StoredIdempotencyEntry<T = any> {
  payloadHash: string;
  status: 'IN_PROGRESS' | 'COMMITTED';
  receipt?: T;
  lockedUntil: number;
  expiresAt: number;
}

export class IdempotencyManager {
  private memoryStore = new Map<string, StoredIdempotencyEntry>();
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

  private hashPayload(payload: unknown): string {
    return crypto.createHash('sha256').update(JSON.stringify(payload || {})).digest('hex');
  }

  /**
   * Synchronously attempts to begin/acquire an idempotency lock for key and payload.
   * Node's single-threaded event loop guarantees synchronous Map mutations are atomic.
   */
  public begin<T = any>(key: string, payload: unknown, lockTtlSeconds = 30): IdempotencyBeginResult<T> {
    const prefixedKey = `idemp:${key}`;
    const now = Date.now();
    const payloadHash = this.hashPayload(payload);
    const existing = this.memoryStore.get(prefixedKey);

    if (existing) {
      // 1. Key expired after previous commit
      if (existing.status === 'COMMITTED' && existing.expiresAt <= now) {
        this.memoryStore.set(prefixedKey, {
          payloadHash,
          status: 'IN_PROGRESS',
          lockedUntil: now + lockTtlSeconds * 1000,
          expiresAt: now + 86400 * 1000,
        });
        return { status: 'new' };
      }

      // 2. Payload mismatch -> conflict
      if (existing.payloadHash !== payloadHash) {
        return {
          status: 'conflict',
          message: 'Payload mismatch: idempotency key reused with a different request payload hash.',
        };
      }

      // 3. Exact match replay of committed execution
      if (existing.status === 'COMMITTED') {
        return {
          status: 'replay',
          receipt: existing.receipt as T,
        };
      }

      // 4. In progress
      if (existing.status === 'IN_PROGRESS') {
        if (existing.lockedUntil > now) {
          return {
            status: 'in_progress',
            message: 'Operation in progress. Concurrent execution detected.',
          };
        }
        // Lock expired without save, allow retry/re-acquisition
        existing.lockedUntil = now + lockTtlSeconds * 1000;
        return { status: 'new' };
      }
    }

    // New key: acquire lock synchronously before any async gap
    this.memoryStore.set(prefixedKey, {
      payloadHash,
      status: 'IN_PROGRESS',
      lockedUntil: now + lockTtlSeconds * 1000,
      expiresAt: now + 86400 * 1000,
    });
    return { status: 'new' };
  }

  public check(key: string, request?: unknown): { status: 'new' | 'replay' | 'conflict'; receipt?: any } {
    const prefixedKey = `idemp:${key}`;
    const now = Date.now();
    const existing = this.memoryStore.get(prefixedKey);

    if (!existing || existing.expiresAt <= now) {
      return { status: 'new' };
    }

    const currentHash = this.hashPayload(request);
    if (existing.payloadHash !== currentHash) {
      return { status: 'conflict' };
    }

    if (existing.status === 'COMMITTED') {
      return { status: 'replay', receipt: existing.receipt };
    }

    return { status: 'new' };
  }

  public save(key: string, request: unknown, receipt?: unknown, ttlSeconds = 86400): void {
    const prefixedKey = `idemp:${key}`;
    const payloadHash = this.hashPayload(request);
    this.memoryStore.set(prefixedKey, {
      payloadHash,
      status: 'COMMITTED',
      receipt,
      lockedUntil: 0,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async acquire(key: string, ttlSeconds = 86400): Promise<boolean> {
    const prefixedKey = `idemp:${key}`;
    if (this.redisClient && this.isRedisHealthy) {
      try {
        const res = await this.redisClient.set(prefixedKey, '1', 'EX', ttlSeconds, 'NX');
        return res === 'OK';
      } catch {
        // Fall back
      }
    }

    const now = Date.now();
    const existing = this.memoryStore.get(prefixedKey);
    if (existing && existing.expiresAt > now) {
      return false;
    }

    this.memoryStore.set(prefixedKey, {
      payloadHash: '1',
      status: 'IN_PROGRESS',
      lockedUntil: now + ttlSeconds * 1000,
      expiresAt: now + ttlSeconds * 1000,
    });
    return true;
  }

  public release(key: string): void {
    const prefixedKey = `idemp:${key}`;
    if (this.redisClient && this.isRedisHealthy) {
      try {
        this.redisClient.del(prefixedKey).catch(() => {});
      } catch {
        // Fall back
      }
    }
    this.memoryStore.delete(prefixedKey);
  }

  clear(): void {
    this.memoryStore.clear();
  }
}

export const idempotencyStore = new IdempotencyManager();
export const globalIdempotency = idempotencyStore;
