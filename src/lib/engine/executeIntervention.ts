/**
 * RecoverFlow AI — Test-Mode Intervention Execution Engine.
 *
 * Simulates recovery outcomes for budgeted payments stochastically,
 * weighted by the payment's calculated recovery probability.
 *
 * Strictly TEST-MODE ONLY:
 *  - No external HTTP requests.
 *  - No real gateway invocations or customer communications.
 *  - Seeded PRNG for reproducible test and demonstration runs.
 *  - Enforces safety halts on customer disputes and attempt caps.
 */

import type {
  PipelineItem,
  ExecutedItem,
  PipelineOptions,
} from '@/types';
import { MAX_RECOVERY_ATTEMPTS } from './safetyFilter';

// ─── Seeded PRNG (xoshiro128**) ─────────────────────────────────────

function createSeededRandom(seed: number): () => number {
  function splitmix32(s: number): number {
    s |= 0;
    s = (s + 0x9e3779b9) | 0;
    let t = s ^ (s >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    t = t ^ (t >>> 15);
    return t >>> 0;
  }

  let s0 = splitmix32(seed);
  let s1 = splitmix32(s0);
  let s2 = splitmix32(s1);
  let s3 = splitmix32(s2);

  return function xoshiro128ss(): number {
    const result = Math.imul(rotl(Math.imul(s1, 5), 7), 9);
    const t = s1 << 9;
    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = rotl(s3, 11);
    return (result >>> 0) / 4294967296;
  };
}

function rotl(x: number, k: number): number {
  return (x << k) | (x >>> (32 - k));
}

// ─── Default Execution Parameters ───────────────────────────────────

export const DEFAULT_SIMULATION_SEED = 42;
export const DEFAULT_DISPUTE_RATE = 0.03; // ~3% simulated dispute/cancellation rate

/**
 * Execute simulated test-mode interventions across an array of pipeline items.
 *
 * Pure and deterministic when `simulationSeed` is provided.
 */
export function executeBatchInterventions(
  items: PipelineItem[],
  options: PipelineOptions = {},
): ExecutedItem[] {
  const seed = options.simulationSeed ?? DEFAULT_SIMULATION_SEED;
  const disputeRate = options.disputeRate ?? DEFAULT_DISPUTE_RATE;
  const rand = createSeededRandom(seed);

  return items.map((item) => executeSingleItem(item, rand, disputeRate));
}

function executeSingleItem(
  item: PipelineItem,
  rand: () => number,
  disputeRate: number,
): ExecutedItem {
  // Non-budgeted items (deferred, pending_approval, stopped) pass through with 0 recovered
  if (item.status !== 'budgeted') {
    return {
      ...item,
      execution_status: item.status,
      final_attempt_count: item.payment.attempt_count,
      recovered_amount: 0,
      simulated_outcome_detail:
        item.status === 'stopped'
          ? item.stop_detail ?? 'Stopped by safety compliance rule'
          : item.status === 'pending_approval'
            ? 'Awaiting merchant approval prior to intervention execution'
            : 'Deferred: outside allocated cycle budget capacity',
      dispute_signaled: false,
    };
  }

  // 1. Simulate Mid-Process Dispute / Cancellation Signal
  const disputeRoll = rand();
  if (disputeRoll < disputeRate) {
    return {
      ...item,
      status: 'stopped',
      execution_status: 'stopped',
      stop_reason: 'dispute_or_cancellation_signaled',
      stop_detail:
        'Customer initiated chargeback dispute or cancellation signal during recovery. Immediate safety halt enforced.',
      final_attempt_count: item.payment.attempt_count + 1,
      recovered_amount: 0,
      simulated_outcome_detail: 'Dispute / cancellation received — immediate recovery halt.',
      dispute_signaled: true,
    };
  }

  // 2. Stochastic Recovery Outcome Simulation
  const successRoll = rand();
  const isRecovered = successRoll < item.score.recovery_probability;

  if (isRecovered) {
    return {
      ...item,
      execution_status: 'recovered',
      final_attempt_count: item.payment.attempt_count + 1,
      recovered_amount: item.payment.amount,
      simulated_outcome_detail:
        `Simulated ${item.suggested_intervention} succeeded (roll: ${successRoll.toFixed(3)} < prob: ${item.score.recovery_probability.toFixed(3)}). ` +
        `Full amount recovered.`,
      dispute_signaled: false,
    };
  }

  // 3. Simulated Failed Attempt Handling
  const newAttemptCount = item.payment.attempt_count + 1;
  if (newAttemptCount >= MAX_RECOVERY_ATTEMPTS) {
    return {
      ...item,
      status: 'stopped',
      execution_status: 'stopped',
      stop_reason: 'max_attempts_exceeded',
      stop_detail:
        `Recovery attempt failed and maximum attempt cap (${newAttemptCount}/${MAX_RECOVERY_ATTEMPTS}) reached. Workflow stopped.`,
      final_attempt_count: newAttemptCount,
      recovered_amount: 0,
      simulated_outcome_detail: `Attempt failed; maximum attempt cap (${MAX_RECOVERY_ATTEMPTS}) reached.`,
      dispute_signaled: false,
    };
  }

  return {
    ...item,
    execution_status: 'retry_scheduled',
    final_attempt_count: newAttemptCount,
    recovered_amount: 0,
    simulated_outcome_detail:
      `Attempt failed (roll: ${successRoll.toFixed(3)} >= prob: ${item.score.recovery_probability.toFixed(3)}). ` +
      `Scheduled for retry in subsequent cycle (attempt ${newAttemptCount}/${MAX_RECOVERY_ATTEMPTS}).`,
    dispute_signaled: false,
  };
}
