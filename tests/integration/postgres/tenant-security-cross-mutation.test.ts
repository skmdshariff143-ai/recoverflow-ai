import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import { setupPostgresTestHarness, teardownPostgresTestHarness } from '../../../packages/core/src/data/postgresTestHarness';
import { PrismaDatabase } from '../../../packages/core/src/data/PrismaDatabase';

describe('RecoverFlow AI — Cross-Tenant Security & Mutation Isolation (PostgreSQL 16)', () => {
  let db: PrismaDatabase;

  beforeAll(async () => {
    const harness = await setupPostgresTestHarness();
    db = harness.db;
  });

  afterAll(async () => {
    await teardownPostgresTestHarness();
  });

  it('strictly blocks cross-tenant recovery case updates and returns null', async () => {
    const merchantA = `merch_a_${crypto.randomBytes(4).toString('hex')}`;
    const merchantB = `merch_b_${crypto.randomBytes(4).toString('hex')}`;

    await db.createOrUpdateMerchant({
      id: merchantA,
      storeUrl: `https://${merchantA}.myshopify.com`,
      storeName: 'Merchant Alpha',
      webhookSecret: 'secret_a_123',
      brandToneGuidelines: 'Friendly',
      brandVoiceCasualVsFormal: 0.3,
      brandVoiceUrgencyVsGentle: 0.4,
      discountCeilingPercentage: 15,
      minMarginPercentage: 20,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.createOrUpdateMerchant({
      id: merchantB,
      storeUrl: `https://${merchantB}.myshopify.com`,
      storeName: 'Merchant Beta',
      webhookSecret: 'secret_b_123',
      brandToneGuidelines: 'Direct',
      brandVoiceCasualVsFormal: 0.8,
      brandVoiceUrgencyVsGentle: 0.2,
      discountCeilingPercentage: 10,
      minMarginPercentage: 25,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create a Payment and RecoveryCase for Merchant A
    const paymentA = await db.createPayment({
      merchantId: merchantA,
      externalPaymentId: `pay_ext_a_${crypto.randomBytes(4).toString('hex')}`,
      amountPaise: 149900n,
      currency: 'INR',
      status: 'FAILED',
    });

    const caseA = await db.createRecoveryCase({
      merchantId: merchantA,
      paymentId: paymentA.id,
      recoveryProbBps: 4500,
      expectedValuePaise: 67455n,
    });

    // Attempt 1: Merchant B tries to mutate Merchant A's recovery case
    const crossUpdateResult = await db.updateRecoveryCase({
      merchantId: merchantB, // Attacking tenant
      id: caseA.id,
      updates: {
        status: 'RECOVERED',
        recoveryProbBps: 9999,
      },
    });

    expect(crossUpdateResult).toBeNull();

    // Verify Merchant A's record was untouched
    const freshCaseA = await db.getRecoveryCase(caseA.id, merchantA);
    expect(freshCaseA?.status).toBe('OPEN');
    expect(freshCaseA?.recoveryProbBps).toBe(4500);

    // Attempt 2: Merchant A successfully mutates their own recovery case
    const validUpdateResult = await db.updateRecoveryCase({
      merchantId: merchantA,
      id: caseA.id,
      updates: {
        status: 'EXECUTING',
        recoveryProbBps: 5500,
      },
    });

    expect(validUpdateResult).not.toBeNull();
    expect(validUpdateResult?.status).toBe('EXECUTING');
    expect(validUpdateResult?.recoveryProbBps).toBe(5500);
  });

  it('prevents cross-tenant data leakage in recovery searches and lookups', async () => {
    const merchantA = `merch_leak_a_${crypto.randomBytes(4).toString('hex')}`;
    const merchantB = `merch_leak_b_${crypto.randomBytes(4).toString('hex')}`;

    await db.createOrUpdateMerchant({
      id: merchantA,
      storeUrl: `https://${merchantA}.myshopify.com`,
      storeName: 'Merchant Alpha',
      webhookSecret: 'sec_a',
      brandToneGuidelines: 'Friendly',
      brandVoiceCasualVsFormal: 0.3,
      brandVoiceUrgencyVsGentle: 0.4,
      discountCeilingPercentage: 15,
      minMarginPercentage: 20,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.createOrUpdateMerchant({
      id: merchantB,
      storeUrl: `https://${merchantB}.myshopify.com`,
      storeName: 'Merchant Beta',
      webhookSecret: 'sec_b',
      brandToneGuidelines: 'Direct',
      brandVoiceCasualVsFormal: 0.8,
      brandVoiceUrgencyVsGentle: 0.2,
      discountCeilingPercentage: 10,
      minMarginPercentage: 25,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const paymentA = await db.createPayment({
      merchantId: merchantA,
      externalPaymentId: `pay_leak_${crypto.randomBytes(4).toString('hex')}`,
      amountPaise: 299900n,
      currency: 'INR',
      status: 'FAILED',
    });

    await db.createRecoveryCase({
      merchantId: merchantA,
      paymentId: paymentA.id,
      recoveryProbBps: 6000,
      expectedValuePaise: 179940n,
    });

    // Merchant B searches for recovery cases -> should return 0 items
    const searchB = await db.searchRecoveryCases({ merchantId: merchantB });
    expect(searchB.total).toBe(0);
    expect(searchB.items).toHaveLength(0);

    // Merchant B tries to query Payment A directly
    const paymentLookupB = await db.getPayment(paymentA.id, merchantB);
    expect(paymentLookupB).toBeNull();
  });
});
