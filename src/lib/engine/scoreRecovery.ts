/**
 * RecoverFlow AI — Deterministic Recovery Scoring Engine.
 *
 * Scores each failed payment for recovery probability and expected
 * value using a transparent, auditable, category-anchored formula.
 * Every weight is a named constant — no magic numbers.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  SCORING FORMULA                                                │
 * │                                                                 │
 * │  multiplier = (                                                 │
 * │      W_BASE_SCALE                                               │
 * │    + W_RELIABILITY × on_time_payment_rate                       │
 * │    + W_RECENCY × exp(−days_since_failure / RECENCY_DECAY_DAYS)  │
 * │    + W_TENURE × min(tenure_months / TENURE_SAT_MONTHS, 1)       │
 * │    − min(broken_promise_count × W_PROMISE_PER, W_PROMISE_MAX)   │
 * │    − min(attempt_count × W_ATTEMPT_PER, W_ATTEMPT_MAX)          │
 * │  )                                                              │
 * │                                                                 │
 * │  raw_probability = base_rate[category] × multiplier             │
 * │  recovery_probability = clamp(0, 1, raw_probability)            │
 * │  expected_value = recovery_probability × amount                 │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * By using the category base rate as the primary anchor/ceiling,
 * permanent failures (account closures, hard cancellations) naturally
 * score near 0 regardless of historical customer reliability, while
 * recoverable infrastructure issues (bank downtime, gateway latency)
 * scale up based on customer reliability and recency.
 *
 * Because multiplication distributes over addition:
 *   Score = Base_Rate × W_BASE_SCALE
 *         + Base_Rate × W_RELIABILITY × on_time_rate
 *         + Base_Rate × W_RECENCY × recency_decay
 *         + Base_Rate × W_TENURE × tenure_frac
 *         − Base_Rate × promise_penalty
 *         − Base_Rate × attempt_penalty
 *
 * Every factor's signed contribution sums exactly to raw_probability,
 * providing a 100% transparent and auditable "why this score" trace.
 */

import type { FailedPayment, FailureCategory } from '@/types';
import { calculateExpectedValuePaise, probabilityToBps } from './financial';

// ─── Category Base Recovery Rates ────────────────────────────────────
//
// Empirical base rates representing what fraction of payments in each
// category are typically recoverable. These anchor the score ceiling.
//
// Rationale for each:
//  • duplicate_attempt (0.85):  Usually already paid; dedup resolution.
//  • bank_downtime (0.78):     Infrastructure failure, not customer fault.
//  • gateway_degradation (0.75): Temporary; retries often succeed.
//  • auth_failure (0.55):      Customer can retry authentication.
//  • expired_card (0.50):      Customer can update payment method.
//  • insufficient_funds (0.42): Time-dependent; funds may arrive.
//  • invalid_mandate (0.32):   Needs mandate renewal — friction.
//  • broken_promise_to_pay (0.16): History of non-payment.
//  • customer_cancellation (0.06): Intentional — rarely reversed.
//  • permanent_account_closure (0.02): Near-permanent.

export const CATEGORY_BASE_RATES: Readonly<Record<FailureCategory, number>> = {
  duplicate_attempt:          0.85,
  bank_downtime:              0.78,
  gateway_degradation:        0.75,
  auth_failure:               0.55,
  expired_card:               0.50,
  insufficient_funds:         0.42,
  invalid_mandate:            0.32,
  broken_promise_to_pay:      0.16,
  customer_cancellation:      0.06,
  permanent_account_closure:  0.02,
};

// ─── Scoring Weights ─────────────────────────────────────────────────
//
// Every weight is a named constant. To tune the model, adjust these
// values — no code changes needed elsewhere.

export const SCORING_WEIGHTS = {
  /** Base scale baseline for the category multiplier. */
  W_BASE_SCALE:     0.55,

  /** Weight for customer on-time payment rate (0–1 input). */
  W_RELIABILITY:    0.50,

  /** Penalty applied per broken promise-to-pay event. */
  W_PROMISE_PER:    0.08,
  /** Maximum total penalty from broken promises. */
  W_PROMISE_MAX:    0.25,

  /** Weight for failure recency (exponential decay). */
  W_RECENCY:        0.20,
  /** Time constant in days for recency decay (1/e ≈ 37% at this age). */
  RECENCY_DECAY_DAYS: 14,

  /** Weight for customer tenure bonus (longer = more trustworthy). */
  W_TENURE:         0.10,
  /** Tenure bonus saturates at this many months. */
  TENURE_SAT_MONTHS: 36,

  /** Penalty applied per prior failed recovery attempt. */
  W_ATTEMPT_PER:    0.10,
  /** Maximum total penalty from prior attempts. */
  W_ATTEMPT_MAX:    0.25,
} as const;

// ─── Default Reference Date ──────────────────────────────────────────
// Matches the synthetic data generator's reference date for consistency.

const DEFAULT_REFERENCE_DATE = new Date('2025-08-30T00:00:00Z');

// ─── Public Types ───────────────────────────────────────────────────

export interface ScoringConfig {
  /** Reference date for recency calculation. Default: 2025-08-30. */
  referenceDate?: Date;
  /** Scoring model algorithm to apply. Default: 'heuristic'. */
  modelType?: 'heuristic' | 'trained_logistic';
}

/** A single factor's contribution to the recovery score. */
export interface ScoreExplanationFactor {
  /** Internal factor key (e.g. 'category_base_rate'). */
  factor: string;
  /** Short human-readable label. */
  label: string;
  /** Signed contribution to the raw score. */
  contribution: number;
  /** Full human-readable explanation referencing actual values. */
  detail: string;
}

