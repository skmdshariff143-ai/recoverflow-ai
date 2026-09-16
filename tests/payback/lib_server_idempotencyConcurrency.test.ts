import { describe, it, expect, beforeEach } from 'vitest';
import { AtomicTransactionalIdempotencyStore } from '@recoverflow/core';

describe('Transactional Idempotency Store — Concurrency & Atomic Reservation Tests', () => {
  let store: AtomicTransactionalIdempotencyStore<{ recovered: boolean; amount: number }>;

  beforeEach(() => {
    store = new AtomicTransactionalIdempotencyStore({
      defaultTtlMs: 5000,
      executionTimeoutMs: 200,
    });
  });

  it('Requirement: 100 simultaneous identical requests produce EXACTLY 1 logical execution', async () => {
    const key = 'idem_concurrent_test_100';
    const payload = { paymentId: 'pay_99999', amountPaise: 50000 };

    let executionCount = 0;

    const executeWork = async () => {
      const reservation = await store.reserve(key, payload);

      if (reservation.status === 'ACQUIRED') {
        // Simulate business logic work
        executionCount++;
        await new Promise((r) => setTimeout(r, 20));
        const result = { recovered: true, amount: 50000 };
        await store.commit(key, payload, result, reservation.version);
        return { source: 'executed', result };
      } else if (reservation.status === 'REPLAY') {
        return { source: 'replay', result: reservation.result };
      } else if (reservation.status === 'IN_PROGRESS') {
        // Poll for completion
        while (true) {
          await new Promise((r) => setTimeout(r, 10));
          const check = await store.reserve(key, payload);
          if (check.status === 'REPLAY') {
            return { source: 'replay', result: check.result };
          }
        }
      } else {
        throw new Error('Unexpected conflict');
      }
    };

    // Fire 100 simultaneous requests
    const promises = Array.from({ length: 100 }, () => executeWork());
    const results = await Promise.all(promises);

    expect(executionCount).toBe(1);
    expect(results.length).toBe(100);
    for (const res of results) {
      expect(res.result).toEqual({ recovered: true, amount: 50000 });
    }
  });

  it('Requirement: Reusing the same idempotency key with a DIFFERENT payload returns deterministic CONFLICT', async () => {
    const key = 'idem_conflict_test';
    const payload1 = { paymentId: 'pay_001', amountPaise: 1000 };
    const payload2 = { paymentId: 'pay_001', amountPaise: 2000 };

    const res1 = await store.reserve(key, payload1);
    expect(res1.status).toBe('ACQUIRED');

    const res2 = await store.reserve(key, payload2);
    expect(res2.status).toBe('CONFLICT');
    if (res2.status === 'CONFLICT') {
      expect(res2.message).toContain('different request payload hash');
    }
  });

  it('Requirement: Crash recovery automatically re-allows acquisition after execution timeout', async () => {
    const key = 'idem_crash_test';
    const payload = { paymentId: 'pay_crash', amountPaise: 3000 };

    const res1 = await store.reserve(key, payload);
    expect(res1.status).toBe('ACQUIRED');

    // Simulate process crash: no commit or fail called. Wait for execution timeout (200ms)
    await new Promise((r) => setTimeout(r, 250));

    const res2 = await store.reserve(key, payload);
    expect(res2.status).toBe('ACQUIRED');
    if (res2.status === 'ACQUIRED') {
      expect(res2.version).toBe(2);
    }
  });
});
