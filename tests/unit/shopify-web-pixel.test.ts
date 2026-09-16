import { describe, it, expect, vi } from 'vitest';
import {
  buildWebPixelPayload,
  dispatchTelemetry,
  initShopifyWebPixel,
  registerShopifyWebPixel,
  type ShopifyAnalyticsEvent,
  type WebPixelApi,
} from '@recoverflow/shopify-app';

describe('Shopify Web Pixel Extension (2026 Customer Events API)', () => {
  it('correctly maps checkout_started event payload into standardized telemetry format', () => {
    const mockEvent: ShopifyAnalyticsEvent = {
      id: 'evt_12345',
      name: 'checkout_started',
      timestamp: '2026-09-16T00:00:00.000Z',
      data: {
        checkout: {
          id: 'chk_999',
          token: 'tok_abc123',
          email: 'vip.shopper@example.com',
          phone: '+15551234567',
          currencyCode: 'USD',
          totalPrice: { amount: '1250.00' },
          lineItems: [
            {
              id: 'item_1',
              title: 'Luxury Cashmere Coat',
              price: '1250.00',
              quantity: 1,
            },
          ],
        },
      },
      context: {
        document: {
          location: {
            href: 'https://store.myshopify.com/checkouts/tok_abc123',
          },
        },
      },
    };

    const payload = buildWebPixelPayload('checkout_started', mockEvent, {
      accountID: 'merchant_vip_001',
    });

    expect(payload.cartToken).toBe('tok_abc123');
    expect(payload.merchantId).toBe('merchant_vip_001');
    expect(payload.eventType).toBe('CHECKOUT_STARTED');
    expect(payload.customerEmail).toBe('vip.shopper@example.com');
    expect(payload.customerPhone).toBe('+15551234567');
    expect(payload.totalPrice).toBe(1250.0);
    expect(payload.currency).toBe('USD');
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].title).toBe('Luxury Cashmere Coat');
  });

  it('subscribes to checkout_started, payment_info_submitted, and checkout_completed without touching DOM', () => {
    const subscriptions: Record<string, (evt: ShopifyAnalyticsEvent) => void> = {};
    const mockBeacon = vi.fn().mockReturnValue(true);

    const mockApi: WebPixelApi = {
      analytics: {
        subscribe: <T = Record<string, unknown>>(eventName: string, cb: (evt: ShopifyAnalyticsEvent<T>) => void) => {
          subscriptions[eventName] = cb as (evt: ShopifyAnalyticsEvent) => void;
        },
      },
      browser: {
        sendBeacon: mockBeacon,
      },
      settings: {
        accountID: 'merch_test_99',
        endpointUrl: 'https://recoverflow-ai-kohl.vercel.app/api/v1/telemetry/intent',
      },
      init: {},
    };

    initShopifyWebPixel(mockApi);

    expect(subscriptions['checkout_started']).toBeDefined();
    expect(subscriptions['payment_info_submitted']).toBeDefined();
    expect(subscriptions['checkout_completed']).toBeDefined();

    // Trigger payment_info_submitted
    subscriptions['payment_info_submitted']({
      id: 'evt_pay_01',
      name: 'payment_info_submitted',
      timestamp: '2026-09-16T01:00:00.000Z',
      data: {
        checkout: {
          token: 'tok_pay_999',
          totalPrice: { amount: '450.00' },
        },
      },
    });

    expect(mockBeacon).toHaveBeenCalledTimes(1);
    expect(mockBeacon).toHaveBeenCalledWith(
      'https://recoverflow-ai-kohl.vercel.app/api/v1/telemetry/intent',
      expect.stringContaining('PAYMENT_INFO_SUBMITTED')
    );
  });

  it('dispatches telemetry via browser.sendBeacon when available', () => {
    const mockSendBeacon = vi.fn().mockReturnValue(true);
    const result = dispatchTelemetry(
      'https://example.com/api',
      { test: true },
      { sendBeacon: mockSendBeacon }
    );
    expect(result).toBe(true);
    expect(mockSendBeacon).toHaveBeenCalledWith('https://example.com/api', '{"test":true}');
  });

  it('handles GraphQL Admin webPixelCreate registration gracefully with mock response', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          webPixelCreate: {
            userErrors: [],
            webPixel: { id: 'gid://shopify/WebPixel/12345' },
          },
        },
      }),
    });

    global.fetch = fakeFetch as unknown as typeof fetch;

    const result = await registerShopifyWebPixel({
      shopDomain: 'luxury-boutique.myshopify.com',
      accessToken: 'shpat_mock_token_123',
      accountID: 'merch_vip_100',
    });

    expect(result.success).toBe(true);
    expect(result.pixelId).toBe('gid://shopify/WebPixel/12345');
    expect(result.userErrors).toBeUndefined();
  });
});
