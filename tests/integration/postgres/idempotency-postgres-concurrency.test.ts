import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createPostgresTestHarness, type PostgresTestContext } from '@recoverflow/core';

describe('PostgreSQL Multi-tenant Idempotency Concurrency', () => {
  let harness: PostgresTestContext;

  beforeAll(async () => {
    harness = await createPostgresTestHarness();
  });

  beforeEach(async () => {
    await harness.cleanup();
    await harness.db.createOrUpdateMerchant({
      id: 'merch_idem_concur',
      storeName: 'Idem Concurrency Store',
      currency: 'INR',
    } as any);
  });

  afterAll(async () => {
    await harness.cleanup();
    await harness.prisma.$disconnect();
  });

  it('ensures exactly 1 acquisition out of 50 concurrent requests with identical key', async () => {
    const key = 'idem_req_concurrent_001';
    const merchantId = 'merch_idem_concur';
    const endpoint = '/api/webhooks/razorpay';
    const concurrentCount = 50;

    const attempts = Array.from({ length: concurrentCount }, () =>
      harness.db.acquireIdempotencyKey({
        key,
        merchantId,
        endpoint,
        requestHash: 'hash_abc_123',
        ttlMs: 60000,
      })
    );

    const results = await Promise.all(attempts);

    const acquired = results.filter((r) => r.acquired);
    const rejected = results.filter((r) => !r.acquired);

    expect(acquired.length).toBe(1);
    expect(rejected.length).toBe(concurrentCount - 1);

    // Commit key
    await harness.db.commitIdempotencyKey(key, merchantId, 200, { success: true }, endpoint);

    // Subsequent call receives cached response
    const cachedResult = await harness.db.acquireIdempotencyKey({
      key,
      merchantId,
      endpoint,
      requestHash: 'hash_abc_123',
    });

    expect(cachedResult.acquired).toBe(false);
    expect(cachedResult.existingResponse?.code).toBe(200);
    expect(cachedResult.existingResponse?.body).toEqual({ success: true });
  });
});
