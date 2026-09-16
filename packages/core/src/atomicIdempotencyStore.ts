import { createHash } from 'crypto';

export interface IdempotencyCheckResult<T = unknown> {
  status: 'ACQUIRED' | 'REPLAY' | 'IN_PROGRESS' | 'CONFLICT' | 'acquired' | 'committed' | 'none' | 'in_flight' | 'replay' | 'new' | 'conflict';
  receipt?: T;
  result?: T;
  exists: boolean;
  version?: number;
  message?: string;
}

export interface IdempotencyStoreOptions {
  defaultTtlMs?: number;
  executionTimeoutMs?: number;
}

function hashPayload(payload: unknown): string {
  if (!payload) return '';
  if (typeof payload === 'string') return payload;
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export class AtomicTransactionalIdempotencyStore<T = unknown> {
  private store = new Map<string, { status: string; response?: T; payloadHash?: string; version: number; lockedUntil?: number; createdAt: number }>();
  private defaultTtlMs: number;
  private executionTimeoutMs: number;

  constructor(options: number | IdempotencyStoreOptions = 30000) {
    if (typeof options === 'number') {
      this.defaultTtlMs = options;
      this.executionTimeoutMs = options;
    } else {
      this.defaultTtlMs = options.defaultTtlMs ?? 30000;
      this.executionTimeoutMs = options.executionTimeoutMs ?? 15000;
    }
  }

  async acquireLock(key: string): Promise<boolean> {
    const res = this.reserve(key, 'default_hash');
    return res.status === 'ACQUIRED' || res.status === 'acquired';
  }

  reserve(key: string, payload?: unknown, _opts?: unknown): { status: 'ACQUIRED' | 'REPLAY' | 'IN_PROGRESS' | 'CONFLICT' | 'acquired' | 'committed' | 'none' | 'in_flight' | 'replay' | 'new' | 'conflict'; receipt?: T; result?: T; version?: number; message?: string } {
    const now = Date.now();
    const pHash = hashPayload(payload);
    const existing = this.store.get(key);
    if (existing) {
      if (existing.status === 'COMMITTED' || existing.status === 'committed') {
        if (pHash && existing.payloadHash && existing.payloadHash !== pHash) {
          return { status: 'CONFLICT', message: 'Payload hash mismatch (different request payload hash)' };
        }
        return { status: 'REPLAY', receipt: existing.response, result: existing.response, version: existing.version };
      }
      if (existing.lockedUntil && existing.lockedUntil > now) {
        if (pHash && existing.payloadHash && existing.payloadHash !== pHash) {
          return { status: 'CONFLICT', message: 'Payload hash mismatch (different request payload hash)' };
        }
        return { status: 'IN_PROGRESS', version: existing.version };
      }
    }
    const version = (existing?.version ?? 0) + 1;
    this.store.set(key, {
      status: 'ACQUIRED',
      payloadHash: pHash,
      version,
      createdAt: now,
      lockedUntil: now + this.executionTimeoutMs,
    });
    return { status: 'ACQUIRED', version };
  }

  commit(key: string, arg2: unknown, arg3?: unknown, _version?: number): void {
    const response = (arg3 !== undefined ? arg3 : arg2) as T;
    const pHash = arg3 !== undefined ? hashPayload(arg2) : undefined;
    const existing = this.store.get(key);
    const version = _version ?? (existing?.version ?? 1);
    this.store.set(key, {
      status: 'COMMITTED',
      response,
      payloadHash: pHash ?? existing?.payloadHash,
      version,
      createdAt: Date.now(),
      lockedUntil: undefined,
    });
  }

  save(key: string, arg2: unknown, arg3?: unknown): void {
    this.commit(key, arg2, arg3);
  }

  saveResult(key: string, response: T, _statusCode: number = 200): void {
    this.commit(key, response);
  }

  check(key: string, payload?: unknown): IdempotencyCheckResult<T> {
    const item = this.store.get(key);
    if (!item) {
      return { status: 'new', exists: false };
    }
    const pHash = hashPayload(payload);
    if (item.status === 'COMMITTED' || item.status === 'committed') {
      if (pHash && item.payloadHash && item.payloadHash !== pHash) {
        return { status: 'conflict', exists: true, message: 'Payload mismatch (different request payload hash)' };
      }
      return {
        status: 'replay',
        receipt: item.response,
        result: item.response,
        exists: true,
        version: item.version,
      };
    }
    return {
      status: 'acquired',
      receipt: item.response,
      result: item.response,
      exists: true,
      version: item.version,
    };
  }

  async get(key: string): Promise<{ key: string; response?: T; statusCode: number; createdAt: number } | null> {
    const item = this.store.get(key);
    return item ? { key, response: item.response, statusCode: 200, createdAt: item.createdAt } : null;
  }

  async releaseLock(key: string): Promise<void> {
    const existing = this.store.get(key);
    if (existing && existing.status !== 'COMMITTED') {
      this.store.delete(key);
    }
  }

  clear(): void {
    this.store.clear();
  }
}

export const globalIdempotencyStore = new AtomicTransactionalIdempotencyStore();
export const idempotencyStore = globalIdempotencyStore;
