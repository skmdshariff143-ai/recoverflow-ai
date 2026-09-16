import { describe, it, expect } from 'vitest';
import {
  buildHashChainedLedger,
  verifyLedgerIntegrity,
  createLedgerCheckpoint,
  verifyLedgerCheckpoint,
  GENESIS_HASH,
} from '@recoverflow/core';
import type { AuditRecord } from '@recoverflow/core';

describe('Hash Chain Audit Ledger — Cryptographic Integrity & Checkpoint Tests', () => {
  const sampleRecords: AuditRecord[] = [
    {
      id: 'aud_1',
      payment_id: 'pay_001',
      timestamp: '2026-03-01T10:00:00Z',
      stage: 'feature_scoring',
      decision: 'SCORED',
      reason: 'Feature vector extracted',
      metadata: { probability: 0.8 },
    },
    {
      id: 'aud_2',
      payment_id: 'pay_001',
      timestamp: '2026-03-01T10:01:00Z',
      stage: 'safety_filter',
      decision: 'PASSED',
      reason: 'Opt-out check clean',
      metadata: { attemptCount: 0 },
    },
    {
      id: 'aud_3',
      payment_id: 'pay_001',
      timestamp: '2026-03-01T10:02:00Z',
      stage: 'intervention_execution',
      decision: 'EXECUTED',
      reason: 'Payment link created',
      metadata: { settled: false },
    },
  ];

  it('Builds valid SHA-256 chain from genesis block', () => {
    const ledger = buildHashChainedLedger(sampleRecords);
    expect(ledger.length).toBe(3);
    expect(ledger[0].previousHash).toBe(GENESIS_HASH);
    expect(ledger[1].previousHash).toBe(ledger[0].currentHash);
    expect(ledger[2].previousHash).toBe(ledger[1].currentHash);

    const check = verifyLedgerIntegrity(ledger);
    expect(check.isValid).toBe(true);
  });

  it('Detects payload mutation at exact tampered index', () => {
    const ledger = buildHashChainedLedger(sampleRecords);
    // Mutate record 1
    ledger[1].decision = 'FORGED_DECISION';

    const check = verifyLedgerIntegrity(ledger);
    expect(check.isValid).toBe(false);
    expect(check.tamperedIndex).toBe(1);
    expect(check.errorDetail).toContain('Payload tampering detected at record 1');
  });

  it('Detects record deletion and sequence gap', () => {
    const ledger = buildHashChainedLedger(sampleRecords);
    // Delete middle record
    const deletedLedger = [ledger[0], ledger[2]];

    const check = verifyLedgerIntegrity(deletedLedger);
    expect(check.isValid).toBe(false);
    expect(check.tamperedIndex).toBe(1);
  });

  it('Creates and validates cryptographically signed checkpoints', () => {
    const ledger = buildHashChainedLedger(sampleRecords);
    const secret = 'test_secret_audit_key';
    const checkpoint = createLedgerCheckpoint(ledger, secret);

    expect(checkpoint.recordCount).toBe(3);
    expect(checkpoint.blockHash).toBe(ledger[2].currentHash);

    const validCheck = verifyLedgerCheckpoint(ledger, checkpoint, secret);
    expect(validCheck.valid).toBe(true);

    // Tampered secret or signature fails
    const invalidCheck = verifyLedgerCheckpoint(ledger, checkpoint, 'wrong_secret');
    expect(invalidCheck.valid).toBe(false);
  });
});
