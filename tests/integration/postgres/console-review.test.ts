import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPostgresTestHarness, type PostgresTestContext } from '@recoverflow/core';

describe('Durable console review and exact payment storage', () => {
  let harness: PostgresTestContext;
  beforeAll(async () => { harness = await createPostgresTestHarness(); await harness.cleanup(); });
  afterAll(async () => { if (harness) { await harness.cleanup(); await harness.prisma.user.deleteMany({ where: { email: { endsWith: '@console-review.test' } } }); await harness.prisma.$disconnect(); } });
  it('serializes duplicate reviewers, commits independent approvals, and preserves bigint amounts', async () => {
    const merchantId = 'console-review-merchant';
    await harness.prisma.merchant.create({ data: { id: merchantId, storeUrl: 'https://console-review.test', storeName: 'Console test', webhookSecret: 'test-only' } });
    const first = await harness.db.createUser({ email: 'first@console-review.test' });
    const second = await harness.db.createUser({ email: 'second@console-review.test' });
    const payment = await harness.db.createPayment({ merchantId, externalPaymentId: 'large-exact-payment', amountPaise: 9007199254740993n, currency: 'INR' });
    expect((await harness.db.getPayment(payment.id, merchantId))?.amountPaise).toBe(9007199254740993n);
    const record = await harness.db.createRecoveryCase({ merchantId, paymentId: payment.id });
    await harness.db.updateRecoveryCase({ merchantId, id: record.id, updates: { status: 'APPROVAL_REQUIRED' } });
    const review = { merchantId, caseId: record.id, userId: first.id, action: 'approve' as const, reason: 'Independent customer evidence checked.' };
    const results = await Promise.all([harness.db.reviewRecoveryCase(review), harness.db.reviewRecoveryCase(review)]);
    expect(results.map((result) => result.outcome).sort()).toEqual(['already_reviewed', 'recorded']);
    expect((await harness.db.getRecoveryCase(record.id, merchantId))?.status).toBe('APPROVAL_REQUIRED');
    expect((await harness.db.reviewRecoveryCase({ ...review, userId: second.id })).status).toBe('ELIGIBILITY_CHECKED');
    expect(await harness.prisma.recoveryOutcome.count()).toBe(0);
    expect(await harness.db.verifyAuditChain(merchantId)).toMatchObject({ valid: true, totalEvents: 2 });
    expect((await harness.db.reviewRecoveryCase({ ...review, merchantId: 'foreign' })).outcome).toBe('not_found');
  });
});
