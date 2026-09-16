/**
 * PayBack AI — Merchant Policy Config & Safety Validation.
 *
 * Exposes live-editable recovery policy parameters:
 *  1. Budget capacity (slots)
 *  2. High-value approval threshold (paise)
 *  3. Max attempt cap (attempts)
 *
 * Safety Invariant:
 *  The UI/Config must NEVER allow the safety ceiling (maxAttempts = 3)
 *  to be raised, only lowered (1, 2, or 3).
 */

import { MAX_RECOVERY_ATTEMPTS } from './safetyFilter';

export interface MerchantPolicyConfig {
  /** Maximum number of payments allocated into the active recovery budget. */
  budget: number;
  /** Invoices at or above this amount in paise require human-in-the-loop sign-off. */
  approvalThresholdPaise: number;
  /** Maximum attempts allowed per payment before hard stop. Must not exceed MAX_RECOVERY_ATTEMPTS (3). */
  maxAttemptsCap: number;
}

export const DEFAULT_POLICY_CONFIG: Readonly<MerchantPolicyConfig> = {
  budget: 40,
  approvalThresholdPaise: 5_000_000, // ₹50,000
  maxAttemptsCap: MAX_RECOVERY_ATTEMPTS, // 3
};

export type PersonaId = 'cautious_saas' | 'high_volume_d2c' | 'enterprise_b2b';

export interface MerchantPersona {
  id: PersonaId;
  name: string;
  badge: string;
  description: string;
  config: MerchantPolicyConfig;
}

export const MERCHANT_PERSONAS: Record<PersonaId, MerchantPersona> = {
  cautious_saas: {
    id: 'cautious_saas',
    name: 'Cautious SaaS',
    badge: 'Low Risk',
    description: 'Small budget, low high-value threshold, strict max 2 attempts to protect recurring customer relationships.',
    config: {
      budget: 25,
      approvalThresholdPaise: 2_500_000, // ₹25,000
      maxAttemptsCap: 2,
    },
  },
  high_volume_d2c: {
    id: 'high_volume_d2c',
    name: 'High-Volume D2C',
    badge: 'High Throughput',
    description: 'Larger budget capacity, higher attempt tolerance (max 3), rapid multi-attempt recovery for fast checkout flows.',
    config: {
      budget: 65,
      approvalThresholdPaise: 5_000_000, // ₹50,000
      maxAttemptsCap: 3,
    },
  },
  enterprise_b2b: {
    id: 'enterprise_b2b',
    name: 'Enterprise B2B',
    badge: 'High Value',
    description: 'Targeted budget, high approval threshold (₹1,00,000), conservative human-in-the-loop oversight on large invoices.',
    config: {
      budget: 35,
      approvalThresholdPaise: 10_000_000, // ₹1,00,000
      maxAttemptsCap: 2,
    },
  },
};

export interface PolicyValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  sanitizedConfig: MerchantPolicyConfig;
}

/**
 * Validate and sanitize merchant policy configuration.
 */
export function validatePolicyConfig(
  input: Partial<MerchantPolicyConfig>,
): PolicyValidationResult {
  const errors: Record<string, string> = {};

  // 1. Budget validation
  let budget = input.budget ?? DEFAULT_POLICY_CONFIG.budget;
  if (typeof budget !== 'number' || isNaN(budget)) {
    errors.budget = 'Budget must be a valid number.';
    budget = DEFAULT_POLICY_CONFIG.budget;
  } else if (budget < 0) {
    errors.budget = 'Budget cannot be negative.';
    budget = 0;
  } else if (budget > 200) {
    errors.budget = 'Budget cannot exceed maximum cohort size (200).';
    budget = 200;
  } else {
    budget = Math.round(budget);
  }

  // 2. High-value approval threshold validation
  let threshold = input.approvalThresholdPaise ?? DEFAULT_POLICY_CONFIG.approvalThresholdPaise;
  if (typeof threshold !== 'number' || isNaN(threshold)) {
    errors.approvalThresholdPaise = 'Approval threshold must be a valid number.';
    threshold = DEFAULT_POLICY_CONFIG.approvalThresholdPaise;
  } else if (threshold < 0) {
    errors.approvalThresholdPaise = 'Approval threshold cannot be negative.';
    threshold = 0;
  } else {
    threshold = Math.round(threshold);
  }

  // 3. Max attempts cap validation (Safety Invariant)
  let maxAttempts = input.maxAttemptsCap ?? DEFAULT_POLICY_CONFIG.maxAttemptsCap;
  if (typeof maxAttempts !== 'number' || isNaN(maxAttempts)) {
    errors.maxAttemptsCap = 'Max attempts must be a valid integer.';
    maxAttempts = MAX_RECOVERY_ATTEMPTS;
  } else if (maxAttempts < 1) {
    errors.maxAttemptsCap = 'Max attempts must be at least 1.';
    maxAttempts = 1;
  } else if (maxAttempts > MAX_RECOVERY_ATTEMPTS) {
    errors.maxAttemptsCap = `Safety Violation: Max attempts cap cannot exceed hard safety limit (${MAX_RECOVERY_ATTEMPTS}).`;
    maxAttempts = MAX_RECOVERY_ATTEMPTS;
  } else {
    maxAttempts = Math.round(maxAttempts);
  }

  const valid = Object.keys(errors).length === 0;

  return {
    valid,
    errors,
    sanitizedConfig: {
      budget,
      approvalThresholdPaise: threshold,
      maxAttemptsCap: maxAttempts,
    },
  };
}
