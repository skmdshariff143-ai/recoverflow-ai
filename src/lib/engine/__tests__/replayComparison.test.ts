/**
 * Unit tests for Blind-Bot vs PayBack AI Side-by-Side Replay Engine.
 */

import { describe, it, expect } from 'vitest';
import {
  REPLAY_SAMPLE_CASES,
  computeReplayScorecards,
} from '../replayData';

describe('Blind-Bot vs PayBack AI Replay Engine', () => {

  it('contains exactly 10 realistic payment failure test cases', () => {
    expect(REPLAY_SAMPLE_CASES.length).toBe(10);
  });

  it('confirms Naive Bot incurs multiple regulatory and safety violations on opted-out and closed accounts', () => {
    const { naiveScorecard } = computeReplayScorecards(REPLAY_SAMPLE_CASES);

    expect(naiveScorecard.totalAttempts).toBe(30); // 3 retries on all 10 payments
    expect(naiveScorecard.safetyViolations).toBeGreaterThanOrEqual(3);
    expect(naiveScorecard.recoveryRate).toBeLessThan(25); // Naive spamming recovers very low percentage
  });

  it('confirms PayBack AI has zero safety violations and high precision recovery yield', () => {
    const { paybackScorecard } = computeReplayScorecards(REPLAY_SAMPLE_CASES);

    expect(paybackScorecard.safetyViolations).toBe(0); // Strict safety filter guaranteed
    expect(paybackScorecard.totalAttempts).toBeLessThanOrEqual(10); // Bounded, intelligent retry execution
    expect(paybackScorecard.revenueRecoveredPaise).toBeGreaterThan(6000000); // Recovers over ₹60,000
    expect(paybackScorecard.recoveryRate).toBeGreaterThanOrEqual(70);
  });

  it('guarantees PayBack AI stops attempts immediately on opted-out customers', () => {
    const optOutCases = REPLAY_SAMPLE_CASES.filter((c) => c.isOptedOut);
    expect(optOutCases.length).toBeGreaterThanOrEqual(2);

    for (const item of optOutCases) {
      expect(item.paybackAi.safetyDecision).toBe('stopped');
      expect(item.paybackAi.attemptsUsed).toBe(0);
      expect(item.paybackAi.messagesSent).toBe(0);
    }
  });

  it('guarantees PayBack AI stops retries on permanent account closures', () => {
    const deadAccount = REPLAY_SAMPLE_CASES.find(
      (c) => c.failureCategory === 'permanent_account_closure',
    );
    expect(deadAccount).toBeDefined();
    expect(deadAccount?.paybackAi.safetyDecision).toBe('stopped');
    expect(deadAccount?.paybackAi.attemptsUsed).toBe(0);
  });
});
