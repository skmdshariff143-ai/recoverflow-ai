/**
 * PayBack AI — Tamper-Evident SHA-256 Hash-Chained Audit Ledger.
 *
 * Upgrades flat session audit logs into a verifiable cryptographic hash chain:
 *   Record[0]: PrevHash = "0000000000000000000000000000000000000000000000000000000000000000" (Genesis)
 *   Record[i]: CurrentHash = SHA256(Record[i-1].CurrentHash + JSON(Payload[i]))
 *
 * Implements verifyLedgerIntegrity() to detect any mutation or deletion in real time.
 */

import { createHash } from 'crypto';
import type { AuditRecord } from './auditTrail';

export interface ChainedAuditRecord extends AuditRecord {
  sequenceIndex: number;
  previousHash: string;
  currentHash: string;
}

export interface LedgerVerificationResult {
  isValid: boolean;
  totalRecords: number;
  genesisHash: string;
  latestHash: string;
  tamperedIndex?: number;
  errorDetail?: string;
}

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Compute SHA-256 hash of a string.
 */
function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf-8').digest('hex');
}

/**
 * Build a cryptographic hash-chained audit ledger from standard audit records.
 */
export function buildHashChainedLedger(records: AuditRecord[]): ChainedAuditRecord[] {
  const chained: ChainedAuditRecord[] = [];
  let prevHash = GENESIS_HASH;

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const payload = JSON.stringify({
      id: r.id,
      payment_id: r.payment_id,
      timestamp: r.timestamp,
      stage: r.stage,
      decision: r.decision,
      reason: r.reason,
      metadata: r.metadata,
    });

    const currentHash = sha256(`${prevHash}:${i}:${payload}`);

    chained.push({
      ...r,
      sequenceIndex: i,
      previousHash: prevHash,
      currentHash,
    });

    prevHash = currentHash;
  }

  return chained;
}

/**
 * Verify cryptographic integrity of the audit ledger.
 */
export function verifyLedgerIntegrity(ledger: ChainedAuditRecord[]): LedgerVerificationResult {
  if (ledger.length === 0) {
    return {
      isValid: true,
      totalRecords: 0,
      genesisHash: GENESIS_HASH,
      latestHash: GENESIS_HASH,
    };
  }

  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < ledger.length; i++) {
    const item = ledger[i];

    if (item.sequenceIndex !== i) {
      return {
        isValid: false,
        totalRecords: ledger.length,
        genesisHash: GENESIS_HASH,
        latestHash: ledger[ledger.length - 1].currentHash,
        tamperedIndex: i,
        errorDetail: `Sequence mismatch at record ${i}: expected index ${i}, found ${item.sequenceIndex}`,
      };
    }

    if (item.previousHash !== expectedPrevHash) {
      return {
        isValid: false,
        totalRecords: ledger.length,
        genesisHash: GENESIS_HASH,
        latestHash: ledger[ledger.length - 1].currentHash,
        tamperedIndex: i,
        errorDetail: `Hash break at record ${i}: expected previous hash ${expectedPrevHash}, found ${item.previousHash}`,
      };
    }

    const payload = JSON.stringify({
      id: item.id,
      payment_id: item.payment_id,
      timestamp: item.timestamp,
      stage: item.stage,
      decision: item.decision,
      reason: item.reason,
      metadata: item.metadata,
    });

    const expectedCurrentHash = sha256(`${expectedPrevHash}:${i}:${payload}`);
    if (item.currentHash !== expectedCurrentHash) {
      return {
        isValid: false,
        totalRecords: ledger.length,
        genesisHash: GENESIS_HASH,
        latestHash: ledger[ledger.length - 1].currentHash,
        tamperedIndex: i,
        errorDetail: `Payload tampering detected at record ${i} (${item.id}): hash mismatch.`,
      };
    }

    expectedPrevHash = item.currentHash;
  }

  return {
    isValid: true,
    totalRecords: ledger.length,
    genesisHash: GENESIS_HASH,
    latestHash: ledger[ledger.length - 1].currentHash,
  };
}

/**
 * Create a tampered working copy of the ledger for interactive live demonstration.
 * Mutates a specific field on a cloned ledger without modifying the source ledger.
 */
export function tamperWorkingLedgerCopy(
  ledger: ChainedAuditRecord[],
  targetRecordId: string,
  fieldToTamper: 'decision' | 'reason' = 'decision',
  tamperedValue: string = 'UNAUTHORIZED_MUTATION: Bypassed Safety Checks',
): { tamperedLedger: ChainedAuditRecord[]; targetIndex: number } {
  const cloned: ChainedAuditRecord[] = ledger.map((item) => ({ ...item }));
  const targetIndex = cloned.findIndex((r) => r.id === targetRecordId);

  if (targetIndex !== -1) {
    cloned[targetIndex] = {
      ...cloned[targetIndex],
      [fieldToTamper]: tamperedValue,
    };
  }

  return { tamperedLedger: cloned, targetIndex };
}

