/**
 * RecoverFlow AI — Sandboxed Shopify Web Pixel Extension (2026 Customer Events API Standard)
 * Strictly zero DOM access, fully isolated within Shopify Worker Sandbox.
 */

export interface ShopifyAnalyticsEvent<T = Record<string, unknown>> {
  id: string;
  name: string;
  timestamp: string;
  data: T;
  context?: {
    document?: {
      location?: {
        href?: string;
        pathname?: string;
        search?: string;
      };
    };
    navigator?: {
      language?: string;
      userAgent?: string;
    };
  };
}

export interface WebPixelSettings {
  accountID?: string;
  endpointUrl?: string;
}

export interface WebPixelApi {
  analytics: {
    subscribe: <T = Record<string, unknown>>(
      eventName: string,
      callback: (event: ShopifyAnalyticsEvent<T>) => void
    ) => void;
  };
  browser: {
    sendBeacon?: (url: string, body?: string) => boolean;
    cookie?: {
      get: (name: string) => Promise<string | null>;
      set: (name: string, value: string) => Promise<void>;
    };
  };
  settings: WebPixelSettings;
  init: Record<string, unknown>;
}

export interface ShopifyRawLineItem {
  id?: string | number;
  title?: string;
  variantTitle?: string;
  price?: string | number | { amount?: string | number };
  finalPrice?: { amount?: string | number };
  quantity?: number;
  variant?: { title?: string; sku?: string };
  sku?: string;
}

export interface ShopifyRawCheckout {
  id?: string | number;
  token?: string;
  email?: string;
  phone?: string;
  totalPrice?: { amount?: string | number };
  subtotalPrice?: { amount?: string | number };
  currencyCode?: string;
  lineItems?: ShopifyRawLineItem[];
}

export interface ShopifyRawData {
  checkout?: ShopifyRawCheckout;
  cart?: { id?: string };
  cartToken?: string;
  email?: string;
  phone?: string;
}

export function buildWebPixelPayload(
  eventName: string,
  event: ShopifyAnalyticsEvent,
  settings: WebPixelSettings
) {
  const data = (event.data || {}) as ShopifyRawData;
  const checkout = data.checkout || {};
  const lineItems = (checkout.lineItems || []).map((item) => ({
    id: String(item.id || ''),
    title: String(item.title || 'Product'),
    variantTitle: item.variant?.title || item.variantTitle,
    price: parseFloat(
      String(
        item.finalPrice?.amount ||
          (typeof item.price === 'object' ? item.price?.amount : item.price) ||
          '0'
      )
    ),
    quantity: Number(item.quantity || 1),
    sku: item.variant?.sku || item.sku,
  }));

  const cartToken = String(
    checkout.token ||
    checkout.id ||
    data.cart?.id ||
    data.cartToken ||
    `tok_shopify_${event.id}`
  );

  const email = (checkout.email || data.email || '') as string;
  const phone = (checkout.phone || data.phone || '') as string;
  const totalPrice = parseFloat(String(checkout.totalPrice?.amount || checkout.subtotalPrice?.amount || '0'));
  const currency = String(checkout.currencyCode || 'USD');

  return {
    cartToken,
    merchantId: settings.accountID || 'merchant_default_01',
    eventType: eventName.toUpperCase(),
    timestamp: Date.now(),
    customerEmail: email || undefined,
    customerPhone: phone || undefined,
    totalPrice: totalPrice || 0,
    currency,
    items: lineItems,
    checkoutUrl: event.context?.document?.location?.href || '',
    rawEventId: event.id,
  };
}

export function dispatchTelemetry(
  endpoint: string,
  payload: Record<string, unknown>,
  browser?: WebPixelApi['browser']
) {
  const body = JSON.stringify(payload);
  if (browser?.sendBeacon) {
    try {
      const sent = browser.sendBeacon(endpoint, body);
      if (sent) return true;
    } catch {
      // Fall through to fetch
    }
  }

  if (typeof fetch !== 'undefined') {
    void fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
    return true;
  }
  return false;
}

/**
 * Main Web Pixel Entrypoint for Shopify App Extension
 */
export function initShopifyWebPixel(api: WebPixelApi) {
  const { analytics, browser, settings } = api;
  const endpoint = settings.endpointUrl || '/api/v1/telemetry/intent';

  // 1. Checkout Started
  analytics.subscribe('checkout_started', (event) => {
    const payload = buildWebPixelPayload('checkout_started', event, settings);
    dispatchTelemetry(endpoint, payload, browser);
  });

  // 2. Payment Info Submitted (Pre-drop detection)
  analytics.subscribe('payment_info_submitted', (event) => {
    const payload = buildWebPixelPayload('payment_info_submitted', event, settings);
    dispatchTelemetry(endpoint, payload, browser);
  });

  // 3. Checkout Completed (Conversions & Suppression)
  analytics.subscribe('checkout_completed', (event) => {
    const payload = buildWebPixelPayload('checkout_completed', event, settings);
    dispatchTelemetry(endpoint, payload, browser);
  });
}
