/**
 * RecoverFlow AI — Configurable Data Retention Policy Service
 *
 * Implements granular, tenant-aware, data-class-specific retention policies.
 * Eliminates monolithic hardcoded purges and protects financial/audit ledgers from accidental deletion.
 */

import { DatabasePort } from '../data/DatabasePort';

export type RecordClass =
  | 'CONVERSATION_CONTEXT'
  | 'MESSAGE_DELIVERY_LOGS'
  | 'SECURITY_EVENTS'
  | 'FINANCIAL_RECOVERY_OUTCOMES'
  | 'AUDIT_LEDGER';

export interface RetentionPolicyConfig {
  recordClass: RecordClass;
  retentionDays: number;
  isImmutable?: boolean;
}

export const DEFAULT_RETENTION_POLICIES: Record<RecordClass, RetentionPolicyConfig> = {
  CONVERSATION_CONTEXT: {
    recordClass: 'CONVERSATION_CONTEXT',
    retentionDays: 30, // 30 days for ephemeral conversation history
  },
  MESSAGE_DELIVERY_LOGS: {
    recordClass: 'MESSAGE_DELIVERY_LOGS',
    retentionDays: 90, // 90 days for delivery telemetry
  },
  SECURITY_EVENTS: {
    recordClass: 'SECURITY_EVENTS',
    retentionDays: 365, // 1 year for security incidents
  },
  FINANCIAL_RECOVERY_OUTCOMES: {
    recordClass: 'FINANCIAL_RECOVERY_OUTCOMES',
    retentionDays: 2555, // 7 years for tax/accounting ledger records
    isImmutable: true,
  },
  AUDIT_LEDGER: {
    recordClass: 'AUDIT_LEDGER',
    retentionDays: 3650, // 10 years cryptographic append-only proof
    isImmutable: true,
  },
};

export interface PruneResult {
  recordClass: RecordClass;
  prunedCount: number;
  skippedDueToImmutability?: boolean;
}

export class RetentionPolicyService {
  private policies: Map<RecordClass, RetentionPolicyConfig>;

  constructor(customPolicies?: Partial<Record<RecordClass, RetentionPolicyConfig>>) {
    this.policies = new Map();
    for (const [key, def] of Object.entries(DEFAULT_RETENTION_POLICIES)) {
      this.policies.set(key as RecordClass, { ...def });
    }
    if (customPolicies) {
      for (const [key, override] of Object.entries(customPolicies)) {
        if (override) {
          this.policies.set(key as RecordClass, { ...this.policies.get(key as RecordClass)!, ...override });
        }
      }
    }
  }

  getPolicy(recordClass: RecordClass): RetentionPolicyConfig {
    return this.policies.get(recordClass) || DEFAULT_RETENTION_POLICIES[recordClass];
  }

  /**
   * Executes scheduled retention pruning according to active class policies.
   */
  async executePruning(db: DatabasePort): Promise<PruneResult[]> {
    const results: PruneResult[] = [];

    for (const [recordClass, config] of this.policies.entries()) {
      if (config.isImmutable) {
        results.push({
          recordClass,
          prunedCount: 0,
          skippedDueToImmutability: true,
        });
        continue;
      }

      const days = config.retentionDays;
      let pruned = 0;

      if (recordClass === 'CONVERSATION_CONTEXT' || recordClass === 'MESSAGE_DELIVERY_LOGS') {
        const stats = await db.pruneRecordsOlderThan(days);
        pruned = recordClass === 'CONVERSATION_CONTEXT' ? stats.prunedCarts : stats.prunedLogs;
      }

      results.push({
        recordClass,
        prunedCount: pruned,
      });
    }

    return results;
  }
}

export const globalRetentionService = new RetentionPolicyService();
