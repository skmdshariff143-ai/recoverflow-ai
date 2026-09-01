/**
 * PayBack AI — Cost of Inaction Calculator.
 *
 * Quantifies the financial decay of unprocessed failed payments over time.
 * In recurring subscription and invoice recovery, payment recoverability drops
 * non-linearly with latency (e.g. customer churn, bank mandate invalidation, card expiry).
 *
 * Assumption Model:
 * Standard industry benchmark: ~0.75% recoverability decay per hour (75 bps/hr),
 * equivalent to an ~18% cumulative loss of recoverable revenue if left unaddressed for 24 hours.
 */

export const DEFAULT_HOURLY_DECAY_BPS = 75; // 0.75% per hour

export interface CostOfInactionMetrics {
  totalRevenueAtRiskPaise: number;
  hourlyDecayRateBps: number;
  hourlyLossPaise: number;
  hourlyLossRupees: number;
  lossPerSecondPaise: number;
  decayRatePercentage: number;
}

/**
 * Calculates the estimated hourly financial decay for a batch of unprocessed at-risk revenue.
 *
 * @param totalRevenueAtRiskPaise Total at-risk revenue in integer paise.
 * @param hourlyDecayRateBps Hourly decay rate in basis points (default: 75 = 0.75%).
 * @returns CostOfInactionMetrics structured calculation.
 */
export function calculateCostOfInaction(
  totalRevenueAtRiskPaise: number,
  hourlyDecayRateBps: number = DEFAULT_HOURLY_DECAY_BPS,
): CostOfInactionMetrics {
  const safeAtRisk = Math.max(0, Math.round(totalRevenueAtRiskPaise));
  const safeBps = Math.max(0, Math.min(10000, Math.round(hourlyDecayRateBps)));

  // Integer paise arithmetic to prevent float drift
  const hourlyLossPaise = Math.round((safeAtRisk * safeBps) / 10000);
  const hourlyLossRupees = Number((hourlyLossPaise / 100).toFixed(2));
  const lossPerSecondPaise = hourlyLossPaise / 3600;
  const decayRatePercentage = Number((safeBps / 100).toFixed(2));

  return {
    totalRevenueAtRiskPaise: safeAtRisk,
    hourlyDecayRateBps: safeBps,
    hourlyLossPaise,
    hourlyLossRupees,
    lossPerSecondPaise,
    decayRatePercentage,
  };
}
