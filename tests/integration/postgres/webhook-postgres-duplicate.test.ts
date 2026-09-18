import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createPostgresTestHarness, type PostgresTestContext } from '@recoverflow/core';

describe('PostgreSQL Webhook Ingestion & Duplicate Deduplication', () => {
  let harness: PostgresTestContext;

  beforeAll(async () => {
    harness = await createPostgresTestHarness();
  });

  beforeEach(async () => {
    await harness.cleanup();
    await harness.db.createOrUpdateMerchant({
      id: 'merch_whk_dup',
      storeName: 'Webhook Dup Store',
      currency: 'INR',
    } as any);
  });

  afterAll(async () => {
    await harness.cleanup();
    await harness.prisma.$disconnect();
  });

  it('handles 50 concurrent webhooks with the same event ID creating exactly 1 case and 1 outbox event', async () => {
    const providerEventId = 'evt_rzp_dup_test_001';
    const merchantId = 'merch_whk_dup';
    const endpoint = '/api/webhooks/razorpay';
    const concurrentCount = 50;

    const processWebhook = async (index: number) => {
      const { acquired, existingResponse } = await harness.db.acquireIdempotencyKey({
        key: providerEventId,
        merchantId,
        endpoint,
        requestHash: `hash_webhook_${providerEventId}`,
      });

      if (!acquired) {
        return { status: 'DUPLICATE', cached: existingResponse };
      }

      const txResult = await harness.db.ingestRazorpayWebhookTransaction({
        webhookEvent: {
          merchantId,
          provider: 'RAZORPAY',
          eventType: 'payment.failed',
          providerEventId,
          idempotencyKey: providerEventId,
          payloadHash: `hash_webhook_${providerEventId}`,
          rawPayload: { id: providerEventId, index },
          signatureValid: true,
        },
        payment: {
          merchantId,
          externalPaymentId: `pay_${providerEventId}`,
          amountPaise: 299900n,
          currency: 'INR',
          status: 'FAILED',
          gateway: 'RAZORPAY',
        },
        recoveryCase: {
          recoveryProbBps: 8000,
          expectedValuePaise: 239920n,
        },
        outbox: {
          eventType: 'PAYMENT_FAILED',
          payload: { eventId: providerEventId },
          idempotencyKey: `outbox_${providerEventId}`,
        },
      });

      await harness.db.commitIdempotencyKey(
        providerEventId,
        merchantId,
        200,
        { recoveryCaseId: txResult.recoveryCase?.id },
        endpoint
      );

      return { status: 'PROCESSED', caseId: txResult.recoveryCase?.id };
    };

    const results = await Promise.all(Array.from({ length: concurrentCount }, (_, i) => processWebhook(i)));

    const processed = results.filter((r) => r.status === 'PROCESSED');
    const duplicates = results.filter((r) => r.status === 'DUPLICATE');

    expect(processed.length).toBe(1);
    expect(duplicates.length).toBe(concurrentCount - 1);

    // Verify only 1 payment, 1 case, and 1 outbox event exists in database
    const payments = await harness.prisma.payment.findMany({ where: { merchantId } });
    const cases = await harness.prisma.recoveryCase.findMany({ where: { merchantId } });
    const outbox = await harness.prisma.outboxEvent.findMany({ where: { merchantId } });

    expect(payments.length).toBe(1);
    expect(cases.length).toBe(1);
    expect(outbox.length).toBe(1);
  });
});
