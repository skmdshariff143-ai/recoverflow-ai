/**
 * PayBack AI — Contrastive "Why Not the Others" Explanation Engine.
 *
 * Provides explainable peer comparison by finding similar payments
 * (same failure category, comparable amount) that received a lower score,
 * and breaking down the exact factor deltas in plain English.
 *
 * Pure function — reuses existing scoring factors without altering scoring logic.
 */

import type { ExecutedItem } from '@/types';

export interface FactorDelta {
  factor: string;
  label: string;
  targetContribution: number;
  peerContribution: number;
  delta: number;
  explanation: string;
}

export interface ContrastivePeerComparison {
  peerPaymentId: string;
  peerCustomerId: string;
  peerAmount: number;
  peerCategory: string;
  peerScore: number;
  targetScore: number;
  scoreDelta: number;
  topDifferentiatingFactors: FactorDelta[];
  plainEnglishSummary: string;
}

export interface ContrastiveReport {
  targetPaymentId: string;
  targetCategory: string;
  targetScore: number;
  comparisons: ContrastivePeerComparison[];
  hasComparisons: boolean;
}

/**
 * Identify 1-2 similar payments with lower scores and explain the difference.
 */
export function generateContrastiveReport(
  targetItem: ExecutedItem,
  allItems: ExecutedItem[],
  maxPeers: number = 2,
): ContrastiveReport {
  const targetCategory = targetItem.payment.failure_category;
  const targetAmount = targetItem.payment.amount;
  const targetProb = targetItem.score.recovery_probability;

  // Filter candidates: same failure category, different payment ID, meaningfully lower score (>= 0.03 delta)
  let candidates = allItems.filter(
    (item) =>
      item.payment.payment_id !== targetItem.payment.payment_id &&
      item.payment.failure_category === targetCategory &&
      item.score.recovery_probability < targetProb - 0.01,
  );

  // If no same-category lower-scored items found, relax category restriction to similar amount with lower score
  if (candidates.length === 0) {
    candidates = allItems.filter(
      (item) =>
        item.payment.payment_id !== targetItem.payment.payment_id &&
        item.score.recovery_probability < targetProb - 0.05,
    );
  }

  // Rank candidates by amount similarity to target
  candidates.sort((a, b) => {
    const aAmountRatio = Math.abs(Math.log(Math.max(1, a.payment.amount) / Math.max(1, targetAmount)));
    const bAmountRatio = Math.abs(Math.log(Math.max(1, b.payment.amount) / Math.max(1, targetAmount)));
    return aAmountRatio - bAmountRatio;
  });

  const selectedPeers = candidates.slice(0, maxPeers);

  const comparisons: ContrastivePeerComparison[] = selectedPeers.map((peer) => {
    const peerProb = peer.score.recovery_probability;
    const scoreDelta = Number((targetProb - peerProb).toFixed(4));

    // Map factors by factor key
    const targetFactors = new Map(targetItem.score.explanation.map((f) => [f.factor, f]));
    const peerFactors = new Map(peer.score.explanation.map((f) => [f.factor, f]));

    const factorDeltas: FactorDelta[] = [];
    const allFactorKeys = Array.from(new Set([...targetFactors.keys(), ...peerFactors.keys()]));

    for (const key of allFactorKeys) {
      const tf = targetFactors.get(key);
      const pf = peerFactors.get(key);
      const targetContrib = tf?.contribution ?? 0;
      const peerContrib = pf?.contribution ?? 0;
      const delta = Number((targetContrib - peerContrib).toFixed(4));

      if (Math.abs(delta) >= 0.005) {
        let explanation = '';
        const label = tf?.label ?? pf?.label ?? key;

        if (key === 'customer_reliability') {
          const tRate = Math.round(targetItem.payment.customer_payment_history.on_time_payment_rate * 100);
          const pRate = Math.round(peer.payment.customer_payment_history.on_time_payment_rate * 100);
          explanation = `Target customer has ${tRate}% on-time payment rate vs peer's ${pRate}%`;
        } else if (key === 'broken_promise_penalty') {
          const tBroken = targetItem.payment.customer_payment_history.broken_promise_count;
          const pBroken = peer.payment.customer_payment_history.broken_promise_count;
          explanation = `Target has ${tBroken} broken promises vs peer's ${pBroken}`;
        } else if (key === 'recency_bonus') {
          explanation = `Target failure is more recent, decaying less probability`;
        } else if (key === 'tenure_bonus') {
          const tTenure = targetItem.payment.customer_payment_history.tenure_months;
          const pTenure = peer.payment.customer_payment_history.tenure_months;
          explanation = `Target customer account tenure is ${tTenure} mos vs peer's ${pTenure} mos`;
        } else if (key === 'attempt_penalty') {
          const tAtt = targetItem.payment.attempt_count;
          const pAtt = peer.payment.attempt_count;
          explanation = `Target has ${tAtt} prior attempts vs peer's ${pAtt}`;
        } else {
          explanation = `${label} contributes +${(delta * 100).toFixed(1)}% more probability`;
        }

        factorDeltas.push({
          factor: key,
          label,
          targetContribution: targetContrib,
          peerContribution: peerContrib,
          delta,
          explanation,
        });
      }
    }

    // Sort factors by highest positive delta
    factorDeltas.sort((a, b) => b.delta - a.delta);

    // Formulate plain English summary
    const topDeltas = factorDeltas.filter((f) => f.delta > 0).slice(0, 2);
    let summary = '';
    if (topDeltas.length > 0) {
      const reasons = topDeltas.map((d) => d.explanation.toLowerCase()).join(' and ');
      summary = `Ranked higher (+${Math.round(scoreDelta * 100)}% recovery probability) primarily because ${reasons}.`;
    } else {
      summary = `Ranked higher (+${Math.round(scoreDelta * 100)}% recovery probability) due to cumulative micro-adjustments across customer reliability and tenure.`;
    }

    return {
      peerPaymentId: peer.payment.payment_id,
      peerCustomerId: peer.payment.customer_id,
      peerAmount: peer.payment.amount,
      peerCategory: peer.payment.failure_category,
      peerScore: peerProb,
      targetScore: targetProb,
      scoreDelta,
      topDifferentiatingFactors: factorDeltas.slice(0, 4),
      plainEnglishSummary: summary,
    };
  });

  return {
    targetPaymentId: targetItem.payment.payment_id,
    targetCategory,
    targetScore: targetProb,
    comparisons,
    hasComparisons: comparisons.length > 0,
  };
}
