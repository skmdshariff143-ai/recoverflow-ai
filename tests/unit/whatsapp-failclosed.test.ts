import { describe, it, expect, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { GET as whatsappWebhookGET, POST as whatsappWebhookPOST } from '../../apps/web/src/app/api/webhooks/whatsapp/route';

describe('whatsapp-failclosed: WhatsApp Webhook Secret Fail-Closed Invariants', () => {
  const origVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  const origAppSecret = process.env.WHATSAPP_APP_SECRET;

  afterEach(() => {
    process.env.WHATSAPP_VERIFY_TOKEN = origVerifyToken;
    process.env.WHATSAPP_APP_SECRET = origAppSecret;
  });

  it('fails closed (403) when WHATSAPP_VERIFY_TOKEN is unset in environment', async () => {
    delete process.env.WHATSAPP_VERIFY_TOKEN;

    const req = new NextRequest(
      'http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=recoverflow_verify_secret&hub.challenge=test_challenge_123'
    );

    const res = await whatsappWebhookGET(req);
    expect(res.status).toBe(403);
    const body = await res.text();
    expect(body).toContain('Forbidden');
  });

  it('rejects incorrect verify token with 403 Forbidden even when env var is set', async () => {
    process.env.WHATSAPP_VERIFY_TOKEN = 'configured_meta_secret_9988';

    const req = new NextRequest(
      'http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=test_challenge_123'
    );

    const res = await whatsappWebhookGET(req);
    expect(res.status).toBe(403);
  });

  it('returns challenge with 200 OK when verify token exactly matches environment', async () => {
    process.env.WHATSAPP_VERIFY_TOKEN = 'configured_meta_secret_9988';

    const req = new NextRequest(
      'http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=configured_meta_secret_9988&hub.challenge=test_challenge_123'
    );

    const res = await whatsappWebhookGET(req);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toBe('test_challenge_123');
  });

  it('fails closed (503) on POST when WHATSAPP_APP_SECRET is unset in environment', async () => {
    delete process.env.WHATSAPP_APP_SECRET;

    const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const req = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': 'sha256=11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff',
      },
      body: payload,
    });

    const res = await whatsappWebhookPOST(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain('WhatsApp webhook app secret unconfigured');
  });

  it('fails closed (401) on POST when signature is missing or invalid', async () => {
    process.env.WHATSAPP_APP_SECRET = 'super_secret_whatsapp_app_key_32bytes';

    const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const req = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': 'sha256=wrong_signature_hash',
      },
      body: payload,
    });

    const res = await whatsappWebhookPOST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Invalid WhatsApp webhook signature');
  });

  it('verifies valid HMAC-SHA256 signature on POST and processes status payload', async () => {
    const testSecret = 'super_secret_whatsapp_app_key_32bytes';
    process.env.WHATSAPP_APP_SECRET = testSecret;

    const payload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.123', status: 'delivered' }] } }] }],
    });
    const signature = crypto.createHmac('sha256', testSecret).update(payload).digest('hex');

    const req = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': `sha256=${signature}`,
      },
      body: payload,
    });

    const res = await whatsappWebhookPOST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });
});
