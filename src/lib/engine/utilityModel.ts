/**
 * PayBack AI — Extensible Multi-Factor Utility & Optimization Engine.
 *
 * Provides a formal utility abstraction:
 *   Utility = ExpectedRecoveredValue - InterventionCost - ExpectedDisputeCost - CustomerFrictionCost - ComplianceRiskCost
 *
 * Keeps pure Expected Value (EV) as the default canonical model while allowing
 * enterprise risk-adjusted optimization policies.
 */

import type { FailedPayment } from '@/types';
import { calculateExpectedValuePaise, calculateInterventionCostPaise, asPaise, Paise } from './financial';

export interface RecoveryContext {
  payment: FailedPayment;
  predictedProbability: number;
  selectedIntervention: 'retry' | 'reminder' | 'both' | 'none';
  disputeRiskRate?: number;
  frictionWeightPaise?: number;
}

export interface UtilityScore {
  utilityPaise: Paise;
  expectedRecoveredPaise: Paise;
  interventionCostPaise: Paise;
  disputePenaltyPaise: Paise;
  frictionCostPaise: Paise;
  isActionable: boolean;
  explanation: string;
}

export interface UtilityModel {
  readonly modelName: string;
  score(context: RecoveryContext): UtilityScore;
}

/**
 * Baseline Canonical Model: Pure Expected Value without speculative friction multipliers.
 * Utility = Math.round(Amount * Probability) - InterventionCost
 */
export class ExpectedValueUtilityModel implements UtilityModel {
  readonly modelName = 'canonical_expected_value';

  score(context: RecoveryContext): UtilityScore {
    const amount = context.payment.amount;
    const probBps = Math.round(context.predictedProbability * 10_000);
    const expectedRecovered = asPaise(calculateExpectedValuePaise(amount, probBps));
    const cost = asPaise(calculateInterventionCostPaise(context.selectedIntervention));

    const netUtility = asPaise(Math.max(0, expectedRecovered - cost));

    return {
      utilityPaise: netUtility,
      expectedRecoveredPaise: expectedRecovered,
      interventionCostPaise: cost,
      disputePenaltyPaise: asPaise(0),
      frictionCostPaise: asPaise(0),
      isActionable: netUtility > 0 && context.selectedIntervention !== 'none',
      explanation: `Expected revenue of ₹${(expectedRecovered / 100).toFixed(2)} minus operational cost ₹${(cost / 100).toFixed(2)}.`,
    };
  }
}

/**
 * Enterprise Risk-Adjusted Model: Factors dispute penalties and customer churn friction.
 */
export class RiskAdjustedUtilityModel implements UtilityModel {
  readonly modelName = 'risk_adjusted_utility';

  constructor(
    private disputeCostMultiplier: number = 2.0, // Cost of dispute = 2x payment fee
    private defaultDisputeRate: number = 0.02,
  ) {}

  score(context: RecoveryContext): UtilityScore {
    const amount = context.payment.amount;
    const probBps = Math.round(context.predictedProbability * 10_000);
    const expectedRecovered = asPaise(calculateExpectedValuePaise(amount, probBps));
    const cost = asPaise(calculateInterventionCostPaise(context.selectedIntervention));

    const disputeRate = context.disputeRiskRate ?? this.defaultDisputeRate;
    const disputePenalty = asPaise(Math.round(amount * disputeRate * this.disputeCostMultiplier));
    const frictionCost = asPaise(context.frictionWeightPaise ?? (context.selectedIntervention === 'both' ? 50 : 0));

    const rawUtility = expectedRecovered - cost - disputePenalty - frictionCost;
    const utilityPaise = asPaise(Math.max(0, rawUtility));

    return {
      utilityPaise,
      expectedRecoveredPaise: expectedRecovered,
      interventionCostPaise: cost,
      disputePenaltyPaise: disputePenalty,
      frictionCostPaise: frictionCost,
      isActionable: utilityPaise > 0 && context.selectedIntervention !== 'none',
      explanation: `Expected recovery ₹${(expectedRecovered / 100).toFixed(2)} adjusted for fee ₹${(cost / 100).toFixed(2)}, dispute risk ₹${(disputePenalty / 100).toFixed(2)}, and friction ₹${(frictionCost / 100).toFixed(2)}.`,
    };
  }
}

export const defaultUtilityModel: UtilityModel = new ExpectedValueUtilityModel();
