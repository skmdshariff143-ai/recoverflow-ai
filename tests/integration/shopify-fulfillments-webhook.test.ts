import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from '../../apps/web/src/app/api/webhooks/shopify/fulfillments/route';
import { NextRequest } from 'next/server';
import { db, generateShopifyHmac } from '@recoverflow/core';

describe('Shopify Fulfillments Webhook Ingestion (Track 3 Integration)', () => {
  const mockMerchant = {
    id: 'merchant_default_01',
    storeUrl: 'https://aurora-apparel.myshopify.com',
    shopDomain: 'aurora-apparel.myshopify.com',
    storeName: 'Aurora Luxury Apparel',
    webhookSecret: 'shpss_test_secret_key_99182',
    brandToneGuidelines: 'Sophisticated, warm, concise.',
    brandVoiceCasualVsFormal: 0.7,
    brandVoiceUrgencyVsGentle: 0.35,
    discountCeilingPercentage: 15.0,
    minMarginPercentage: 25.0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    await db.createOrUpdateMerchant(mockMerchant);
  });

  it('rejects webhook requests with invalid HMAC signatures', async () => {
    const rawBody = JSON.stringify({
      id: 99120481,
      order_id: 88129481,
      status: 'in_transit',
    });

    const req = new NextRequest('http://localhost:3000/api/webhooks/shopify/fulfillments', {
      method: 'POST',
      body: rawBody,
      headers: {
        'x-shopify-hmac-sha256': 'invalid_forged_hmac_signature',
        'x-shopify-shop-domain': 'aurora-apparel.myshopify.com',
        'content-type': 'application/json',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toContain('Invalid HMAC signature');
  });

  it('successfully ingests valid fulfillment payloads, creates Fulfillment record, and updates Order', async () => {
    const fulfillmentPayload = {
      id: 99120481,
      order_id: 88129481,
      order_name: '#1099',
      status: 'in_transit',
      shipment_status: 'in_transit',
      tracking_company: 'DHL Express',
      tracking_number: 'DHL9911223344',
      tracking_urls: ['https://track.dhl.com?trk=DHL9911223344'],
      created_at: '2026-09-15T08:00:00Z',
      updated_at: '2026-09-15T08:30:00Z',
      destination: {
        city: 'San Francisco',
        province: 'CA',
        country: 'US',
      },
      line_items: [
        {
          id: 501,
          title: 'Silk Evening Gown',
          price: 450.0,
          quantity: 1,
        },
      ],
      phone: '+14155552671',
      email: 'clara@luxurybrand.com',
    };

    const rawBody = JSON.stringify(fulfillmentPayload);
    const validHmac = generateShopifyHmac(rawBody, mockMerchant.webhookSecret);

    const req = new NextRequest('http://localhost:3000/api/webhooks/shopify/fulfillments', {
      method: 'POST',
      body: rawBody,
      headers: {
        'x-shopify-hmac-sha256': validHmac,
        'x-shopify-shop-domain': 'aurora-apparel.myshopify.com',
        'content-type': 'application/json',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('processed');
    expect(json.transitStatus).toBe('IN_TRANSIT');
    expect(json.trackingNumber).toBe('DHL9911223344');

    // Verify persisted in DB
    const savedFulfillment = await db.getFulfillmentByShopifyId('99120481');
    expect(savedFulfillment).toBeDefined();
    expect(savedFulfillment?.trackingCompany).toBe('DHL Express');
    expect(savedFulfillment?.latestLocation).toBe('San Francisco, CA');

    const savedOrder = await db.getOrderByShopifyId('88129481');
    expect(savedOrder).toBeDefined();
    expect(savedOrder?.orderNumber).toBe('#1099');
    expect(savedOrder?.fulfillmentStatus).toBe('PARTIALLY_FULFILLED');
  });

  it('prevents duplicate processing on identical webhook payloads via idempotency lock', async () => {
    const fulfillmentPayload = {
      id: 99120999,
      order_id: 88129999,
      status: 'delivered',
      shipment_status: 'delivered',
      tracking_company: 'FedEx',
      tracking_number: 'TRK_IDEMP_123',
      created_at: '2026-09-15T09:00:00Z',
      updated_at: '2026-09-15T09:00:00Z',
    };

    const rawBody = JSON.stringify(fulfillmentPayload);
    const validHmac = generateShopifyHmac(rawBody, mockMerchant.webhookSecret);

    const makeRequest = () =>
      new NextRequest('http://localhost:3000/api/webhooks/shopify/fulfillments', {
        method: 'POST',
        body: rawBody,
        headers: {
          'x-shopify-hmac-sha256': validHmac,
          'x-shopify-shop-domain': 'aurora-apparel.myshopify.com',
          'content-type': 'application/json',
        },
      });

    // First request: processes successfully
    const res1 = await POST(makeRequest());
    expect(res1.status).toBe(200);
    const json1 = await res1.json();
    expect(json1.status).toBe('processed');

    // Second duplicate request: ignored idempotently
    const res2 = await POST(makeRequest());
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2.status).toBe('ignored');
  });
});
