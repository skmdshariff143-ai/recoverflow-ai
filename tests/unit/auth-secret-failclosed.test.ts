import { describe, it, expect } from 'vitest';
import {
  validateAuthSecret,
  createSessionToken,
  DEFAULT_DEV_AUTH_SECRET,
  DEMO_PERSONA_SESSIONS,
} from '@recoverflow/core';

describe('RecoverFlow AI — Fail-Closed Auth Secrets Matrix', () => {
  it('permits default development secret in DEMO and TEST modes', () => {
    expect(() => validateAuthSecret(undefined, 'DEMO')).not.toThrow();
    expect(validateAuthSecret(undefined, 'DEMO')).toBe(DEFAULT_DEV_AUTH_SECRET);

    expect(() => validateAuthSecret(undefined, 'TEST')).not.toThrow();
    expect(validateAuthSecret(undefined, 'TEST')).toBe(DEFAULT_DEV_AUTH_SECRET);
  });

  it('fails closed in LIVE and SANDBOX modes if secret is missing or default dev secret', () => {
    // Missing secret
    expect(() => validateAuthSecret(undefined, 'LIVE')).toThrow(
      /INSECURE_AUTH_SECRET/,
    );
    expect(() => validateAuthSecret(undefined, 'SANDBOX')).toThrow(
      /INSECURE_AUTH_SECRET/,
    );

    // Default development secret
    expect(() => validateAuthSecret(DEFAULT_DEV_AUTH_SECRET, 'LIVE')).toThrow(
      /INSECURE_AUTH_SECRET/,
    );

    // Low entropy / short secret (< 32 chars)
    expect(() => validateAuthSecret('short_secret_123', 'LIVE')).toThrow(
      /INSECURE_AUTH_SECRET/,
    );
  });

  it('accepts high-entropy secrets in LIVE and SANDBOX modes', () => {
    const secureSecret = 'production_high_entropy_secret_min_32_characters_long_key_99182';
    expect(() => validateAuthSecret(secureSecret, 'LIVE')).not.toThrow();
    expect(validateAuthSecret(secureSecret, 'LIVE')).toBe(secureSecret);
  });
});
