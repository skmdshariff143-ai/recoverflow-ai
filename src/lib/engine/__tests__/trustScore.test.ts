/**
 * Unit tests for PayBack AI Explainability & Safety Trust Score.
 */

import { describe, it, expect } from 'vitest';
import { computeTrustScore } from '../trustScore';

describe('Explainability & Safety Trust Score Computation', () => {

  it('computes high assurance trust score for well-calibrated, compliant batch', () => {
    const result = computeTrustScore({
      brierScore: 0.2248,
      calibrationError: 0.0298,
      passingSafetyRules: 7,
      totalSafetyRules: 7,
      totalDecisions: 100,
      loggedAuditRecords: 100,
    });

    expect(result.totalScore).toBeGreaterThanOrEqual(80);
    expect(result.totalScore).toBeLessThanOrEqual(100);
    expect(result.grade).toBe('High Assurance');
    expect(result.components.calibration.score).toBeGreaterThan(20);
    expect(result.components.safety.score).toBe(35);
    expect(result.components.auditCompleteness.score).toBe(25);
  });

  it('is completely deterministic for identical inputs', () => {
    const inputs = {
      brierScore: 0.2378,
      calibrationError: 0.05,
      passingSafetyRules: 7,
      totalSafetyRules: 7,
      totalDecisions: 100,
      loggedAuditRecords: 100,
    };

    const run1 = computeTrustScore(inputs);
    const run2 = computeTrustScore(inputs);

    expect(run1).toEqual(run2);
  });

  it('penalizes poor calibration error and failing safety rules', () => {
    const degraded = computeTrustScore({
      brierScore: 0.45,
      calibrationError: 0.30,
      passingSafetyRules: 3,
      totalSafetyRules: 7,
      totalDecisions: 100,
      loggedAuditRecords: 50,
    });

    expect(degraded.totalScore).toBeLessThan(50);
    expect(degraded.grade).toBe('Degraded');
    expect(degraded.components.safety.score).toBeLessThan(20);
    expect(degraded.components.auditCompleteness.score).toBeLessThan(15);
  });

  it('never produces negative scores or scores exceeding 100', () => {
    const extremeBad = computeTrustScore({
      brierScore: 0.99,
      calibrationError: 1.0,
      passingSafetyRules: 0,
      totalSafetyRules: 7,
      totalDecisions: 100,
      loggedAuditRecords: 0,
    });

    expect(extremeBad.totalScore).toBe(0);

    const perfect = computeTrustScore({
      brierScore: 0.0,
      calibrationError: 0.0,
      passingSafetyRules: 7,
      totalSafetyRules: 7,
      totalDecisions: 100,
      loggedAuditRecords: 100,
    });

    expect(perfect.totalScore).toBe(100);
  });
});
