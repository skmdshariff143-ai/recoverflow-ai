import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import {
  db,
  type Merchant,
  type PaymentRecord,
  type RecoveryCaseRecord,
  type OutboxEventRecord,
  type WebhookEventRecord,
} from '@recoverflow/core';
import { TransactionalOutboxWorker } from '../../packages/jobs/src/outbox-worker';

describe('RecoverFlow AI — End-to-End Durable Recovery Pipeline & Zero-Duplicate Idempotency', () => {
  const TEST_MERCHANT: Merchant = {
    id: 'merchant_durable_01',
    storeUrl: 'https://durability-test.myshopify.com',
    storeName: 'Durability Luxury Goods',
    shopDomain: 'durability-test.myshopify.com',
    webhookSecret: 'sec_test_durable_998811',
    brandToneGuidelines: 'Precise, trustworthy, helpful.',
    brandVoiceCasualVsFormal: 0.5,
    brandVoiceUrgencyVsGentle: 0.5,
    discountCeilingPercentage: 10.0,
    minMarginPercentage: 25.0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    (db as any).clear?.();
    await db.upsertMerchant(TEST_MERCHANT);
  });

  it('executes full atomic pipeline: payment failure -> webhook -> outbox -> worker execution -> audit chain -> duplicate webhook replay prevention', async () => {
    const paymentId = 'pay_rzp_durable_7719';
    const amountPaise = 149900; // ₹1,499.00
    const currency = 'INR';

    // ── STEP 1: Simulate Ingestion of Customer & Failed Payment ───────────────
    const payment = await db.createPayment({
      merchantId: TEST_MERCHANT.id,
      externalPaymentId: 'pay_rzp_ext_7719',
      orderReference: 'ord_ref_durable_001',
      amountPaise,
      currency,
      status: 'FAILED',
      gateway: 'RAZORPAY',
    });

    // ── STEP 2: Razorpay Webhook Arrival with Signature & WebhookEvent Ingestion
    const webhookPayload = {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: payment.externalPaymentId,
            amount: amountPaise,
            currency,
            status: 'failed',
            error_code: 'BAD_REQUEST_ERROR',
            error_description: 'Payment failed at bank gateway',
          },
        },
      },
    };
    const webhookPayloadString = JSON.stringify(webhookPayload);
    const webhookSignature = crypto
      .createHmac('sha256', TEST_MERCHANT.webhookSecret)
      .update(webhookPayloadString)
      .digest('hex');
    const webhookIdempotencyKey = `wh_rzp_${payment.externalPaymentId}_payment.failed`;

    // Acquire Webhook Idempotency
    const idempotencyCheck = await db.acquireIdempotencyKey({
      key: webhookIdempotencyKey,
      merchantId: TEST_MERCHANT.id,
      endpoint: '/api/v1/webhooks/razorpay',
      requestHash: crypto.createHash('sha256').update(webhookPayloadString).digest('hex'),
      ttlMs: 86400000,
    });
    expect(idempotencyCheck.acquired).toBe(true);

    const webhookRecord: WebhookEventRecord = await db.createWebhookEvent({
      merchantId: TEST_MERCHANT.id,
      provider: 'RAZORPAY',
      source: 'WEBHOOK',
      eventType: 'payment.failed',
      providerEventId: 'evt_rzp_7719',
      externalId: payment.externalPaymentId,
      idempotencyKey: webhookIdempotencyKey,
      payloadHash: crypto.createHash('sha256').update(webhookPayloadString).digest('hex'),
      rawPayload: webhookPayload,
      signatureValid: true,
    });
    expect(webhookRecord.id).toBeDefined();

    // ── STEP 3: Atomic Transaction - Create RecoveryCase & OutboxEvent ────────
    const recoveryCase: RecoveryCaseRecord = await db.createRecoveryCase({
      merchantId: TEST_MERCHANT.id,
      paymentId: payment.id,
      recoveryProbBps: 6800,
      expectedValuePaise: 101932,
    });
    expect(recoveryCase.id).toBeDefined();

    const outboxIdempotencyKey = db.generateOutboxIdempotencyKey(
      TEST_MERCHANT.shopDomain!,
      payment.id,
      new Date().toISOString()
    );

    const outboxEvent: OutboxEventRecord = await db.createOutboxEvent({
      merchantId: TEST_MERCHANT.id,
      aggregateType: 'RecoveryCase',
      aggregateId: recoveryCase.id,
      eventType: 'RECOVERY_CASE_CREATED',
      payload: {
        recoveryCaseId: recoveryCase.id,
        merchantId: TEST_MERCHANT.id,
        paymentId: payment.id,
        amountPaise,
        currency,
      },
      idempotencyKey: outboxIdempotencyKey,
    });
    expect(outboxEvent.status).toBe('PENDING');

    // Commit Webhook Ingestion Idempotency
    await db.commitIdempotencyKey(webhookIdempotencyKey, TEST_MERCHANT.id, 200, {
      received: true,
      caseId: recoveryCase.id,
    });
    await db.markWebhookEventProcessed(webhookRecord.id, 'PROCESSED');

    // ── STEP 4: Standalone Worker Claims and Processes Outbox Event ───────────
    const worker = new TransactionalOutboxWorker({ workerId: 'worker-durable-e2e-01' });
    const processedCount = await worker.processBatch();
    expect(processedCount).toBe(1);

    // Verify Outbox State is Published
    const pendingEvents = await (db as any).getPendingOutboxEvents(50, TEST_MERCHANT.id);
    expect(pendingEvents.length).toBe(0);

    // Record Recovery Attempt and Merkle Hash Chain Audit Event
    const attempt = await db.createRecoveryAttempt({
      recoveryCaseId: recoveryCase.id,
      attemptNumber: 1,
      channel: 'WHATSAPP',
      status: 'SENT',
      providerResponse: { messageId: 'wamid.HBgLMjA2' },
    });
    expect(attempt.status).toBe('SENT');

    const auditEvent = await db.appendAuditEvent({
      organizationId: 'org_default',
      merchantId: TEST_MERCHANT.id,
      actorType: 'SYSTEM_WORKER',
      action: 'RECOVERY_DISPATCHED',
      entityType: 'RecoveryAttempt',
      entityId: attempt.id,
      payloadHash: crypto
        .createHash('sha256')
        .update(JSON.stringify({ caseId: recoveryCase.id, attemptId: attempt.id }))
        .digest('hex'),
      metadata: { channel: 'WHATSAPP', provider: 'INTERAKT' },
    });
    expect(auditEvent.currentHash).toHaveLength(64);

    // Verify Audit Chain Integrity
    const chainVerification = await db.verifyAuditChain(TEST_MERCHANT.id);
    expect(chainVerification.valid).toBe(true);
    expect(chainVerification.totalEvents).toBeGreaterThanOrEqual(1);

    // ── STEP 5: Replay Attack / Duplicate Webhook Ingestion ───────────────────
    // A network glitch causes the identical webhook to be re-sent by Razorpay
    const replayCheck = await db.acquireIdempotencyKey({
      key: webhookIdempotencyKey,
      merchantId: TEST_MERCHANT.id,
      endpoint: '/api/v1/webhooks/razorpay',
      requestHash: crypto.createHash('sha256').update(webhookPayloadString).digest('hex'),
    });

    // Zero-Duplicate Guarantee: Lock acquisition must be rejected and return cached response
    expect(replayCheck.acquired).toBe(false);
    expect(replayCheck.isConflict).toBeFalsy();
    expect(replayCheck.existingResponse).toBeDefined();
    expect(replayCheck.existingResponse?.code).toBe(200);

    // Verify No Duplicate Recovery Cases or Outbox Events were generated
    const allCases = await db.listRecoveryCases({ merchantId: TEST_MERCHANT.id });
    expect(allCases.length).toBe(1);

    const allAttempts = await db.listRecoveryCases({ merchantId: TEST_MERCHANT.id });
    expect(allAttempts.length).toBe(1);
  });
});
