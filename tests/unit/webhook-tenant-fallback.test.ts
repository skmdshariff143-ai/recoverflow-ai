import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { db, globalSuppressionService } from '@recoverflow/core';
import * as ShopifyCheckouts from '../../apps/web/src/app/api/webhooks/shopify/checkouts/route';
import * as ShopifyFulfillments from '../../apps/web/src/app/api/webhooks/shopify/fulfillments/route';
import * as ShopifyGdpr from '../../apps/web/src/app/api/webhooks/shopify/gdpr/route';
import * as ShopifyOrders from '../../apps/web/src/app/api/webhooks/shopify/orders/route';
import * as WhatsAppWebhook from '../../apps/web/src/app/api/webhooks/whatsapp/route';
import * as ShopifyCallback from '../../apps/web/src/app/api/auth/shopify/callback/route';
import * as ChatTakeover from '../../apps/web/src/app/api/chat/takeover/route';
import { POST as login } from '../../apps/web/src/app/api/auth/session/route';

describe('Webhook Tenant Fallback & Error Leakage Invariants', () => {
  beforeEach(() => {
    vi.stubEnv('RECOVERFLOW_RUNTIME_MODE', 'LIVE');
    vi.stubEnv('WHATSAPP_APP_SECRET', 'meta_test_secret_32_bytes_long_entropy');
    vi.stubEnv('ADMIN_API_TOKEN', 'service_test_token_min_32_bytes_entropy_key');
    db.clear?.();
    db.seedDefaults?.();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('1. Tenant Fallback strictly guarded in LIVE and SANDBOX modes', () => {
    it('shopify/checkouts returns 200 {received: true, ignored: true} on unknown shop domain in LIVE mode', async () => {
      const body = JSON.stringify({ token: 'cart_unknown_999', line_items: [] });
      const req = new NextRequest('http://localhost:3000/api/webhooks/shopify/checkouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-shopify-shop-domain': 'completely-unknown-merchant-store.myshopify.com',
        },
        body,
      });

      const res = await ShopifyCheckouts.POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ received: true, ignored: true });

      // Invariant: No cart event written
      const cart = await db.getCartByToken('cart_unknown_999');
      expect(cart).toBeNull();
    });

    it('shopify/fulfillments returns 200 {received: true, ignored: true} on unknown shop domain in SANDBOX mode', async () => {
      vi.stubEnv('RECOVERFLOW_RUNTIME_MODE', 'SANDBOX');
      const body = JSON.stringify({ id: 'ful_unknown_999', order_id: 'ord_999' });
      const req = new NextRequest('http://localhost:3000/api/webhooks/shopify/fulfillments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-shopify-shop-domain': 'unregistered-sandbox-merchant.myshopify.com',
        },
        body,
      });

      const res = await ShopifyFulfillments.POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ received: true, ignored: true });

      // Invariant: No fulfillment written
      const ful = await db.getFulfillmentByShopifyId('ful_unknown_999');
      expect(ful).toBeNull();
    });

    it('shopify/orders returns 200 {received: true, ignored: true} on unknown shop domain in LIVE mode', async () => {
      const body = JSON.stringify({ id: 'ord_unknown_999', total_price: '500.00' });
      const req = new NextRequest('http://localhost:3000/api/webhooks/shopify/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-shopify-shop-domain': 'rogue-shop.myshopify.com',
        },
        body,
      });

      const res = await ShopifyOrders.POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ received: true, ignored: true });
    });

    it('shopify/gdpr returns 200 {received: true, ignored: true} and NEVER acts on a fallback tenant in any mode', async () => {
      // Test in DEMO mode: even in DEMO, GDPR must NOT fall back to merchant_default_01!
      vi.stubEnv('RECOVERFLOW_RUNTIME_MODE', 'DEMO');
      const suppressSpy = vi.spyOn(globalSuppressionService, 'suppress');

      const body = JSON.stringify({
        customer: { id: 123, phone: '+919999999999', email: 'gdpr@example.com' },
      });
      const req = new NextRequest('http://localhost:3000/api/webhooks/shopify/gdpr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-shopify-topic': 'customers/redact',
          'x-shopify-shop-domain': 'non-existent-gdpr-store.myshopify.com',
        },
        body,
      });

      const res = await ShopifyGdpr.POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ received: true, ignored: true });
      expect(suppressSpy).not.toHaveBeenCalled();
    });

    it('webhooks/whatsapp returns 200 {received: true, ignored: true} on unknown phone in LIVE mode', async () => {
      const waBody = JSON.stringify({
        entry: [
          {
            id: '12345',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '19999999999',
                    phone_number_id: 'unknown_phone_id_99999',
                  },
                  messages: [
                    {
                      from: '919876543210',
                      id: 'wamid.test.1',
                      text: { body: 'Hello' },
                      type: 'text',
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      });

      const secret = 'meta_test_secret_32_bytes_long_entropy';
      const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(waBody).digest('hex');

      const req = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': sig,
        },
        body: waBody,
      });

      const res = await WhatsAppWebhook.POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ received: true, ignored: true });
    });
  });

  describe('2. Error Message Leakage Prevention (internalErrorResponse)', () => {
    it('shopify/checkouts catches internal exception and never leaks err.message', async () => {
      vi.stubEnv('RECOVERFLOW_RUNTIME_MODE', 'TEST');
      vi.spyOn(db, 'getMerchantByStoreUrl').mockRejectedValueOnce(
        new Error('SQLITE_CRITICAL_DATABASE_CORRUPTION_KEY_SECRET_LEAK')
      );

      const req = new NextRequest('http://localhost:3000/api/webhooks/shopify/checkouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const res = await ShopifyCheckouts.POST(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Internal server error');
      expect(JSON.stringify(json)).not.toContain('SQLITE_CRITICAL_DATABASE_CORRUPTION');
    });

    it('shopify/fulfillments catches internal exception and never leaks err.message', async () => {
      vi.stubEnv('RECOVERFLOW_RUNTIME_MODE', 'TEST');
      vi.spyOn(db, 'getMerchantByStoreUrl').mockRejectedValueOnce(
        new Error('DATABASE_CONNECTION_POOL_EXHAUSTED_SECRET_XYZ')
      );

      const req = new NextRequest('http://localhost:3000/api/webhooks/shopify/fulfillments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const res = await ShopifyFulfillments.POST(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Internal fulfillment error');
      expect(JSON.stringify(json)).not.toContain('DATABASE_CONNECTION_POOL_EXHAUSTED_SECRET_XYZ');
    });

    it('shopify/orders catches internal exception and never leaks err.message', async () => {
      vi.stubEnv('RECOVERFLOW_RUNTIME_MODE', 'TEST');
      vi.spyOn(db, 'getMerchantByShopDomain').mockRejectedValueOnce(
        new Error('INTERNAL_ORDER_PARSER_EXCEPTION_DETAILS_SECRET')
      );

      const req = new NextRequest('http://localhost:3000/api/webhooks/shopify/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const res = await ShopifyOrders.POST(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Order processing error');
      expect(JSON.stringify(json)).not.toContain('INTERNAL_ORDER_PARSER_EXCEPTION_DETAILS_SECRET');
    });

    it('shopify/gdpr catches internal exception and never leaks err.message', async () => {
      vi.spyOn(db, 'getMerchantByShopDomain').mockRejectedValueOnce(
        new Error('GDPR_UNHANDLED_INTERNAL_STORE_FAILURE_EXPOSURE')
      );

      const req = new NextRequest('http://localhost:3000/api/webhooks/shopify/gdpr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const res = await ShopifyGdpr.POST(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Internal server error');
      expect(JSON.stringify(json)).not.toContain('GDPR_UNHANDLED_INTERNAL_STORE_FAILURE_EXPOSURE');
    });

    it('auth/shopify/callback catches internal exception and never leaks err.message', async () => {
      const secret = 'rf_shopify_secret_mock_88192';
      const searchParams = new URLSearchParams({
        shop: 'test-shop.myshopify.com',
        code: 'auth_code_123',
        state: 'oauth_nonce_state',
      });
      const entries: string[] = [];
      searchParams.forEach((val, key) => entries.push(`${key}=${val}`));
      entries.sort();
      const message = entries.join('&');
      const hmac = crypto.createHmac('sha256', secret).update(message).digest('hex');
      searchParams.set('hmac', hmac);

      vi.spyOn(db, 'getMerchantByShopDomain').mockRejectedValueOnce(
        new Error('OAUTH_DATABASE_CLUSTER_DOWN_CREDENTIAL_TRACE')
      );

      const req = new NextRequest(`http://localhost:3000/api/auth/shopify/callback?${searchParams.toString()}`);
      const res = await ShopifyCallback.GET(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Internal OAuth error');
      expect(JSON.stringify(json)).not.toContain('OAUTH_DATABASE_CLUSTER_DOWN_CREDENTIAL_TRACE');
    });
  });

  describe('3. Operator Takeover Manual Message Authorization', () => {
    it('fails with 401 when manualMessage is sent with no operator session or credentials', async () => {
      vi.stubEnv('RECOVERFLOW_ALLOW_ANON_DEMO', 'true');
      vi.stubEnv('RECOVERFLOW_RUNTIME_MODE', 'TEST');

      const req = new NextRequest('http://localhost:3000/api/chat/takeover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartId: 'cart_test_takeover_01',
          isTakenOver: true,
          manualMessage: 'Hello, this is store staff!',
        }),
      });

      const res = await ChatTakeover.POST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain('Unauthorized');
    });

    it('succeeds when manualMessage is sent with an authenticated operator session (SUPPORT_AGENT)', async () => {
      vi.stubEnv('RECOVERFLOW_RUNTIME_MODE', 'TEST');

      // Create a test cart in database
      await db.upsertCartEvent({
        id: 'cart_test_takeover_02',
        cartToken: 'tok_takeover_02',
        merchantId: 'merchant_default_01',
        customerPhone: '+919876543210',
        customerName: 'Takeover Customer',
        currency: 'INR',
        totalPrice: 1500,
        items: [],
        status: 'ABANDONED',
        checkoutUrl: 'https://store.example/checkout',
        abandonmentType: 'PAYMENT_FAILED',
        recoveryStage: 'QUEUED',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Login as SUPPORT_AGENT
      const loginReq = new NextRequest('http://localhost:3000/api/auth/session', {
        method: 'POST',
        headers: { origin: 'http://localhost:3000' },
        body: JSON.stringify({ method: 'demo', role: 'SUPPORT_AGENT' }),
      });
      const loginRes = await login(loginReq);
      expect(loginRes.status).toBe(200);
      const cookieHeader = loginRes.headers.get('set-cookie')!;
      const token = cookieHeader.split(';')[0].replace('recoverflow_session=', '');

      const req = new NextRequest('http://localhost:3000/api/chat/takeover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          cartId: 'cart_test_takeover_02',
          isTakenOver: true,
          manualMessage: 'Hello, I see your payment failed. How can I help?',
        }),
      });

      const res = await ChatTakeover.POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.messageSent).toBe(true);
    });

    it('succeeds when manualMessage is sent with a valid service token (x-admin-token)', async () => {
      vi.stubEnv('RECOVERFLOW_RUNTIME_MODE', 'TEST');
      vi.stubEnv('ADMIN_API_TOKEN', 'service_test_token_min_32_bytes_entropy_key');

      await db.upsertCartEvent({
        id: 'cart_test_takeover_03',
        cartToken: 'tok_takeover_03',
        merchantId: 'merchant_default_01',
        customerPhone: '+919876543210',
        customerName: 'Takeover Service Customer',
        currency: 'INR',
        totalPrice: 2000,
        items: [],
        status: 'ABANDONED',
        checkoutUrl: 'https://store.example/checkout',
        abandonmentType: 'PAYMENT_FAILED',
        recoveryStage: 'QUEUED',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const req = new NextRequest('http://localhost:3000/api/chat/takeover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': 'service_test_token_min_32_bytes_entropy_key',
        },
        body: JSON.stringify({
          cartId: 'cart_test_takeover_03',
          isTakenOver: true,
          manualMessage: 'Dispatched via machine-to-machine service token.',
        }),
      });

      const res = await ChatTakeover.POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.messageSent).toBe(true);
    });

    it('rejects manualMessage when an invalid service token is provided', async () => {
      vi.stubEnv('RECOVERFLOW_RUNTIME_MODE', 'TEST');
      vi.stubEnv('ADMIN_API_TOKEN', 'service_test_token_min_32_bytes_entropy_key');

      const req = new NextRequest('http://localhost:3000/api/chat/takeover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': 'invalid-service-token-wrong',
        },
        body: JSON.stringify({
          cartId: 'cart_test_takeover_03',
          isTakenOver: true,
          manualMessage: 'This should fail authorization.',
        }),
      });

      const res = await ChatTakeover.POST(req);
      expect([401, 403]).toContain(res.status);
      const json = await res.json();
      expect(json.error).toContain('Unauthorized');
    });
  });
});
