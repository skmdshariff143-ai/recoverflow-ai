import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createPostgresTestHarness, type PostgresTestContext } from '@recoverflow/core';

describe('PostgreSQL Atomic Domain + Outbox Transaction & Rollback', () => {
  let harness: PostgresTestContext;

  beforeAll(async () => {
    harness = await createPostgresTestHarness();
  });

  beforeEach(async () => {
    await harness.cleanup();
    // Seed test merchant
    await harness.db.createOrUpdateMerchant({
      id: 'merch_tx_test',
      storeName: 'TX Test Store',
      currency: 'INR',
    } as any);
  });

  afterAll(async () => {
    await harness.cleanup();
    await harness.prisma.$disconnect();
  });

  it('verifies provider is PostgreSQL and durable', () => {
    expect(harness.db.providerName).toContain('PostgreSQL');
    expect(harness.db.isDurable).toBe(true);
  });

  it('commits payment, recovery case, and outbox event atomically in a single transaction', async () => {
    const result = await harness.db.createRecoveryCaseAndEnqueue({
      payment: {
        merchantId: 'merch_tx_test',
        externalPaymentId: 'pay_rzp_success_001',
        amountPaise: 499900n,
        currency: 'INR',
        status: 'FAILED',
        gateway: 'RAZORPAY',
        customerId: 'cust_001',
      },
      recoveryCase: {
        customerId: 'cust_001',
        recoveryProbBps: 7500,
        expectedValuePaise: 374925n,
      },
      outbox: {
        eventType: 'PAYMENT_FAILED',
        payload: { source: 'webhook' },
        idempotencyKey: 'idem_tx_001',
      },
    });

    expect(result.payment.id).toBeDefined();
    expect(result.recoveryCase.id).toBeDefined();
    expect(result.outbox.id).toBeDefined();
    expect(result.outbox.status).toBe('PENDING');

    // Verify persisted in database
    const payInDb = await harness.db.getPayment(result.payment.id);
    const caseInDb = await harness.db.getRecoveryCase(result.recoveryCase.id);
    const pendingOutbox = await harness.db.getPendingOutboxEvents(10);

    expect(payInDb).not.toBeNull();
    expect(caseInDb).not.toBeNull();
    expect(pendingOutbox.some((o) => o.id === result.outbox.id)).toBe(true);
  });

  it('proves complete rollback when intentional failure occurs in transaction', async () => {
    const externalPaymentId = 'pay_rzp_fail_rollback';

    await expect(
      harness.prisma.$transaction(async (tx) => {
        // Step 1: Create payment
        await tx.payment.create({
          data: {
            merchantId: 'merch_tx_test',
            externalPaymentId,
            amountPaise: 150000n,
            currency: 'INR',
            status: 'FAILED',
            gateway: 'RAZORPAY',
          },
        });

        // Step 2: Intentional failure / constraint error
        throw new Error('Simulated crash midway through transaction');
      })
    ).rejects.toThrow('Simulated crash midway through transaction');

    // Assert payment was rolled back completely
    const payInDb = await harness.db.getPaymentByExternalId(externalPaymentId);
    expect(payInDb).toBeNull();
  });
});
