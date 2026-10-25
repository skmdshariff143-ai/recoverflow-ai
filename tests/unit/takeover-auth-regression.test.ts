import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, createSessionToken, verifySessionToken, hashSessionToken, DEMO_PERSONA_SESSIONS } from '@recoverflow/core';
import { POST as handleTakeover } from '@/app/api/chat/takeover/route';
import fs from 'fs';
import path from 'path';

describe('Chat Takeover Operator Auth & Token Decoupling (Stage 1.3)', () => {
  const merchantId = 'merchant_takeover_test_01';
  const cartId = 'cart_takeover_01';

  beforeEach(async () => {
    vi.stubEnv('RECOVERFLOW_RUNTIME_MODE', 'TEST');
    vi.stubEnv('RECOVERFLOW_ALLOW_ANON_DEMO', 'true');
    vi.stubEnv('ADMIN_API_TOKEN', 'secure-admin-service-token-12345');

    await db.upsertMerchant({
      id: merchantId,
      storeUrl: 'https://takeover.myshopify.com',
      storeName: 'Takeover Store',
      webhookSecret: 'shpss_takeover_sec',
      brandToneGuidelines: 'Supportive',
      brandVoiceCasualVsFormal: 0.5,
      brandVoiceUrgencyVsGentle: 0.5,
      discountCeilingPercentage: 10,
      minMarginPercentage: 20,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.upsertCartEvent({
      id: cartId,
      cartToken: 'tok_takeover_01',
      merchantId,
      customerPhone: '+15550001111',
      currency: 'USD',
      totalPrice: 150,
      status: 'ABANDONED',
      abandonmentType: 'CHECKOUT_STEP',
      recoveryStage: 'WHATSAPP_SENT',
      checkoutUrl: 'https://store.example/checkout',
      items: [{ id: 'item1', title: 'Sweater', price: 150, quantity: 1 }],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects manualMessage with 401 when anonymous demo caller attempts manual dispatch without operator session', async () => {
    // No credentials, no session cookie, no service token
    const req = new NextRequest('http://localhost:3000/api/chat/takeover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cartId,
        isTakenOver: true,
        manualMessage: 'Hello shopper, this is an unauthorized manual attempt',
      }),
    });

    const res = await handleTakeover(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Unauthorized');
  });

  it('allows manualMessage when caller possesses a valid authenticated operator session', async () => {
    const token = createSessionToken({
      ...DEMO_PERSONA_SESSIONS.RECOVERY_MANAGER,
      activeMerchantId: merchantId,
      runtimeMode: 'TEST',
    });
    const { session } = verifySessionToken(token);
    await db.createSession({
      userId: session!.userId,
      tokenHash: hashSessionToken(token),
      organizationId: session!.organizationId,
      activeMerchantId: merchantId,
      role: session!.role,
      expiresAt: new Date(session!.expiresAt),
    });

    const req = new NextRequest('http://localhost:3000/api/chat/takeover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        cartId,
        isTakenOver: true,
        manualMessage: 'Hello shopper, your support agent is here to help!',
      }),
    });

    const res = await handleTakeover(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.messageSent).toBe(true);
    expect(db.isAdminTakenOver(cartId)).toBe(true);
  });

  it('accepts service token from backend/machine callers via x-admin-token with constant-time comparison', async () => {
    const req = new NextRequest('http://localhost:3000/api/chat/takeover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': 'secure-admin-service-token-12345',
      },
      body: JSON.stringify({
        cartId,
        isTakenOver: true,
        manualMessage: 'Service automated intervention',
      }),
    });

    const res = await handleTakeover(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.messageSent).toBe(true);
  });

  it('rejects invalid service token with 403 and never falls back to demo', async () => {
    const req = new NextRequest('http://localhost:3000/api/chat/takeover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': 'wrong-token-value',
      },
      body: JSON.stringify({
        cartId,
        isTakenOver: true,
        manualMessage: 'Attempt with bad token',
      }),
    });

    const res = await handleTakeover(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Unauthorized: Invalid service token');
  });

  it('verifies static decoupling: no components in apps/web/src/components reference x-admin-token', () => {
    const componentsDir = path.resolve(process.cwd(), 'apps/web/src/components');
    const files = fs.readdirSync(componentsDir, { recursive: true }) as string[];

    for (const file of files) {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        const fullPath = path.join(componentsDir, file);
        const content = fs.readFileSync(fullPath, 'utf8');
        expect(content).not.toContain('x-admin-token');
      }
    }
  });
});
