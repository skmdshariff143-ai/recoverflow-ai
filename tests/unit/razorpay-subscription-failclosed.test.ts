import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, createSessionToken, verifySessionToken, hashSessionToken, DEMO_PERSONA_SESSIONS, subscriptionStore } from '@recoverflow/core';
import { POST as createSubscription } from '@/app/api/razorpay/subscriptions/route';

describe('Razorpay Subscriptions Fail-Closed & Simulation Invariants (Stage 1.2)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubEnv('RECOVERFLOW_RUNTIME_MODE', 'TEST');
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  async function makeAuthHeaders() {
    const merchantId = 'merchant_rzp_test_01';
    await db.upsertMerchant({
      id: merchantId,
      storeUrl: 'https://rzp-test.myshopify.com',
      storeName: 'Razorpay Test Store',
      webhookSecret: 'shpss_sec_123',
      brandToneGuidelines: 'Direct',
      brandVoiceCasualVsFormal: 0.5,
      brandVoiceUrgencyVsGentle: 0.5,
      discountCeilingPercentage: 10,
      minMarginPercentage: 20,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const token = createSessionToken({
      ...DEMO_PERSONA_SESSIONS.ADMIN, // has integration:manage
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

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-merchant-id': merchantId,
    };
  }

  it('fails with 502 and does NOT return a silent subscription fallback when Razorpay plan creation fails', async () => {
    vi.stubEnv('RAZORPAY_KEY_ID', 'rzp_test_key_123');
    vi.stubEnv('RAZORPAY_KEY_SECRET', 'rzp_test_secret_456');

    // Mock upstream 500 from Razorpay API
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Gateway internal server error',
    } as any);

    const headers = await makeAuthHeaders();
    const req = new NextRequest('http://localhost:3000/api/razorpay/subscriptions', {
      method: 'POST',
      headers,
      body: JSON.stringify({ planName: 'Test Pro Plan', amountRupees: 2999 }),
    });

    const initialSubCount = subscriptionStore.getSubscriptions().length;
    const res = await createSubscription(req);

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toContain('Upstream payment gateway error');
    // Prove no silent fallback was created in the subscription store
    expect(subscriptionStore.getSubscriptions().length).toBe(initialSubCount);
  });

  it('fails with 502 when network timeout occurs connecting to Razorpay API', async () => {
    vi.stubEnv('RAZORPAY_KEY_ID', 'rzp_test_key_123');
    vi.stubEnv('RAZORPAY_KEY_SECRET', 'rzp_test_secret_456');

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ETIMEDOUT'));

    const headers = await makeAuthHeaders();
    const req = new NextRequest('http://localhost:3000/api/razorpay/subscriptions', {
      method: 'POST',
      headers,
      body: JSON.stringify({ planName: 'Test Pro Plan', amountRupees: 2999 }),
    });

    const res = await createSubscription(req);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toContain('Upstream payment gateway unavailable');
  });

  it('fails with 503 in SANDBOX/LIVE when Razorpay credentials are unset (disallowing simulation)', async () => {
    vi.stubEnv('RECOVERFLOW_RUNTIME_MODE', 'LIVE');
    vi.stubEnv('AUTH_SECRET', 'test-auth-secret-min-32-chars-live-mode-12345');
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;

    const merchantId = 'merchant_live_test_01';
    const org = await db.createOrganization({ name: 'Live Org', slug: 'live-org' });
    const orgId = org.id;
    await db.upsertMerchant({
      id: merchantId,
      organizationId: orgId,
      storeUrl: 'https://live-test.myshopify.com',
      storeName: 'Live Test Store',
      webhookSecret: 'shpss_live_sec',
      brandToneGuidelines: 'Direct',
      brandVoiceCasualVsFormal: 0.5,
      brandVoiceUrgencyVsGentle: 0.5,
      discountCeilingPercentage: 10,
      minMarginPercentage: 20,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const token = createSessionToken({
      ...DEMO_PERSONA_SESSIONS.ADMIN,
      organizationId: orgId,
      activeMerchantId: merchantId,
      runtimeMode: 'LIVE',
    });
    const { session } = verifySessionToken(token);
    await db.createMembership({
      userId: session!.userId,
      organizationId: orgId,
      role: session!.role,
    });
    await db.createSession({
      userId: session!.userId,
      tokenHash: hashSessionToken(token),
      organizationId: orgId,
      activeMerchantId: merchantId,
      role: session!.role,
      expiresAt: new Date(session!.expiresAt),
    });

    const req = new NextRequest('http://localhost:3000/api/razorpay/subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-merchant-id': merchantId,
      },
      body: JSON.stringify({ planName: 'Live Plan', amountRupees: 999 }),
    });

    const res = await createSubscription(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain('credentials are not configured in this runtime mode');
  });

  it('explicitly labels demo-only simulated subscriptions with simulated: true in TEST mode', async () => {
    vi.stubEnv('RECOVERFLOW_RUNTIME_MODE', 'TEST');
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;

    const headers = await makeAuthHeaders();
    const req = new NextRequest('http://localhost:3000/api/razorpay/subscriptions', {
      method: 'POST',
      headers,
      body: JSON.stringify({ planName: 'Simulated Demo Plan', amountRupees: 1499 }),
    });

    const res = await createSubscription(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.simulated).toBe(true);
    expect(body.subscription.simulated).toBe(true);
    expect(body.subscription.dataSource).toBe('local_fallback');
  });

  it('labels live upstream subscriptions with simulated: false when Razorpay API succeeds', async () => {
    vi.stubEnv('RAZORPAY_KEY_ID', 'rzp_test_valid_key');
    vi.stubEnv('RAZORPAY_KEY_SECRET', 'rzp_test_valid_secret');

    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/v1/plans')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'plan_upstream_mock_123' }),
        } as any;
      }
      if (url.includes('/v1/subscriptions')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'sub_upstream_mock_456', short_url: 'https://rzp.io/i/sub_upstream_mock_456' }),
        } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    const headers = await makeAuthHeaders();
    const req = new NextRequest('http://localhost:3000/api/razorpay/subscriptions', {
      method: 'POST',
      headers,
      body: JSON.stringify({ planName: 'Upstream Live Plan', amountRupees: 1999 }),
    });

    const res = await createSubscription(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.simulated).toBe(false);
    expect(body.subscription.simulated).toBe(false);
    expect(body.subscription.subscription_id).toBe('sub_upstream_mock_456');
    expect(body.subscription.plan_id).toBe('plan_upstream_mock_123');
    expect(body.subscription.dataSource).toBe('razorpay_live');
  });
});
