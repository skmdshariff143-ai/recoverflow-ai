/**
 * PayBack AI — Multi-Merchant Risk Profiles & Policy Presets.
 *
 * Demonstrates configurable platform risk appetites across 3 presets:
 *  - Conservative: Strict human approvals (₹25k), tight contact cap (20 slots), minimal retry friction
 *  - Balanced: Default EV-optimal orchestration (40 slots, ₹50k threshold)
 *  - Aggressive: High-velocity revenue recovery (60 slots, ₹100k threshold)
 */

import type { FailedPayment } from '@/types';
import { runRecoveryBatch } from './runBatch';

export type MerchantProfileId = 'conservative' | 'balanced' | 'aggressive';

export interface MerchantRiskProfile {
  id: MerchantProfileId;
  name: string;
  tagline: string;
  budgetSlots: number;
  approvalThresholdINR: number;
  maxAttempts: number;
  autoApproveHighValueWithHighEV: boolean;
  description: string;
}

export const MERCHANT_PROFILES: Record<MerchantProfileId, MerchantRiskProfile> = {
  conservative: {
    id: 'conservative',
    name: 'Conservative Merchant',
    tagline: 'High Governance & Low Friction',
    budgetSlots: 20,
    approvalThresholdINR: 25000,
    maxAttempts: 2,
    autoApproveHighValueWithHighEV: false,
    description: 'Prioritizes customer goodwill and low dispute risk. Restricts outreach to top 20 slots and enforces manual human approvals for invoices above ₹25,000.',
  },
  balanced: {
    id: 'balanced',
    name: 'Balanced Enterprise (Default)',
    tagline: 'Optimal EV & Standard Invariants',
    budgetSlots: 40,
    approvalThresholdINR: 50000,
    maxAttempts: 3,
    autoApproveHighValueWithHighEV: true,
    description: 'Standard PayBack AI orchestration. Balances high recovery yield with strict quiet hours, hard safety stops, and integer-paise EV ranking.',
  },
  aggressive: {
    id: 'aggressive',
    name: 'High-Velocity Merchant',
    tagline: 'Maximized Yield & Broader Outreach',
    budgetSlots: 60,
    approvalThresholdINR: 100000,
    maxAttempts: 3,
    autoApproveHighValueWithHighEV: true,
    description: 'Maximal revenue capture across mid and lower probability cohorts. Expands budget to 60 slots to recover maximum top-line cash.',
  },
};

export interface MerchantProfileEvaluationResult {
  profile: MerchantRiskProfile;
  budgetedSlots: number;
  recoveredCount: number;
  recoveredAmountINR: number;
  recoveredAmountPaise: number;
  overallRecoveryRatePercent: number;
  cohortRecoveryRatePercent: number;
  calibrationErrorPercent: number;
  brierScore: number;
  unnecessaryRetryRatePercent: number;
  safetyStopsCount: number;
  pendingApprovalCount: number;
}

/**
 * Evaluate all 3 merchant profiles on the exact same underlying payment cohort.
 */
export function evaluateAllMerchantProfiles(
  payments: FailedPayment[],
  seed = 42,
): MerchantProfileEvaluationResult[] {
  const profileKeys: MerchantProfileId[] = ['conservative', 'balanced', 'aggressive'];

  return profileKeys.map((key) => {
    const profile = MERCHANT_PROFILES[key];
    const batchResult = runRecoveryBatch(payments, {
      budget: profile.budgetSlots,
      autoApproveHighValueWithHighEV: profile.autoApproveHighValueWithHighEV,
      simulationSeed: seed,
    });

    const budgetedItems = batchResult.executed_items.filter(
      (item) => item.status === 'budgeted',
    );
    const recoveredBudgeted = budgetedItems.filter(
      (item) => item.execution_status === 'recovered',
    );
    const failedBudgeted = budgetedItems.filter(
      (item) => item.execution_status !== 'recovered',
    );

    const cohortRecoveryRate =
      budgetedItems.length > 0
        ? (recoveredBudgeted.length / budgetedItems.length) * 100
        : 0;

    const unnecessaryRetryRate =
      budgetedItems.length > 0
        ? (failedBudgeted.length / budgetedItems.length) * 100
        : 0;

    const pendingApprovals = batchResult.summary.items.filter(
      (item) => item.status === 'pending_approval',
    ).length;

    return {
      profile,
      budgetedSlots: profile.budgetSlots,
      recoveredCount: recoveredBudgeted.length,
      recoveredAmountINR: batchResult.total_revenue_recovered,
      recoveredAmountPaise: Math.round(batchResult.total_revenue_recovered * 100),
      overallRecoveryRatePercent: Number(
        (batchResult.overall_recovery_rate * 100).toFixed(1),
      ),
      cohortRecoveryRatePercent: Number(cohortRecoveryRate.toFixed(1)),
      calibrationErrorPercent: Number(
        (batchResult.calibration.overall_calibration_error * 100).toFixed(2),
      ),
      brierScore: Number(batchResult.calibration.brier_score.toFixed(4)),
      unnecessaryRetryRatePercent: Number(unnecessaryRetryRate.toFixed(1)),
      safetyStopsCount: batchResult.summary.stopped_count,
      pendingApprovalCount: pendingApprovals,
    };
  });
}
