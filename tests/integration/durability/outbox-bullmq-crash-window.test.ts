import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import { Queue } from 'bullmq';
import { setupPostgresTestHarness, teardownPostgresTestHarness } from '../../../packages/core/src/data/postgresTestHarness';
import { setupRedisTestHarness, teardownRedisTestHarness } from '../../../packages/jobs/src/redisTestHarness';
import { PrismaDatabase } from '../../../packages/core/src/data/PrismaDatabase';

describe('RecoverFlow AI — Outbox BullMQ Crash Window & Idempotency (PostgreSQL + Redis)', () => {
  let db: PrismaDatabase;
  let redisUrl: string;
  let testQueue: Queue;

  beforeAll(async () => {
    const pg = await setupPostgresTestHarness();
    db = pg.db;
    const r = await setupRedisTestHarness();
    redisUrl = r.redisUrl;
    testQueue = new Queue('test-crash-recovery', { connection: { url: redisUrl } });
  });

  afterAll(async () => {
    await testQueue.close();
    await teardownRedisTestHarness();
    await teardownPostgresTestHarness();
  });

  it('guarantees deterministic jobId deduplication across worker crash/reclaim cycles', async () => {
    const merchantId = `merch_crash_${crypto.randomBytes(4).toString('hex')}`;

    await db.createOrUpdateMerchant({
      id: merchantId,
      storeUrl: `https://${merchantId}.myshopify.com`,
      storeName: 'Crash Recovery Store',
      webhookSecret: 'sec_crash',
      brandToneGuidelines: 'Helpful',
      brandVoiceCasualVsFormal: 0.3,
      brandVoiceUrgencyVsGentle: 0.4,
      discountCeilingPercentage: 15,
      minMarginPercentage: 20,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 1. Create case & outbox event atomically
    const uow = await db.createRecoveryCaseAndEnqueue({
      payment: {
        merchantId,
        externalPaymentId: `pay_crash_${crypto.randomBytes(4).toString('hex')}`,
        amountPaise: 99900n,
        currency: 'INR',
      },
      recoveryCase: {
        recoveryProbBps: 5000,
        expectedValuePaise: 49950n,
      },
      outbox: {
        eventType: 'RECOVERY_CASE_CREATED',
        payload: { test: true },
        idempotencyKey: `idemp_crash_${crypto.randomBytes(6).toString('hex')}`,
      },
    });

    const outboxId = uow.outbox.id;
    const deterministicJobId = `outbox:${outboxId}`;

    // 2. Worker 1 claims outbox event with a 1-second lease
    const claimed1 = await db.claimOutboxEvents('worker_crashing_1', 1, 1000);
    expect(claimed1).toHaveLength(1);
    expect(claimed1[0].id).toBe(outboxId);

    // 3. Worker 1 enqueues BullMQ job with deterministic jobId
    const job1 = await testQueue.add('process_recovery', claimed1[0].payload, { jobId: deterministicJobId });
    expect(job1.id).toBe(deterministicJobId);

    // 4. Simulated crash: Worker 1 dies before calling markOutboxEventPublished()
    // Wait for lease (1 second) to expire
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // 5. Worker 2 boots up and re-claims the expired outbox event
    const claimed2 = await db.claimOutboxEvents('worker_healthy_2', 1, 30000);
    expect(claimed2).toHaveLength(1);
    expect(claimed2[0].id).toBe(outboxId);

    // 6. Worker 2 attempts to add to BullMQ with the same deterministic jobId
    const job2 = await testQueue.add('process_recovery', claimed2[0].payload, { jobId: deterministicJobId });

    // BullMQ deduplicates: returns the existing job instance without creating a second logical job
    expect(job2.id).toBe(deterministicJobId);

    const jobCount = await testQueue.count();
    expect(jobCount).toBe(1);

    // 7. Worker 2 marks outbox published
    const published = await db.markOutboxEventPublished(outboxId, 'worker_healthy_2');
    expect(published).toBe(true);

    const finalEvent = await db.prisma.outboxEvent.findUnique({ where: { id: outboxId } });
    expect(finalEvent?.status).toBe('PUBLISHED');
  });
});
