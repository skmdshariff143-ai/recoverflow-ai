import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db } from '../../packages/core/src/db';
import { createSessionToken, DEMO_PERSONA_SESSIONS } from '../../packages/core/src/auth';
import { POST as login, DELETE as logout } from '../../apps/web/src/app/api/auth/session/route';
import { GET as snapshot } from '../../apps/web/src/app/api/console/route';
import { POST as review } from '../../apps/web/src/app/api/console/review/route';
import { PATCH as settings } from '../../apps/web/src/app/api/console/settings/route';
import { GET as detail } from '../../apps/web/src/app/api/console/cases/[caseId]/route';
import { proxy } from '../../apps/web/src/proxy';
import { GET as searchCases } from '../../apps/web/src/app/api/console/cases/route';
import { GET as commerce } from '../../apps/web/src/app/api/console/commerce/route';
import { GET as subscriptions, POST as createSubscription, PATCH as changeSubscription } from '../../apps/web/src/app/api/demo/subscriptions/route';

function request(path: string, method = 'GET', body?: unknown, cookie?: string, origin = 'http://localhost:3000') {
  return new NextRequest(`http://localhost:3000${path}`, { method, headers: { 'Content-Type': 'application/json', origin, ...(cookie ? { cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function session(role = 'ADMIN') {
  const response = await login(request('/api/auth/session', 'POST', { method: 'demo', role }));
  expect(response.status).toBe(200);
  return response.headers.get('set-cookie')!.split(';')[0];
}
describe('Console authorization and runtime boundaries', () => {
  beforeEach(() => { vi.stubEnv('RECOVERFLOW_RUNTIME_MODE', 'TEST'); db.clear?.(); db.seedDefaults?.(); });
  afterEach(() => vi.unstubAllEnvs());
  it('issues an HttpOnly session and requires it for the workspace', async () => {
    expect((await snapshot(request('/api/console'))).status).toBe(401);
    const response = await login(request('/api/auth/session', 'POST', { method: 'demo', role: 'ADMIN' }));
    expect(response.headers.get('set-cookie')).toMatch(/HttpOnly/i);
    expect(response.headers.get('set-cookie')).toMatch(/SameSite=lax/i);
    const cookie = response.headers.get('set-cookie')!.split(';')[0];
    const dataResponse = await snapshot(request('/api/console', 'GET', undefined, cookie));
    expect(dataResponse.status).toBe(200);
    const data = await dataResponse.json();
    expect(data.source).toBe('DEMO');
    expect(data.cases.length).toBeGreaterThan(0);
    expect(JSON.stringify(data)).not.toMatch(/encryptedShopifyAccessToken|whatsappToken|webhookSecret|resendApiKey|passwordHash/);
  });
  it('rejects validly signed but unregistered tokens and immediately revokes logout', async () => {
    const token = createSessionToken({ ...DEMO_PERSONA_SESSIONS.ADMIN, runtimeMode: 'TEST' });
    expect((await snapshot(request('/api/console', 'GET', undefined, `recoverflow_session=${token}`))).status).toBe(401);
    const cookie = await session();
    expect((await logout(request('/api/auth/session', 'DELETE', undefined, cookie))).status).toBe(200);
    expect((await snapshot(request('/api/console', 'GET', undefined, cookie))).status).toBe(401);
  });
  it('enforces origin and role permissions before mutations', async () => {
    const cookie = await session('VIEWER');
    expect((await review(request('/api/console/review', 'POST', {}, cookie))).status).toBe(403);
    expect((await settings(request('/api/console/settings', 'PATCH', {}, cookie))).status).toBe(403);
    expect((await login(request('/api/auth/session', 'POST', { method: 'demo' }, undefined, 'https://attacker.example'))).status).toBe(403);
  });
  it('returns 404 for another merchant case and for unknown cases', async () => {
    const cookie = await session();
    const foreignPayment = await db.createPayment({ merchantId: 'foreign-merchant', externalPaymentId: 'foreign-payment', amountPaise: 1n, currency: 'INR' });
    const foreignCase = await db.createRecoveryCase({ merchantId: 'foreign-merchant', paymentId: foreignPayment.id });
    for (const caseId of [foreignCase.id, 'does-not-exist']) {
      expect((await detail(request(`/api/console/cases/${caseId}`, 'GET', undefined, cookie), { params: Promise.resolve({ caseId }) })).status).toBe(404);
    }
    const data = await (await snapshot(request('/api/console', 'GET', undefined, cookie))).json();
    expect(data.cases.some((entry: { id: string }) => entry.id === foreignCase.id)).toBe(false);
  });
  it('rejects invalid review input and preserves a pending case after first sign-off', async () => {
    const cookie = await session();
    const pending = (await db.searchRecoveryCases({ merchantId: 'merchant_default_01', status: 'APPROVAL_REQUIRED' })).items[0];
    expect((await review(request('/api/console/review', 'POST', { caseId: pending.id, action: 'approve', reason: 'short' }, cookie))).status).toBe(400);
    const body = { caseId: pending.id, action: 'approve', reason: 'Verified the customer payment evidence.' };
    expect((await review(request('/api/console/review', 'POST', body, cookie))).status).toBe(200);
    expect((await review(request('/api/console/review', 'POST', body, cookie))).status).toBe(409);
    expect((await db.getRecoveryCase(pending.id))?.status).toBe('APPROVAL_REQUIRED');
  });
  it('disables demo sign-in and legacy execution endpoints in live and sandbox modes', async () => {
    for (const mode of ['LIVE', 'SANDBOX']) {
      vi.stubEnv('RECOVERFLOW_RUNTIME_MODE', mode);
      expect((await login(request('/api/auth/session', 'POST', { method: 'demo' }))).status).toBe(403);
      expect(proxy(request('/api/live-trigger', 'POST', {})).status).toBe(503);
      expect(proxy(request('/api/recovery/execute', 'POST', {})).status).toBe(503);
      expect(proxy(request('/demo')).status).toBe(307);
    }
  });
  it('blocks external provider actions in a demo installation', () => {
    vi.stubEnv('RECOVERFLOW_RUNTIME_MODE', 'DEMO');
    expect(proxy(request('/api/razorpay/subscriptions/halt', 'POST', {})).status).toBe(403);
    expect(proxy(request('/api/auth/shopify')).status).toBe(403);
  });
  it('searches beyond the summary limit and validates pagination', async () => {
    const cookie = await session();
    const merchantId = 'merchant_default_01';
    for (let index = 0; index < 510; index++) {
      const payment = await db.createPayment({ merchantId, externalPaymentId: `bulk-payment-${index}`, amountPaise: 9007199254740993n, currency: 'INR' });
      await db.createRecoveryCase({ merchantId, paymentId: payment.id, expectedValuePaise: 9007199254740992n });
    }
    const result = await (await searchCases(request('/api/console/cases?search=bulk-payment-&page=50', 'GET', undefined, cookie))).json();
    expect(result.total).toBe(510);
    expect(result.items).toHaveLength(10);
    expect(result.items[0].amountMinor).toBe('9007199254740993');
    expect((await searchCases(request('/api/console/cases?page=-1', 'GET', undefined, cookie))).status).toBe(400);
    expect((await searchCases(request('/api/console/cases?status=UNKNOWN', 'GET', undefined, cookie))).status).toBe(400);
    const active = await (await searchCases(request('/api/console/cases?active=true', 'GET', undefined, cookie))).json();
    expect(active.items.every((item: { status: string }) => !['RECOVERED', 'STOPPED'].includes(item.status))).toBe(true);
  });
  it('only exposes masked commerce records without checkout tokens', async () => {
    expect((await commerce(request('/api/console/commerce'))).status).toBe(401);
    const cookie = await session();
    const response = await commerce(request('/api/console/commerce', 'GET', undefined, cookie));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.carts.length).toBeGreaterThan(0);
    expect(JSON.stringify(body)).not.toMatch(/checkoutUrl|cartToken|customerEmail|customerPhone|webhookSecret/);
  });
  it('simulates subscription changes without provider links and denies them in live mode', async () => {
    const initial = await (await subscriptions(request('/api/demo/subscriptions'))).json();
    expect(initial.source).toBe('DEMO');
    expect(initial.subscriptions.every((item: { subscription_link: string }) => item.subscription_link === '/demo')).toBe(true);
    const response = await createSubscription(request('/api/demo/subscriptions', 'POST', { planName: 'Sample annual', amountRupees: 999.99, customerEmail: 'sample@example.test' }));
    expect(response.status).toBe(201);
    const { subscription } = await response.json();
    expect(subscription.amount_paise).toBe(99999);
    const updated = await changeSubscription(request('/api/demo/subscriptions', 'PATCH', { subscriptionId: subscription.subscription_id, action: 'halt' }));
    expect((await updated.json()).subscription.status).toBe('halted');
    vi.stubEnv('RECOVERFLOW_RUNTIME_MODE', 'LIVE');
    expect((await subscriptions(request('/api/demo/subscriptions'))).status).toBe(404);
  });
});