/** Scored output for a single payment. */
export interface PaymentScore {
  payment_id: string;
  /** Recovery probability in [0, 1]. */
  recovery_probability: number;
  /** Expected recovered value = probability × amount. */
  expected_value: number;
  /** Contributing factors, sorted by |contribution| descending. */
  explanation: ScoreExplanationFactor[];
  /** Model version used to generate this score (e.g. 'v1.0.0-heuristic', 'v1.1.0-logistic-calibrated'). */
  model_version?: string;
}

// ─── Main Scoring Function ──────────────────────────────────────────

/**
 * Score a single payment for recovery probability and expected value.
 *
 * Pure function — no side effects, fully deterministic for the same
 * input + config. Tracks every factor's contribution for explainability.
 */
export function scorePayment(
  payment: FailedPayment,
  config: ScoringConfig = {},
): PaymentScore {
  const refDate = config.referenceDate ?? DEFAULT_REFERENCE_DATE;
  const W = SCORING_WEIGHTS;

  // ── Feature extraction ──────────────────────────────────────────
  const baseRate = CATEGORY_BASE_RATES[payment.failure_category];
  const onTimeRate = payment.customer_payment_history.on_time_payment_rate;
  const brokenCount = payment.customer_payment_history.broken_promise_count;
  const tenureMonths = payment.customer_payment_history.tenure_months;
  const daysSince = Math.max(
    0,
    (refDate.getTime() - new Date(payment.failure_timestamp).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  const attempts = payment.attempt_count;

  // ── Contribution calculations (distributed over baseRate) ───────
  const factors: ScoreExplanationFactor[] = [];

  // 1. Category base anchor
  const cBase = baseRate * W.W_BASE_SCALE;
  factors.push({
    factor: 'category_base_rate',
    label: 'Category Base Rate',
    contribution: round4(cBase),
    detail:
      `Failure category '${payment.failure_category}' has ` +
      `${pct(baseRate)} base recovery rate → ${fmt(cBase)} baseline`,
  });

  // 2. Customer reliability (on-time payment rate)
  const cReliability = baseRate * (W.W_RELIABILITY * onTimeRate);
  factors.push({
    factor: 'customer_reliability',
    label: 'Customer Reliability',
    contribution: round4(cReliability),
    detail:
      `Customer on-time payment rate: ${pct(onTimeRate)} → ${fmt(cReliability)}`,
  });

  // 3. Broken promise penalty
  const promisePenalty = Math.min(brokenCount * W.W_PROMISE_PER, W.W_PROMISE_MAX);
  const cPromise = -baseRate * promisePenalty;
  factors.push({
    factor: 'broken_promises',
    label: 'Broken Promises',
    contribution: round4(cPromise),
    detail:
      brokenCount > 0
        ? `${brokenCount} broken payment promise${brokenCount > 1 ? 's' : ''} → ${fmt(cPromise)}`
        : 'No broken promises → +0.000',
  });

  // 4. Recency (exponential decay — recent failures are more recoverable)
  const recencyDecay = Math.exp(-daysSince / W.RECENCY_DECAY_DAYS);
  const cRecency = baseRate * (W.W_RECENCY * recencyDecay);
  factors.push({
    factor: 'recency',
    label: 'Failure Recency',
    contribution: round4(cRecency),
    detail:
      `Failed ${Math.round(daysSince)} day${Math.round(daysSince) !== 1 ? 's' : ''} ago ` +
      `(recency strength: ${pct(recencyDecay)}) → ${fmt(cRecency)}`,
  });

  // 5. Customer tenure
  const tenureFrac = Math.min(tenureMonths / W.TENURE_SAT_MONTHS, 1.0);
  const cTenure = baseRate * (W.W_TENURE * tenureFrac);
  factors.push({
    factor: 'tenure',
    label: 'Customer Tenure',
    contribution: round4(cTenure),
    detail:
      `Customer tenure: ${tenureMonths} month${tenureMonths !== 1 ? 's' : ''} → ${fmt(cTenure)}`,
  });

  // 6. Prior attempt penalty
  const attemptPenalty = Math.min(attempts * W.W_ATTEMPT_PER, W.W_ATTEMPT_MAX);
  const cAttempts = -baseRate * attemptPenalty;
  factors.push({
    factor: 'prior_attempts',
    label: 'Prior Attempts',
    contribution: round4(cAttempts),
    detail:
      attempts > 0
        ? `${attempts} prior failed attempt${attempts > 1 ? 's' : ''} → ${fmt(cAttempts)}`
        : 'No prior attempts → +0.000',
  });

  // ── Aggregate & clamp ───────────────────────────────────────────
  const rawScore = cBase + cReliability + cPromise + cRecency + cTenure + cAttempts;
  const probability = round4(clamp(rawScore, 0, 1));
  const expectedValue = calculateExpectedValuePaise(payment.amount, probabilityToBps(probability));

  // Sort by |contribution| descending for the explanation.
  const sortedExplanation = [...factors].sort(
    (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution),
  );

  return {
    payment_id: payment.payment_id,
    recovery_probability: probability,
    expected_value: expectedValue,
    explanation: sortedExplanation,
    model_version: 'v1.0.0-heuristic',
  };
}

// ─── Batch Scoring ──────────────────────────────────────────────────

/** Score an array of payments. Pure, no side effects. */
export function scorePaymentBatch(
  payments: FailedPayment[],
  config: ScoringConfig = {},
): PaymentScore[] {
  return payments.map((p) => scorePayment(p, config));
}

// ─── Formatting Helpers ─────────────────────────────────────────────

function fmt(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(3)}`;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
