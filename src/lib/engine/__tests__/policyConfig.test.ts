import { describe, test, expect } from 'vitest';
import {
  validatePolicyConfig,
  DEFAULT_POLICY_CONFIG,
  MERCHANT_PERSONAS,
} from '../policyConfig';
import { MAX_RECOVERY_ATTEMPTS } from '../safetyFilter';

describe('validatePolicyConfig', () => {
  test('accepts valid default configuration', () => {
    const res = validatePolicyConfig(DEFAULT_POLICY_CONFIG);
    expect(res.valid).toBe(true);
    expect(res.errors).toEqual({});
    expect(res.sanitizedConfig).toEqual(DEFAULT_POLICY_CONFIG);
  });

  test('rejects negative budget and clamps to 0', () => {
    const res = validatePolicyConfig({ budget: -10 });
    expect(res.valid).toBe(false);
    expect(res.errors.budget).toBeDefined();
    expect(res.sanitizedConfig.budget).toBe(0);
  });

  test('rejects negative approval threshold and clamps to 0', () => {
    const res = validatePolicyConfig({ approvalThresholdPaise: -500 });
    expect(res.valid).toBe(false);
    expect(res.errors.approvalThresholdPaise).toBeDefined();
    expect(res.sanitizedConfig.approvalThresholdPaise).toBe(0);
  });

  test('enforces hard safety invariant: maxAttempts cannot exceed MAX_RECOVERY_ATTEMPTS (3)', () => {
    const res = validatePolicyConfig({ maxAttemptsCap: 5 });
    expect(res.valid).toBe(false);
    expect(res.errors.maxAttemptsCap).toContain('Safety Violation');
    // Sanitized value must not exceed 3
    expect(res.sanitizedConfig.maxAttemptsCap).toBe(MAX_RECOVERY_ATTEMPTS);
  });

  test('allows lowering maxAttempts below 3 (e.g. 1 or 2)', () => {
    const res1 = validatePolicyConfig({ maxAttemptsCap: 1 });
    expect(res1.valid).toBe(true);
    expect(res1.sanitizedConfig.maxAttemptsCap).toBe(1);

    const res2 = validatePolicyConfig({ maxAttemptsCap: 2 });
    expect(res2.valid).toBe(true);
    expect(res2.sanitizedConfig.maxAttemptsCap).toBe(2);
  });

  test('rejects maxAttempts below 1', () => {
    const res = validatePolicyConfig({ maxAttemptsCap: 0 });
    expect(res.valid).toBe(false);
    expect(res.sanitizedConfig.maxAttemptsCap).toBe(1);
  });

  test('all merchant risk-appetite personas pass validation and strictly obey safety limits', () => {
    for (const [key, persona] of Object.entries(MERCHANT_PERSONAS)) {
      const res = validatePolicyConfig(persona.config);
      expect(res.valid, `Persona ${key} must be valid`).toBe(true);
      expect(res.sanitizedConfig.maxAttemptsCap).toBeLessThanOrEqual(MAX_RECOVERY_ATTEMPTS);
      expect(res.sanitizedConfig.maxAttemptsCap).toBeGreaterThanOrEqual(1);
      expect(res.sanitizedConfig.budget).toBeGreaterThan(0);
      expect(res.sanitizedConfig.approvalThresholdPaise).toBeGreaterThan(0);
    }
  });
});
