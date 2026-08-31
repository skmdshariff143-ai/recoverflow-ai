/**
 * Unit tests for "Ask the Ledger" natural language query engine.
 */

import { describe, it, expect } from 'vitest';
import { queryAuditLedger } from '../askLedger';
import type { ChainedAuditRecord } from '../hashChainLedger';
import type { FailedPayment } from '@/types';

const MOCK_RECORDS: ChainedAuditRecord[] = [
  {
    id: 'aud_001',
    sequenceIndex: 0,
    timestamp: '2026-08-30T10:00:00Z',
    payment_id: 'pay_001',
    stage: 'safety_filter',
    decision: 'SAFETY_RULE_HALT_OPT_OUT',
    reason: 'Customer opted out under DPDP Section 6',
    metadata: { paymentId: 'pay_001' },
    previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
    currentHash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
  },
  {
    id: 'aud_002',
    sequenceIndex: 1,
    timestamp: '2026-08-30T10:05:00Z',
    payment_id: 'pay_002',
    stage: 'quiet_hours_scheduling',
    decision: 'SCHEDULED_FOR_RETRY',
    reason: 'Quiet-hours window active: deferred to 09:00 IST',
    metadata: { paymentId: 'pay_002' },
    previousHash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
    currentHash: 'b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef01',
  },
];

const MOCK_PAYMENTS: FailedPayment[] = [
  {
    payment_id: 'pay_001',
    customer_id: 'cust_01',
    amount: 250000,
    currency: 'INR',
    failure_category: 'insufficient_funds',
    failure_timestamp: '2026-08-30T09:59:00Z',
    attempt_count: 1,
    opt_out: true,
    quiet_hours_window: { start: 21, end: 9, timezone: 'Asia/Kolkata' },
    invoice_value_tier: 'standard',
    raw_gateway_error: 'INSUFFICIENT_FUNDS',
    customer_payment_history: {
      on_time_payment_rate: 0.8,
      broken_promise_count: 0,
      tenure_months: 12,
      total_transactions: 10,
      past_recovery_successes: 5,
      past_recovery_failures: 1,
    },
  },
];

describe('Ask the Ledger Query Engine', () => {

  it('answers specific payment queries with exact citations and SHA-256 references', () => {
    const response = queryAuditLedger('Why was payment pay_001 stopped?', MOCK_RECORDS, MOCK_PAYMENTS);

    expect(response.citedPaymentIds).toContain('pay_001');
    expect(response.citedRecordIds).toContain(0);
    expect(response.answer).toContain('PAY_001');
    expect(response.answer).toContain('SAFETY_RULE_HALT_OPT_OUT');
    expect(response.groundingConfidence).toBe('High (Verified Cryptographic Match)');
  });

  it('handles quiet hours inquiries citing appropriate records', () => {
    const response = queryAuditLedger('Which payments had quiet-hours delays?', MOCK_RECORDS, MOCK_PAYMENTS);

    expect(response.citedRecordIds).toContain(1);
    expect(response.answer).toContain('quiet-hours');
    expect(response.groundingConfidence).toBe('High (Verified Cryptographic Match)');
  });

  it('handles empty query gracefully', () => {
    const response = queryAuditLedger('', MOCK_RECORDS, MOCK_PAYMENTS);

    expect(response.citedRecordIds).toHaveLength(0);
    expect(response.groundingConfidence).toBe('No Direct Records Found');
  });
});
