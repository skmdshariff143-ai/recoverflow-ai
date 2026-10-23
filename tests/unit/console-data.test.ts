import { describe, it, expect } from 'vitest';
import { summarizeCases, formatMoney, maskIdentifier, type ConsoleCase } from '../../apps/web/src/lib/console-types';
import { csvCell } from '../../apps/web/src/lib/csv';
import { MemoryDatabase } from '../../packages/core/src/data/MemoryDatabase';
const sample = (overrides: Partial<ConsoleCase>): ConsoleCase => ({ id: 'case', paymentId: 'payment', customer: 'masked', status: 'DETECTED', amountMinor: '100', currency: 'USD', expectedValueMinor: '50', probabilityBps: 5000, attempts: 0, maxAttempts: 3, createdAt: '2026-09-18T00:00:00Z', updatedAt: '2026-09-18T00:00:00Z', ...overrides });
describe('Honest console data', () => {
  it('keeps currencies separate and excludes stopped cases from active risk', () => {
    const summary = summarizeCases([sample({ amountMinor: '9007199254740993' }), sample({ status: 'RECOVERED', amountMinor: '2099' }), sample({ status: 'STOPPED', amountMinor: '99999' }), sample({ currency: 'INR', amountMinor: '10000' })]);
    expect(summary.find((entry) => entry.currency === 'USD')).toMatchObject({ atRisk: '9007199254740993', recovered: '2099', recoveredCount: 1 });
    expect(summary.find((entry) => entry.currency === 'INR')?.atRisk).toBe('10000');
    expect(summarizeCases([])).toEqual([]);
    expect(formatMoney('9007199254740993')).toBe('$90,071,992,547,409.93');
    expect(formatMoney('-1', 'INR')).toBe('-₹0.01');
    expect(formatMoney('1234', 'JPY')).toBe('JPY 1,234');
    expect(formatMoney('1234', 'KWD')).toBe('KWD 1.234');
  });
  it('neutralizes spreadsheet formulas and quotes CSV values', () => {
    for (const value of ['=1+1', '+SUM(A1)', '-1+1', '@CMD', '  =WEBSERVICE(1)', '\t=1']) expect(csvCell(value)).toMatch(/^"'/);
    expect(csvCell('hello,"world"')).toBe('"hello,""world"""');
  });
  it('masks contact identifiers', () => {
    expect(maskIdentifier('alice@example.com')).toBe('a•••@example.com');
    expect(maskIdentifier('+14155552600')).toBe('•••• 2600');
  });
  it('records concurrent independent reviews once without manufacturing recovery', async () => {
    const db = new MemoryDatabase();
    const pending = (await db.searchRecoveryCases({ merchantId: 'merchant_default_01', status: 'APPROVAL_REQUIRED' })).items[0];
    expect(pending).toBeDefined();
    const input = { merchantId: pending.merchantId, caseId: pending.id, userId: 'operator-a', action: 'approve' as const, reason: 'Customer evidence verified.' };
    const duplicates = await Promise.all([db.reviewRecoveryCase(input), db.reviewRecoveryCase(input)]);
    expect(duplicates.map((result) => result.outcome).sort()).toEqual(['already_reviewed', 'recorded']);
    expect((await db.getRecoveryCase(pending.id))?.status).toBe('APPROVAL_REQUIRED');
    expect((await db.reviewRecoveryCase({ ...input, userId: 'operator-b' })).status).toBe('ELIGIBILITY_CHECKED');
    expect(db.recoveryOutcomes.size).toBe(0);
    expect(await db.verifyAuditChain(pending.merchantId)).toMatchObject({ valid: true, totalEvents: 2 });
    expect((await db.reviewRecoveryCase({ ...input, merchantId: 'other-tenant' })).outcome).toBe('not_found');
  });
  it('serializes concurrent audit appends into one verifiable chain', async () => {
    const db = new MemoryDatabase();
    await Promise.all(Array.from({ length: 20 }, (_, index) => db.appendAuditEvent({ merchantId: 'merchant_default_01', actorType: 'HUMAN', action: 'REVIEW', entityType: 'CASE', entityId: String(index), payloadHash: 'payload' })));
    expect(await db.verifyAuditChain('merchant_default_01')).toMatchObject({ valid: true, totalEvents: 20 });
  });
});
