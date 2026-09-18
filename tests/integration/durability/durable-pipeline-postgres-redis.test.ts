import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createPostgresTestHarness, type PostgresTestContext } from '@recoverflow/core';
import { createRedisTestHarness, type RedisTestContext } from '@recoverflow/jobs';

describe('RecoverFlow AI — Full Production Durability Pipeline (PostgreSQL 16 + Redis 7)', () => {
  let pgHarness: PostgresTestContext;
  let redisHarness: RedisTestContext;

  beforeAll(async () => {
    pgHarness = await createPostgresTestHarness();
    redisHarness = await createRedisTestHarness();
  });

  afterAll(async () => {
    await pgHarness.cleanup();
    await pgHarness.prisma.$disconnect();
    await redisHarness.cleanup();
  });

  it('executes durable recovery case creation, outbox claiming, and Redis queuing end-to-end', async () => {
    const merchantId = 'merch_full_durability';
    await pgHarness.db.createOrUpdateMerchant({
      id: merchantId,
      storeName: 'Full Durability Store',
      currency: 'INR',
    } as any);

    // 1. Ingest payment failure transaction
    const tx = await pgHarness.db.createRecoveryCaseAndEnqueue({
      payment: {
        merchantId,
        externalPaymentId: 'pay_rzp_durable_e2e',
        amountPaise: 999900n,
        currency: 'INR',
        status: 'FAILED',
        gateway: 'RAZORPAY',
        customerId: 'cust_e2e_001',
      },
      recoveryCase: {
        customerId: 'cust_e2e_001',
        recoveryProbBps: 8500,
        expectedValuePaise: 849915n,
      },
      outbox: {
        eventType: 'PAYMENT_FAILED',
        payload: { customerPhone: '+919876543210' },
        idempotencyKey: 'idem_full_durable_001',
      },
    });

    expect(tx.recoveryCase.id).toBeDefined();
    expect(tx.outbox.id).toBeDefined();

    // 2. Claim outbox event with worker lock
    const workerId = 'worker_durability_e2e';
    const claimed = await pgHarness.db.claimOutboxEvents(workerId, 1, 30000);
    expect(claimed.length).toBe(1);
    expect(claimed[0].id).toBe(tx.outbox.id);

    // 3. Queue to Redis BullMQ
    const queue = redisHarness.createTestQueue('e2e-durability-queue');
    const job = await queue.add(
      'dispatch-recovery',
      { recoveryCaseId: tx.recoveryCase.id },
      { jobId: `outbox:${claimed[0].id}` }
    );
    expect(job.id).toBe(`outbox:${claimed[0].id}`);

    // 4. Mark published with worker lock check
    const published = await pgHarness.db.markOutboxEventPublished(claimed[0].id, workerId);
    expect(published).toBe(true);

    // 5. Audit trail appended & verified
    await pgHarness.db.appendAuditEvent({
      merchantId,
      actorType: 'WORKER',
      action: 'RECOVERY_DISPATCHED',
      entityType: 'RECOVERY_CASE',
      entityId: tx.recoveryCase.id,
      payloadHash: 'hash_dispatch_e2e',
    });

    const auditVerification = await pgHarness.db.verifyAuditChain(merchantId);
    expect(auditVerification.valid).toBe(true);
    expect(auditVerification.totalEvents).toBe(1);
  });
});
