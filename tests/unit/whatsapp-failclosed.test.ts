import { describe, it, expect, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as whatsappWebhookGET } from '../../apps/web/src/app/api/webhooks/whatsapp/route';

describe('whatsapp-failclosed: WhatsApp Webhook Secret Fail-Closed Invariants', () => {
  const origVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  afterEach(() => {
    process.env.WHATSAPP_VERIFY_TOKEN = origVerifyToken;
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
});
