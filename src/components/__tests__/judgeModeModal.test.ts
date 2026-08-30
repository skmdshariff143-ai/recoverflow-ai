/**
 * RecoverFlow AI — Judge Mode Walkthrough Unit Tests.
 *
 * Verifies that the 10-step submission tour covers all essential Track 3 requirements:
 * 1. Problem & Ingestion
 * 2. Diagnostic Classification
 * 3. Intervention & Expected Value
 * 4. Human-in-the-Loop Approval Gate
 * 5. Execution Boundary
 * 6. Outcome Observation
 * 7. Reconciled Accounting
 * 8. Stopping Rules & Escalation
 * 9. Cryptographic Audit Trail
 * 10. Evaluation Proof & Evidence Pack
 */

import { describe, it, expect } from 'vitest';
import { JUDGE_STEPS } from '../JudgeModeModal';

describe('Judge Mode Walkthrough Structure & Content', () => {
  it('contains exactly 10 comprehensive submission steps', () => {
    expect(JUDGE_STEPS.length).toBe(10);
  });

  it('verifies all 10 step IDs are sequential from 1 to 10', () => {
    const ids = JUDGE_STEPS.map((s) => s.id);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('verifies that each step contains non-empty technical invariants and details', () => {
    for (const step of JUDGE_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.headline.length).toBeGreaterThan(0);
      expect(step.description.length).toBeGreaterThan(0);
      expect(step.technicalDetails.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('includes navigation to the hand-curated safety fixture in step 4', () => {
    const step4 = JUDGE_STEPS.find((s) => s.id === 4);
    expect(step4).toBeDefined();
    expect(step4?.recommendedAction?.provenance).toBe('hand_curated_safety');
    expect(step4?.technicalDetails.some((d) => d.includes('Hand-Curated Safety Fixture'))).toBe(true);
  });

  it('verifies that step 7 covers the two zero-drift financial equations', () => {
    const step7 = JUDGE_STEPS.find((s) => s.id === 7);
    expect(step7).toBeDefined();
    expect(step7?.technicalDetails.some((d) => d.includes('Equation 1'))).toBe(true);
    expect(step7?.technicalDetails.some((d) => d.includes('Equation 2'))).toBe(true);
  });
});
