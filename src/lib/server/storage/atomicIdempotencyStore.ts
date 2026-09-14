/**
 * PayBack AI — Atomic Transactional Idempotency Implementation.
 *
 * Implements atomic execution intent reservations (INSERT ON CONFLICT equivalent).
 * Provides crash-recovery TTLs, deterministic conflict rejection, and concurrent lock isolation.
 */

import {
  IdempotencyRecord,
  ReservationResult,
  TransactionalIdempotencyStore,
  computeDeterministicPayloadHash,
} from './idempotencyTypes';

export class AtomicTransactionalIdempotencyStore<TResult = unknown>
  implements TransactionalIdempotencyStore<TResult>
{
  private store = new Map<string, IdempotencyRecord<TResult>>();
  private locks = new Map<string, Promise<void>>();
  private readonly defaultTtlMs: number;
  private readonly executionTimeoutMs: number;

  constructor(options: { defaultTtlMs?: number; executionTimeoutMs?: number } = {}) {
    this.defaultTtlMs = options.defaultTtlMs ?? 60 * 60 * 1000; // 1 hour
    this.executionTimeoutMs = options.executionTimeoutMs ?? 15 * 1000; // 15 seconds crash timeout
  }

  hashPayload(payload: unknown): string {
    return computeDeterministicPayloadHash(payload);
  }

  /**
   * Acquire a mutex lock for a specific key during the reservation transaction.
   */
  private async withKeyLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }
    let resolveLock!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.locks.set(key, lockPromise);
    try {
      return await fn();
    } finally {
      this.locks.delete(key);
      resolveLock();
    }
  }

  async reserve(
    key: string,
    payload: unknown,
    ttlMs?: number,
  ): Promise<ReservationResult<TResult>> {
    return this.withKeyLock(key, async () => {
      const now = Date.now();
      const requestHash = this.hashPayload(payload);
      const existing = this.store.get(key);

      // Check if entry expired
      if (existing && existing.expiresAtMs < now) {
        this.store.delete(key);
      }

      const active = this.store.get(key);

      if (!active) {
        // Case 1: Fresh reservation (INSERT ... ON CONFLICT DO NOTHING succeeded)
        const record: IdempotencyRecord<TResult> = {
          key,
          requestHash,
          state: 'EXECUTING',
          createdAtMs: now,
          updatedAtMs: now,
          expiresAtMs: now + (ttlMs ?? this.defaultTtlMs),
          version: 1,
        };
        this.store.set(key, record);
        return { status: 'ACQUIRED', version: 1 };
      }

      // Case 2: Key exists with DIFFERENT payload -> Strict conflict rejection
      if (active.requestHash !== requestHash) {
        return {
          status: 'CONFLICT',
          message: `Idempotency key '${key}' was previously registered with a different request payload hash.`,
        };
      }

      // Case 3: Key exists with IDENTICAL payload and is COMPLETED -> Return cached result
      if (active.state === 'COMPLETED' && active.result !== undefined) {
        return { status: 'REPLAY', result: active.result };
      }

      // Case 4: Key exists with IDENTICAL payload and is EXECUTING
      // Check for worker/process crash timeout
      if (active.state === 'EXECUTING' && now - active.updatedAtMs > this.executionTimeoutMs) {
        // Process likely crashed; allow recovery takeover
        active.updatedAtMs = now;
        active.version += 1;
        return { status: 'ACQUIRED', version: active.version };
      }

      // Still actively executing
      return { status: 'IN_PROGRESS', retryAfterMs: 500 };
    });
  }

  async commit(
    key: string,
    payload: unknown,
    result: TResult,
    version: number,
  ): Promise<void> {
    return this.withKeyLock(key, async () => {
      const active = this.store.get(key);
      if (!active) {
        throw new Error(`Cannot commit non-existent idempotency reservation: ${key}`);
      }
      const requestHash = this.hashPayload(payload);
      if (active.requestHash !== requestHash) {
        throw new Error(`Payload hash mismatch during idempotency commit for key: ${key}`);
      }
      if (active.version !== version) {
        throw new Error(`Optimistic concurrency version conflict during commit (expected ${active.version}, got ${version})`);
      }

      active.state = 'COMPLETED';
      active.result = result;
      active.updatedAtMs = Date.now();
    });
  }

  async fail(
    key: string,
    payload: unknown,
    errorMessage: string,
    version: number,
  ): Promise<void> {
    return this.withKeyLock(key, async () => {
      const active = this.store.get(key);
      if (!active) return;
      if (active.version !== version) return;

      active.state = 'FAILED';
      active.errorMessage = errorMessage;
      active.updatedAtMs = Date.now();
    });
  }

  // Diagnostic helper for tests
  getRecord(key: string): IdempotencyRecord<TResult> | undefined {
    return this.store.get(key);
  }

  clear(): void {
    this.store.clear();
    this.locks.clear();
  }
}

export const globalTransactionalIdempotencyStore = new AtomicTransactionalIdempotencyStore<unknown>();
