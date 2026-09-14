import { describe, it, expect } from 'vitest';
import { sanitizeProviderError, redactSensitivePatterns } from '../sanitizeProviderError';

describe('Provider Error Sanitization & PII Redaction', () => {
  it('Scrubs Bearer tokens, Basic auth, card numbers, emails, and phone numbers from raw strings', () => {
    const raw = 'Failed charge for user john.doe@example.com (phone: +919876543210) on card 4111 2222 3333 4444 with Authorization: Bearer secret_live_token_12345';
    const redacted = redactSensitivePatterns(raw);

    expect(redacted).not.toContain('john.doe@example.com');
    expect(redacted).not.toContain('+919876543210');
    expect(redacted).not.toContain('4111 2222 3333 4444');
    expect(redacted).not.toContain('secret_live_token_12345');
    expect(redacted).toContain('[REDACTED_EMAIL]');
    expect(redacted).toContain('[REDACTED_PHONE]');
    expect(redacted).toContain('[REDACTED_CARD_NUMBER]');
    expect(redacted).toContain('Bearer [REDACTED_TOKEN]');
  });

  it('Parses structured Razorpay error JSON into allowlisted fields', () => {
    const providerJson = {
      error: {
        code: 'BAD_REQUEST_ERROR',
        description: 'Card 5500 0000 0000 0004 expired for user test@bank.com',
        source: 'gateway',
        step: 'payment_initiation',
        reason: 'expired_card',
      },
      http_status_code: 400,
    };

    const sanitized = sanitizeProviderError(providerJson, 400);
    expect(sanitized.gatewayErrorCode).toBe('BAD_REQUEST_ERROR');
    expect(sanitized.category).toBe('INVALID_REQUEST');
    expect(sanitized.gatewayDescription).not.toContain('5500 0000 0000 0004');
    expect(sanitized.gatewayDescription).not.toContain('test@bank.com');
  });

  it('Handles Network timeouts with appropriate category classification', () => {
    const err = new Error('connect ETIMEDOUT 13.232.12.1:443');
    const sanitized = sanitizeProviderError(err, 504);
    expect(sanitized.category).toBe('NETWORK');
    expect(sanitized.httpStatus).toBe(504);
  });
});
