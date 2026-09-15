import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { 
  verifyShopifyHmac, 
  verifyWhatsAppSignature, 
  normalizePhone, 
  normalizeEmail 
} from '@recoverflow/core';

describe('Shopify HMAC & Cryptographic Verification', () => {
  const secret = 'shpss_live_secret_key_88192837419';
  const rawBody = JSON.stringify({
    id: 991823719,
    token: 'tok_shpfy_test_9921',
    total_price: '280.00',
    currency: 'USD',
    email: 'alex@example.com',
  });

  const validHmac = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');

  it('verifies a valid Shopify HMAC signature correctly', () => {
    const isValid = verifyShopifyHmac(rawBody, validHmac, secret);
    expect(isValid).toBe(true);
  });

  it('rejects an altered or tampered body', () => {
    const tamperedBody = rawBody.replace('280.00', '10.00');
    const isValid = verifyShopifyHmac(tamperedBody, validHmac, secret);
    expect(isValid).toBe(false);
  });

  it('rejects an incorrect secret', () => {
    const isValid = verifyShopifyHmac(rawBody, validHmac, 'wrong_secret');
    expect(isValid).toBe(false);
  });

  it('rejects missing or empty HMAC header', () => {
    expect(verifyShopifyHmac(rawBody, null, secret)).toBe(false);
    expect(verifyShopifyHmac(rawBody, '', secret)).toBe(false);
  });

  it('verifies Meta WhatsApp Cloud API signatures correctly', () => {
    const appSecret = 'meta_app_secret_12345';
    const waBody = '{"entry":[{"changes":[{"value":{"messages":[{"text":{"body":"Hello"}}]}}]}]}';
    const hash = crypto.createHmac('sha256', appSecret).update(waBody).digest('hex');
    const validSignature = `sha256=${hash}`;

    expect(verifyWhatsAppSignature(waBody, validSignature, appSecret)).toBe(true);
    expect(verifyWhatsAppSignature(waBody, 'sha256=invalidhash', appSecret)).toBe(false);
    expect(verifyWhatsAppSignature(waBody, null, appSecret)).toBe(false);
  });

  it('normalizes customer phone numbers to E.164 standard', () => {
    expect(normalizePhone('14155552671')).toBe('+14155552671');
    expect(normalizePhone('+1 (415) 555-2671')).toBe('+14155552671');
    expect(normalizePhone('+44 20 7946 0991')).toBe('+442079460991');
  });

  it('normalizes customer emails to lowercased trimmed format', () => {
    expect(normalizeEmail('  ALEX.Smith@Company.ORG  ')).toBe('alex.smith@company.org');
  });
});
