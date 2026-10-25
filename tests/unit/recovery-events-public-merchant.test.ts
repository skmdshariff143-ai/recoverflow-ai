import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db } from '../../packages/core/src/db';
import { GET, POST } from '../../apps/web/src/app/api/recovery/events/route';

describe('recovery/events: Public Merchant Sanitization & Secret Redaction', () => {
  beforeEach(() => {
    vi.stubEnv('RECOVERFLOW_RUNTIME_MODE', 'DEMO');
    vi.stubEnv('RECOVERFLOW_ALLOW_ANON_DEMO', 'true');
    db.clear?.();
    db.seedDefaults?.();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('GET /api/recovery/events never leaks merchant credentials or secrets', async () => {
    const req = new NextRequest('http://localhost:3000/api/recovery/events', {
      method: 'GET',
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.merchant).toBeDefined();
    expect(body.merchant.id).toBeDefined();
    expect(body.merchant.storeName).toBeDefined();

    const rawJson = JSON.stringify(body);

    // Verify secret fields NEVER appear in response
    expect(rawJson).not.toContain('webhookSecret');
    expect(rawJson).not.toContain('whatsappToken');
    expect(rawJson).not.toContain('encryptedWhatsappToken');
    expect(rawJson).not.toContain('shopifyAccessToken');
    expect(rawJson).not.toContain('encryptedShopifyAccessToken');
    expect(rawJson).not.toContain('resendApiKey');
    expect(rawJson).not.toContain('encryptedResendApiKey');
    expect(rawJson).not.toContain('geminiApiKey');
    expect(rawJson).not.toContain('encryptedGeminiApiKey');
    expect(rawJson).not.toContain('shpss_test_secret_key');
  });

  it('POST /api/recovery/events returns toPublicMerchant and never leaks secrets', async () => {
    const req = new NextRequest('http://localhost:3000/api/recovery/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandVoiceCasualVsFormal: 0.8,
        brandVoiceUrgencyVsGentle: 0.2,
        discountCeilingPercentage: 10,
        brandToneGuidelines: 'Clear and respectful.',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.merchant).toBeDefined();
    expect(body.merchant.brandVoiceCasualVsFormal).toBe(0.8);

    const rawJson = JSON.stringify(body);

    expect(rawJson).not.toContain('webhookSecret');
    expect(rawJson).not.toContain('whatsappToken');
    expect(rawJson).not.toContain('encryptedWhatsappToken');
    expect(rawJson).not.toContain('shopifyAccessToken');
    expect(rawJson).not.toContain('encryptedShopifyAccessToken');
    expect(rawJson).not.toContain('resendApiKey');
    expect(rawJson).not.toContain('encryptedResendApiKey');
    expect(rawJson).not.toContain('geminiApiKey');
    expect(rawJson).not.toContain('encryptedGeminiApiKey');
  });
});
