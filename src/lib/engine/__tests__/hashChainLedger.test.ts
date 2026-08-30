/**
 * Unit tests for RecoverFlow AI SHA-256 Hash-Chained Audit Ledger (Phase 8).
 */

import { describe, it, expect } from 'vitest';
import {
  buildHashChainedLedger,
  verifyLedgerIntegrity,
  GENESIS_HASH,
} from '../hashChainLedger';
import type { AuditRecord } from '../auditTrail';

describe('Tamper-Evident SHA-256 Hash-Chained Audit Ledger', () => {

  const sampleRecords: AuditRecord[] = [
    {
      id: 'aud_000001',
      payment_id: 'pay_001',
      timestamp: '2025-08-30T10:00:01Z',
      stage: 'feature_scoring',
      decision: 'Scored recovery probability: 78.5%',
      reason: 'Bank downtime high recoverable baseline',
      metadata: { probability: 0.785 },
    },
    {
      id: 'aud_000002',
      payment_id: 'pay_001',
      timestamp: '2025-08-30T10:00:02Z',
      stage: 'safety_filter',
      decision: 'Eligible for recovery',
      reason: 'No opt-out flag; within 3 attempts limit',
    },
    {
      id: 'aud_000003',
      payment_id: 'pay_001',
      timestamp: '2025-08-30T10:00:03Z',
      stage: 'intervention_execution',
      decision: 'Payment recovered',
      reason: 'Captured ₹5,000 via automated gateway retry',
    },
  ];

  it('builds continuous SHA-256 hash chain starting from genesis hash', () => {
    const ledger = buildHashChainedLedger(sampleRecords);

    expect(ledger.length).toBe(3);
    expect(ledger[0].previousHash).toBe(GENESIS_HASH);
    expect(ledger[1].previousHash).toBe(ledger[0].currentHash);
    expect(ledger[2].previousHash).toBe(ledger[1].currentHash);

    // Verify integrity passes on clean ledger
    const verification = verifyLedgerIntegrity(ledger);
    expect(verification.isValid).toBe(true);
    expect(verification.totalRecords).toBe(3);
    expect(verification.latestHash).toBe(ledger[2].currentHash);
  });

  it('detects payload tampering immediately and identifies exact compromised index', () => {
    const ledger = buildHashChainedLedger(sampleRecords);

    // Tamper with record 1's decision payload
    ledger[1].decision = 'ILLEGALLY MODIFIED DECISION';

    const verification = verifyLedgerIntegrity(ledger);
    expect(verification.isValid).toBe(false);
    expect(verification.tamperedIndex).toBe(1);
    expect(verification.errorDetail).toContain('Payload tampering detected');
  });

  it('detects deletion or re-ordering of audit events in the ledger', () => {
    const ledger = buildHashChainedLedger(sampleRecords);

    // Delete middle record
    const splicedLedger = [ledger[0], ledger[2]];

    const verification = verifyLedgerIntegrity(splicedLedger);
    expect(verification.isValid).toBe(false);
    expect(verification.tamperedIndex).toBe(1);
  });
});
