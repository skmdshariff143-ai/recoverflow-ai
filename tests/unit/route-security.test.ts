/**
 * PayBack AI — Route Security, RBAC & Fail-Closed Invariant Unit Tests.
 *
 * Validates:
 * 1. Anonymous defense-in-depth across Phase 2 routes (401 when anon demo is disabled).
 * 2. RBAC role enforcement (403 for VIEWER attempting recovery execution).
 * 3. Tampered / invalid session token rejection (401).
 * 4. Razorpay webhook security invariants (fail-closed, no reason leak, 503 without secret, DELETE session-gated).
 * 5. Data leakage prevention: anonymous demo events return strictly allowlisted public merchant fields.
 * 6. Hard runtime boundary: anonymous demo is strictly ignored in SANDBOX and LIVE modes.
 * 7. Synchronous atomic idempotency manager lifecycle (new -> in_progress -> replay -> conflict -> release -> retry).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  createSessionToken,
  IdempotencyManager,
  db,
} from '@recoverflow/core';
import { getRateLimitStore } from '../../apps/web/src/lib/apiGuards';
import { POST as login } from '../../apps/web/src/app/api/auth/session/route';

// Route Handlers
import * as RecoveryExecute from '../../apps/web/src/app/api/recovery/execute/route';
import * as ChatTakeover from '../../apps/web/src/app/api/chat/takeover/route';
import * as MerchantVoiceClone from '../../apps/web/src/app/api/merchant/voice-clone/route';
import * as RecoverySuppress from '../../apps/web/src/app/api/recovery/suppress/route';
import * as RazorpaySubs from '../../apps/web/src/app/api/razorpay/subscriptions/route';
import * as RazorpaySubsHalt from '../../apps/web/src/app/api/razorpay/subscriptions/halt/route';
import * as RecoveryEvents from '../../apps/web/src/app/api/recovery/events/route';
import * as RecoveryStream from '../../apps/web/src/app/api/recovery/stream/route';
import * as RecoveryReportsExport from '../../apps/web/src/app/api/recovery/reports/export/route';
import * as RecoveryStatus from '../../apps/web/src/app/api/recovery/status/[reference]/route';
import * as AiDiagnose from '../../apps/web/src/app/api/ai/diagnose/route';
import * as AiDraftMessage from '../../apps/web/src/app/api/ai/draft-message/route';
import * as RecoveryTonePreview from '../../apps/web/src/app/api/recovery/tone-preview/route';
import * as RecoverySimulate from '../../apps/web/src/app/api/recovery/simulate/route';
import * as LiveTrigger from '../../apps/web/src/app/api/live-trigger/route';
import * as RazorpayWebhook from '../../apps/web/src/app/api/webhooks/razorpay/route';

describe('RecoverFlow AI — Comprehensive Route Security Invariants', () => {
  beforeEach(() => {
    delete process.env.RECOVERFLOW_ALLOW_ANON_DEMO;
    process.env.RECOVERFLOW_RUNTIME_MODE = 'TEST';
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    getRateLimitStore().clear?.();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('1. Anonymous Defense-in-Depth Across Phase 2 Routes', () => {
    const phase2Routes: Array<{
      name: string;
      handler: (req: NextRequest, params?: any) => Promise<any>;
      method: string;
      url: string;
      dummyParams?: any;
    }> = [
      { name: 'POST recovery/execute', handler: RecoveryExecute.POST, method: 'POST', url: 'http://localhost:3000/api/recovery/execute' },
      { name: 'GET chat/takeover', handler: ChatTakeover.GET, method: 'GET', url: 'http://localhost:3000/api/chat/takeover?cartId=cart_test' },
      { name: 'POST chat/takeover', handler: ChatTakeover.POST, method: 'POST', url: 'http://localhost:3000/api/chat/takeover' },
      { name: 'POST merchant/voice-clone', handler: MerchantVoiceClone.POST, method: 'POST', url: 'http://localhost:3000/api/merchant/voice-clone' },
      { name: 'POST recovery/suppress', handler: RecoverySuppress.POST, method: 'POST', url: 'http://localhost:3000/api/recovery/suppress' },
      { name: 'POST razorpay/subscriptions', handler: RazorpaySubs.POST, method: 'POST', url: 'http://localhost:3000/api/razorpay/subscriptions' },
      { name: 'GET razorpay/subscriptions', handler: RazorpaySubs.GET, method: 'GET', url: 'http://localhost:3000/api/razorpay/subscriptions' },
      { name: 'POST razorpay/subscriptions/halt', handler: RazorpaySubsHalt.POST, method: 'POST', url: 'http://localhost:3000/api/razorpay/subscriptions/halt' },
      { name: 'GET recovery/events', handler: RecoveryEvents.GET, method: 'GET', url: 'http://localhost:3000/api/recovery/events' },
      { name: 'POST recovery/events', handler: RecoveryEvents.POST, method: 'POST', url: 'http://localhost:3000/api/recovery/events' },
      { name: 'GET recovery/stream', handler: RecoveryStream.GET, method: 'GET', url: 'http://localhost:3000/api/recovery/stream' },
      { name: 'GET recovery/reports/export', handler: RecoveryReportsExport.GET, method: 'GET', url: 'http://localhost:3000/api/recovery/reports/export' },
      { name: 'GET recovery/status/[reference]', handler: RecoveryStatus.GET, method: 'GET', url: 'http://localhost:3000/api/recovery/status/sim_ref_test', dummyParams: { params: Promise.resolve({ reference: 'sim_ref_test' }) } },
      { name: 'POST ai/diagnose', handler: AiDiagnose.POST, method: 'POST', url: 'http://localhost:3000/api/ai/diagnose' },
      { name: 'POST ai/draft-message', handler: AiDraftMessage.POST, method: 'POST', url: 'http://localhost:3000/api/ai/draft-message' },
      { name: 'POST recovery/tone-preview', handler: RecoveryTonePreview.POST, method: 'POST', url: 'http://localhost:3000/api/recovery/tone-preview' },
      { name: 'POST recovery/simulate', handler: RecoverySimulate.POST, method: 'POST', url: 'http://localhost:3000/api/recovery/simulate' },
      { name: 'POST live-trigger', handler: LiveTrigger.POST, method: 'POST', url: 'http://localhost:3000/api/live-trigger' },
    ];

    for (const route of phase2Routes) {
      it(`rejects anonymous call to ${route.name} with 401`, async () => {
        delete process.env.RECOVERFLOW_ALLOW_ANON_DEMO;
        process.env.RECOVERFLOW_RUNTIME_MODE = 'TEST';

        const req = new NextRequest(route.url, {
          method: route.method,
          headers: { 'Content-Type': 'application/json' },
          ...(route.method === 'POST' ? { body: JSON.stringify({}) } : {}),
        });

        const res = route.dummyParams ? await route.handler(req, route.dummyParams) : await route.handler(req);
        expect(res.status, `Expected 401 for anonymous ${route.name}`).toBe(401);
      });
    }
  });

  describe('2. Role-Based Access Control (RBAC)', () => {
    it('rejects authenticated request with VIEWER role attempting recovery execution with 403', async () => {
      db.clear?.();
      db.seedDefaults?.();

      const loginReq = new NextRequest('http://localhost:3000/api/auth/session', {
        method: 'POST',
        headers: { origin: 'http://localhost:3000' },
        body: JSON.stringify({ method: 'demo', role: 'VIEWER' }),
      });
      const loginRes = await login(loginReq);
      expect(loginRes.status).toBe(200);
      const cookieHeader = loginRes.headers.get('set-cookie')!;
      const token = cookieHeader.split(';')[0].replace('recoverflow_session=', '');

      const req = new NextRequest('http://localhost:3000/api/recovery/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          idempotencyKey: 'idem_test_viewer_01',
          paymentId: 'pay_test_01',
          customerPhone: '+919876543210',
          amountPaise: 100000,
          currency: 'INR',
          interventionType: 'whatsapp_interactive',
        }),
      });

      const res = await RecoveryExecute.POST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Role 'VIEWER' lacks 'recovery:execute' permission");
    });
  });

  describe('3. Tampered & Corrupted Session Tokens', () => {
    it('rejects tampered session token with 401 and does NOT fall back to demo', async () => {
      process.env.RECOVERFLOW_ALLOW_ANON_DEMO = 'true';
      process.env.RECOVERFLOW_RUNTIME_MODE = 'TEST';

      const validToken = createSessionToken({
        userId: 'usr_admin_test_01',
        email: 'admin@example.com',
        name: 'Admin Tester',
        organizationId: 'org_recoverflow_demo',
        organizationSlug: 'luxurybrand-enterprise',
        activeMerchantId: 'merchant_default_01',
        role: 'ADMIN',
      });

      // Tamper signature
      const tamperedToken = validToken.slice(0, -6) + 'bad000';

      const req = new NextRequest('http://localhost:3000/api/recovery/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tamperedToken}`,
        },
        body: JSON.stringify({
          idempotencyKey: 'idem_test_tampered_01',
        }),
      });

      const res = await RecoveryExecute.POST(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain('Unauthorized');
    });
  });

  describe('4. Razorpay Webhook Security Invariants', () => {
    it('rejects unsigned webhook with 401 when anonymous demo is disabled', async () => {
      delete process.env.RECOVERFLOW_ALLOW_ANON_DEMO;
      process.env.RECOVERFLOW_RUNTIME_MODE = 'TEST';

      const req = new NextRequest('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'payment.failed' }),
      });

      const res = await RazorpayWebhook.POST(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain('Webhook signature required');
    });

    it('rejects invalid signature with 401 and leaks NO specific reason to client', async () => {
      process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test_secret_32_bytes_long_entropy_key';

      const req = new NextRequest('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        },
        body: JSON.stringify({ event: 'payment.failed' }),
      });

      const res = await RazorpayWebhook.POST(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
      expect((data as any).reason).toBeUndefined();
    });

    it('returns 503 Service Unavailable when signature header is present but secret is unconfigured', async () => {
      delete process.env.RAZORPAY_WEBHOOK_SECRET;

      const req = new NextRequest('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': 'some_incoming_signature',
        },
        body: JSON.stringify({ event: 'payment.failed' }),
      });

      const res = await RazorpayWebhook.POST(req);
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.error).toContain('Service Unavailable');
    });

    it('rejects DELETE on webhook queue with 401 without an authenticated session', async () => {
      const req = new NextRequest('http://localhost:3000/api/webhooks/razorpay', {
        method: 'DELETE',
      });

      const res = await RazorpayWebhook.DELETE(req);
      expect(res.status).toBe(401);
    });
  });

  describe('5. Data Leakage Prevention (toPublicMerchant)', () => {
    it('returns strictly allowlisted public merchant fields and no secrets in anonymous demo events', async () => {
      process.env.RECOVERFLOW_ALLOW_ANON_DEMO = 'true';
      process.env.RECOVERFLOW_RUNTIME_MODE = 'TEST';

      const req = new NextRequest('http://localhost:3000/api/recovery/events', {
        method: 'GET',
      });

      const res = await RecoveryEvents.GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.merchant).toBeDefined();
      expect(data.merchant.id).toBeDefined();
      expect(data.merchant.storeName).toBeDefined();

      // Ensure no sensitive credentials leaked
      expect(data.merchant.apiKey).toBeUndefined();
      expect(data.merchant.shopifyAccessToken).toBeUndefined();
      expect(data.merchant.razorpayKeySecret).toBeUndefined();
      expect(data.merchant.whatsappToken).toBeUndefined();
      expect(data.merchant.rawConfig).toBeUndefined();
    });
  });

  describe('6. Hard Runtime Boundary: Fail Closed in SANDBOX & LIVE', () => {
    it('ignores RECOVERFLOW_ALLOW_ANON_DEMO in SANDBOX mode and returns 401', async () => {
      process.env.RECOVERFLOW_ALLOW_ANON_DEMO = 'true';
      process.env.RECOVERFLOW_RUNTIME_MODE = 'SANDBOX';

      const req = new NextRequest('http://localhost:3000/api/recovery/events', {
        method: 'GET',
      });

      const res = await RecoveryEvents.GET(req);
      expect(res.status).toBe(401);
    });

    it('ignores RECOVERFLOW_ALLOW_ANON_DEMO in LIVE mode and returns 401', async () => {
      process.env.RECOVERFLOW_ALLOW_ANON_DEMO = 'true';
      process.env.RECOVERFLOW_RUNTIME_MODE = 'LIVE';

      const req = new NextRequest('http://localhost:3000/api/recovery/events', {
        method: 'GET',
      });

      const res = await RecoveryEvents.GET(req);
      expect(res.status).toBe(401);
    });
  });

  describe('7. Synchronous Atomic Idempotency Manager Lifecycle', () => {
    it('enforces atomic transitions: new -> in_progress -> replay -> conflict -> release -> retry', () => {
      const manager = new IdempotencyManager();
      const payload1 = { orderId: 'ord_123', amount: 5000 };
      const payload2 = { orderId: 'ord_123', amount: 9999 };

      // 1. Initial lock acquisition: new
      const first = manager.begin('key_idem_test', payload1, 30);
      expect(first.status).toBe('new');

      // 2. Concurrent invocation while in progress: in_progress
      const second = manager.begin('key_idem_test', payload1, 30);
      expect(second.status).toBe('in_progress');

      // 3. Different payload while in progress: conflict
      const conflict = manager.begin('key_idem_test', payload2, 30);
      expect(conflict.status).toBe('conflict');

      // 4. Save result: commits receipt
      const receipt = { receiptId: 'rcpt_test_999', success: true };
      manager.save('key_idem_test', payload1, receipt);

      // 5. Replay after save returns saved receipt
      const replay = manager.begin('key_idem_test', payload1, 30);
      expect(replay.status).toBe('replay');
      if (replay.status === 'replay') {
        expect(replay.receipt).toEqual(receipt);
      }

      // 6. Conflict on different payload even after committed
      const conflictAfterCommit = manager.begin('key_idem_test', payload2, 30);
      expect(conflictAfterCommit.status).toBe('conflict');

      // 7. Free lock via release() and verify retry succeeds
      manager.release('key_idem_test');
      const retry = manager.begin('key_idem_test', payload1, 30);
      expect(retry.status).toBe('new');
    });
  });
});
