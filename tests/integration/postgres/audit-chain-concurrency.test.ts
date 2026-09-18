import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createPostgresTestHarness, type PostgresTestContext } from '@recoverflow/core';

describe('PostgreSQL Concurrency-Safe Merkle Audit Ledger', () => {
  let harness: PostgresTestContext;

  beforeAll(async () => {
    harness = await createPostgresTestHarness();
  });

  beforeEach(async () => {
    await harness.cleanup();
    await harness.db.createOrUpdateMerchant({
      id: 'merch_audit_concur',
      storeName: 'Audit Concurrency Store',
      currency: 'INR',
    } as any);
  });

  afterAll(async () => {
    await harness.cleanup();
    await harness.prisma.$disconnect();
  });

  it('appends 50 concurrent audit events producing an un-forked, cryptographically valid hash chain', async () => {
    const merchantId = 'merch_audit_concur';
    const eventCount = 50;

    const appendPromises = Array.from({ length: eventCount }, (_, i) =>
      harness.db.appendAuditEvent({
        merchantId,
        actorType: 'AI_AGENT',
        action: 'DECISION_EVALUATED',
        entityType: 'RECOVERY_CASE',
        entityId: `rc_${i}`,
        payloadHash: `sha256_payload_${i}`,
        metadata: { index: i },
      })
    );

    await Promise.all(appendPromises);

    // Verify entire chain integrity
    const verification = await harness.db.verifyAuditChain(merchantId);
    expect(verification.valid).toBe(true);
    expect(verification.totalEvents).toBe(eventCount);
    expect(verification.brokenAtId).toBeUndefined();
  });
});
