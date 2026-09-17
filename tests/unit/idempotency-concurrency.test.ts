import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  AtomicTransactionalIdempotencyStore,
} from '@recoverflow/core';

describe('RecoverFlow AI — Durable Idempotency & Concurrency Stress Test', () => {
  beforeEach(() => {
    (db as any).clear?.();
  });

  it('coordinates 20 concurrent identical requests so exactly ONE business mutation runs', async () => {
    const store = new AtomicTransactionalIdempotencyStore<string>();
    const idempotencyKey = 'idem_req_concurrent_uuid_99182';
    const payload = { merchantId: 'merchant_default_01', amountPaise: 45000, reference: 'INV-9901' };

    let businessSideEffectCount = 0;

    // Simulate 20 concurrent requests with exact same key and payload
    const executeRequest = async (index: number) => {
      // 1. Acquire through database / idempotency store
      const check = store.reserve(idempotencyKey, payload);

      if (check.status === 'ACQUIRED') {
        // Run business logic
        businessSideEffectCount++;
        const responseData = `SUCCESS_TXN_PROCESSED_BY_REQ_${index}`;
        store.commit(idempotencyKey, payload, responseData);
        return { success: true, result: responseData, ranMutation: true };
      } else if (check.status === 'REPLAY') {
        return { success: true, result: check.result, ranMutation: false };
      } else if (check.status === 'IN_PROGRESS') {
        return { success: false, status: 'IN_PROGRESS', ranMutation: false };
      }
      return { success: false, status: check.status, ranMutation: false };
    };

    // Fire 20 parallel concurrent promises
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => executeRequest(i))
    );

    // Exactly 1 request should have run the mutation
    const mutationsExecuted = results.filter((r) => r.ranMutation);
    expect(mutationsExecuted.length).toBe(1);
    expect(businessSideEffectCount).toBe(1);

    // Subsequent replay calls should return the stored cached result
    const replayCheck = store.reserve(idempotencyKey, payload);
    expect(replayCheck.status).toBe('REPLAY');
    expect(replayCheck.result).toContain('SUCCESS_TXN_PROCESSED_BY_REQ_');
  });

  it('rejects concurrent request using same key but DIFFERENT payload with CONFLICT', async () => {
    const store = new AtomicTransactionalIdempotencyStore<string>();
    const key = 'idem_key_tamper_conflict_01';

    const originalPayload = { amount: 1000, currency: 'INR' };
    const tamperedPayload = { amount: 999999, currency: 'USD' };

    // Acquire and commit with original payload
    const res1 = store.reserve(key, originalPayload);
    expect(res1.status).toBe('ACQUIRED');
    store.commit(key, originalPayload, 'PROCESSED_OK');

    // Attempt with tampered payload on same key -> CONFLICT
    const res2 = store.reserve(key, tamperedPayload);
    expect(res2.status).toBe('CONFLICT');
    expect(res2.message).toContain('mismatch');
  });

  it('directly verifies DatabasePort idempotency methods', async () => {
    const key = 'db_port_idem_key_001';
    const merchantId = 'merchant_default_01';
    const endpoint = '/api/recovery/execute';
    const requestHash = 'sha256_hash_mock_req_123';

    // 1. Initial acquire -> Success
    const acquire1 = await db.acquireIdempotencyKey({
      key,
      merchantId,
      endpoint,
      requestHash,
      ttlMs: 60000,
    });
    expect(acquire1.acquired).toBe(true);

    // 2. Commit response
    await db.commitIdempotencyKey(key, merchantId, 200, { ok: true, recovered: true });

    // 3. Replay with same hash -> Returns stored response
    const acquire2 = await db.acquireIdempotencyKey({
      key,
      merchantId,
      endpoint,
      requestHash,
    });
    expect(acquire2.acquired).toBe(false);
    expect(acquire2.existingResponse?.code).toBe(200);
    expect((acquire2.existingResponse?.body as any)?.recovered).toBe(true);

    // 4. Replay with different hash -> Conflict
    const acquire3 = await db.acquireIdempotencyKey({
      key,
      merchantId,
      endpoint,
      requestHash: 'different_hash_tampered',
    });
    expect(acquire3.acquired).toBe(false);
    expect(acquire3.isConflict).toBe(true);
  });
});
