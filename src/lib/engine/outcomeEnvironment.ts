/**
 * RecoverFlow AI — Independent Structural Outcome Environment.
 *
 * This module models the ground-truth physical reality of recovery outcomes.
 * CRITICAL ARCHITECTURAL SEPARATION:
 *   - This environment NEVER reads predicted recovery probability, expected value,
 *     queue rank, or model confidence.
 *   - It generates frozen potential outcomes for every [record x intervention x attempt]
 *     based strictly on independent causal transition dynamics (e.g. gateway clearance rate,
 *     customer liquidity arrival probability, channel responsiveness, and dispute risk).
 */

import type { FailedPayment, FailureCategory, InterventionType } from '@/types';

export interface PotentialOutcome {
  recovered: boolean;
  settledAmountPaise: number;
  disputed: boolean;
  latencyMinutes: number;
  reason: string;
}

export interface FrozenPotentialOutcomes {
  payment_id: string;
  // Matrix of potential outcomes across interventions and attempts (1, 2, 3)
  outcomes: Record<InterventionType, Record<number, PotentialOutcome>>;
}

/**
 * Seeded Mulberry32 Pseudo-Random Number Generator.
 */
function createMulberry32(seed: number) {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Empirical Base Ground-Truth Conversion Probabilities by Failure Root Cause.
 * Independent of the model's subjective priors.
 */
const CAUSAL_CONVERSION_BASE: Record<FailureCategory, { retry: number; reminder: number; both: number }> = {
  bank_downtime: { retry: 0.82, reminder: 0.20, both: 0.85 },
  gateway_degradation: { retry: 0.80, reminder: 0.25, both: 0.82 },
  duplicate_attempt: { retry: 0.90, reminder: 0.10, both: 0.90 },
  auth_failure: { retry: 0.30, reminder: 0.65, both: 0.72 },
  insufficient_funds: { retry: 0.40, reminder: 0.50, both: 0.60 },
  expired_card: { retry: 0.05, reminder: 0.70, both: 0.72 },
  invalid_mandate: { retry: 0.02, reminder: 0.45, both: 0.46 },
  broken_promise_to_pay: { retry: 0.10, reminder: 0.22, both: 0.25 },
  customer_cancellation: { retry: 0.00, reminder: 0.04, both: 0.04 },
  permanent_account_closure: { retry: 0.00, reminder: 0.00, both: 0.00 },
};

/**
 * Generate frozen, deterministic potential outcomes for a payment.
 */
export function generatePotentialOutcomes(
  payment: FailedPayment,
  seed: number = 42,
): FrozenPotentialOutcomes {
  // Use payment ID hash + global seed for independent per-record stream
  let idHash = 0;
  for (let i = 0; i < payment.payment_id.length; i++) {
    idHash = (idHash * 31 + payment.payment_id.charCodeAt(i)) | 0;
  }
  const rng = createMulberry32(seed ^ idHash);

  const cat = payment.failure_category;
  const rates = CAUSAL_CONVERSION_BASE[cat] ?? { retry: 0.3, reminder: 0.3, both: 0.4 };
  const history = payment.customer_payment_history;

  // Causal customer discipline modifier [-0.2, +0.2]
  const disciplineMod = (history.on_time_payment_rate - 0.5) * 0.35;
  const promiseMod = -(Math.min(3, history.broken_promise_count) * 0.12);

  const interventions: InterventionType[] = ['retry', 'reminder', 'both', 'none'];
  const outcomes: Record<InterventionType, Record<number, PotentialOutcome>> = {
    retry: {},
    reminder: {},
    both: {},
    none: {},
  };

  for (const intervention of interventions) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (intervention === 'none') {
        outcomes[intervention][attempt] = {
          recovered: false,
          settledAmountPaise: 0,
          disputed: false,
          latencyMinutes: 0,
          reason: 'No intervention performed (control / stopped).',
        };
        continue;
      }

      // Hard physical stop conditions (opt-out, closed account, hard cancellation)
      if (payment.opt_out || cat === 'permanent_account_closure' || cat === 'customer_cancellation') {
        outcomes[intervention][attempt] = {
          recovered: false,
          settledAmountPaise: 0,
          disputed: false,
          latencyMinutes: 0,
          reason: 'Hard non-recoverable account state (opt-out / terminal closure / hard cancellation).',
        };
        continue;
      }

      // Base conversion with attempt fatigue decay (Attempt 2 = -15%, Attempt 3 = -30%)
      const baseProb = rates[intervention];
      const attemptDecay = attempt === 1 ? 1.0 : attempt === 2 ? 0.75 : 0.50;
      const trueProb = Math.max(0.01, Math.min(0.98, (baseProb + disciplineMod + promiseMod) * attemptDecay));

      const roll = rng();
      const isRecovered = roll < trueProb;
      const disputeRoll = rng();
      const isDisputed = isRecovered && disputeRoll < 0.02; // 2% baseline dispute rate

      outcomes[intervention][attempt] = {
        recovered: isRecovered && !isDisputed,
        settledAmountPaise: isRecovered && !isDisputed ? payment.amount : 0,
        disputed: isDisputed,
        latencyMinutes: Math.round(5 + rng() * 120),
        reason: isRecovered
          ? `Settled via ${intervention} on attempt ${attempt}`
          : `Attempt ${attempt} exhausted without settlement`,
      };
    }
  }

  return {
    payment_id: payment.payment_id,
    outcomes,
  };
}

/**
 * Pre-generate frozen potential outcomes map for an entire batch.
 */
export function buildFrozenOutcomeEnvironment(
  payments: FailedPayment[],
  seed: number = 42,
): Map<string, FrozenPotentialOutcomes> {
  const map = new Map<string, FrozenPotentialOutcomes>();
  for (const payment of payments) {
    map.set(payment.payment_id, generatePotentialOutcomes(payment, seed));
  }
  return map;
}
