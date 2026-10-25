import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, createSessionToken, verifySessionToken, hashSessionToken, DEMO_PERSONA_SESSIONS } from '@recoverflow/core';
import { GET as getRecoveryEvents } from '@/app/api/recovery/events/route';
import { GET as getReportExport, REPORT_ATTRIBUTION_CONFIG } from '@/app/api/recovery/reports/export/route';

describe('Honest Metrics & Zero-State Telemetry (Stage 1.1)', () => {
  beforeEach(async () => {
    vi.stubEnv('RECOVERFLOW_ALLOW_ANON_DEMO', 'true');
    vi.stubEnv('RECOVERFLOW_RUNTIME_MODE', 'TEST');

    // Reset database to a known merchant with empty carts/messages
    const merchantId = 'merchant_honest_test_01';
    await db.upsertMerchant({
      id: merchantId,
      storeUrl: 'https://test-store.myshopify.com',
      storeName: 'Honest Test Apparel',
      webhookSecret: 'shpss_test_secret_key_123',
      brandToneGuidelines: 'Professional',
      brandVoiceCasualVsFormal: 0.5,
      brandVoiceUrgencyVsGentle: 0.5,
      discountCeilingPercentage: 10,
      minMarginPercentage: 20,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  async function makeAuthHeaders(merchantId: string) {
    const token = createSessionToken({
      ...DEMO_PERSONA_SESSIONS.RECOVERY_MANAGER,
      activeMerchantId: merchantId,
      runtimeMode: 'TEST',
    });
    const { valid, session } = verifySessionToken(token);
    if (!valid || !session) throw new Error('Failed to mint valid session');

    await db.createSession({
      userId: session.userId,
      tokenHash: hashSessionToken(token),
      organizationId: session.organizationId,
      activeMerchantId: merchantId,
      role: session.role,
      expiresAt: new Date(session.expiresAt),
    });
    return {
      Authorization: `Bearer ${token}`,
      'x-merchant-id': merchantId,
    };
  }

  it('GET /api/recovery/events returns null/zero and never fabricated numbers for empty carts', async () => {
    const merchantId = 'merchant_honest_test_01';
    const headers = await makeAuthHeaders(merchantId);
    const req = new NextRequest('http://localhost:3000/api/recovery/events', {
      headers,
    });

    const res = await getRecoveryEvents(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.stats).toBeDefined();

    // Zero-state assertions
    expect(body.stats.totalCarts).toBe(0);
    expect(body.stats.recoveredCount).toBe(0);
    expect(body.stats.recoveredGmv).toBe(0);
    expect(body.stats.recoveryRatePercent).toBe(0);

    // Insufficient data assertions (must be null, never invented defaults)
    expect(body.stats.avgResolutionMinutes).toBeNull();
    expect(body.stats.channelRoi.whatsapp).toBeNull();
    expect(body.stats.channelRoi.email).toBeNull();

    // Negative assertions against previous hardcoded inflation
    const jsonStr = JSON.stringify(body);
    expect(jsonStr).not.toContain('"conversionRate":66.7');
    expect(jsonStr).not.toContain('"roiMultiplier":14.2');
    expect(jsonStr).not.toContain('"avgResolutionMinutes":24');
  });

  it('GET /api/recovery/events computes real resolution latency and channel attribution from actual records', async () => {
    const merchantId = 'merchant_honest_test_01';
    const now = Date.now();

    // 1. Abandoned cart that recovered 15 minutes later
    await db.upsertCartEvent({
      id: 'cart_real_01',
      cartToken: 'tok_01',
      merchantId,
      customerPhone: '+15551234567',
      currency: 'USD',
      totalPrice: 200,
      status: 'RECOVERED',
      abandonmentType: 'CHECKOUT_STEP',
      recoveryStage: 'RECOVERED',
      checkoutUrl: 'https://store.example/c1',
      items: [{ id: 'i1', title: 'Coat', price: 200, quantity: 1 }],
      createdAt: new Date(now - 15 * 60 * 1000),
      recoveredAt: new Date(now),
      updatedAt: new Date(now),
    });

    // 2. Unrecovered cart
    await db.upsertCartEvent({
      id: 'cart_real_02',
      cartToken: 'tok_02',
      merchantId,
      customerPhone: '+15559876543',
      currency: 'USD',
      totalPrice: 100,
      status: 'ABANDONED',
      abandonmentType: 'PAYMENT_FAILED',
      recoveryStage: 'WHATSAPP_SENT',
      checkoutUrl: 'https://store.example/c2',
      items: [{ id: 'i2', title: 'Shirt', price: 100, quantity: 1 }],
      createdAt: new Date(now - 30 * 60 * 1000),
      updatedAt: new Date(now - 30 * 60 * 1000),
    });

    // 3. Message log for cart 01
    await db.logMessage({
      id: 'msg_01',
      merchantId,
      cartEventId: 'cart_real_01',
      channel: 'WHATSAPP',
      direction: 'OUTBOUND',
      content: 'Here is your link',
      deliveryStatus: 'DELIVERED',
      createdAt: new Date(now - 14 * 60 * 1000),
    });

    const headers = await makeAuthHeaders(merchantId);
    const req = new NextRequest('http://localhost:3000/api/recovery/events', {
      headers,
    });

    const res = await getRecoveryEvents(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.stats.totalCarts).toBe(2);
    expect(body.stats.recoveredCount).toBe(1);
    expect(body.stats.recoveredGmv).toBe(200);
    expect(body.stats.recoveryRatePercent).toBe(50);

    // Resolution latency: 15 minutes
    expect(body.stats.avgResolutionMinutes).toBe(15);

    // WhatsApp attribution: 1 sent, 1 recovered => 100% conversion
    expect(body.stats.channelRoi.whatsapp).not.toBeNull();
    expect(body.stats.channelRoi.whatsapp.sent).toBe(1);
    expect(body.stats.channelRoi.whatsapp.recovered).toBe(1);
    expect(body.stats.channelRoi.whatsapp.conversionRate).toBe(100);

    // Email attribution: 0 sent => null
    expect(body.stats.channelRoi.email).toBeNull();
  });

  it('GET /api/recovery/reports/export returns empty state and never fabricated fallbacks on empty data', async () => {
    const merchantId = 'merchant_empty_audit_01';
    await db.upsertMerchant({
      id: merchantId,
      storeUrl: 'https://empty-store.myshopify.com',
      storeName: 'Empty Store',
      webhookSecret: 'shpss_sec_empty',
      brandToneGuidelines: 'Friendly',
      brandVoiceCasualVsFormal: 0.5,
      brandVoiceUrgencyVsGentle: 0.5,
      discountCeilingPercentage: 10,
      minMarginPercentage: 20,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const headers = await makeAuthHeaders(merchantId);

    // Empty merchant
    const reqJson = new NextRequest('http://localhost:3000/api/recovery/reports/export?format=json', {
      headers,
    });

    const resJson = await getReportExport(reqJson);
    expect(resJson.status).toBe(200);
    const bodyJson = await resJson.json();

    expect(bodyJson.status).toBe('EMPTY');
    expect(bodyJson.metrics).toBeNull();
    expect(bodyJson.message).toContain('No recovery records found');
    expect(bodyJson.assumptions).toBeDefined();

    // Verify fabricated fallbacks (100, 35, 12850, 36000) are completely absent
    const serialized = JSON.stringify(bodyJson);
    expect(serialized).not.toContain('"totalAbandonedCarts":100');
    expect(serialized).not.toContain('"recoveredOrders":35');
    expect(serialized).not.toContain('12850');
    expect(serialized).not.toContain('36000');

    // CSV format empty state
    const reqCsv = new NextRequest('http://localhost:3000/api/recovery/reports/export?format=csv', {
      headers,
    });
    const resCsv = await getReportExport(reqCsv);
    expect(resCsv.status).toBe(200);
    const textCsv = await resCsv.text();
    expect(textCsv).toContain('No recovery records found');
    expect(textCsv).not.toContain('12850.00');
    expect(textCsv).not.toContain('36000.00');
  });

  it('GET /api/recovery/reports/export includes documented assumption metadata and real calculations when populated', async () => {
    const merchantId = 'merchant_populated_audit_01';
    await db.upsertMerchant({
      id: merchantId,
      storeUrl: 'https://populated.myshopify.com',
      storeName: 'Populated Store',
      webhookSecret: 'shpss_sec',
      brandToneGuidelines: 'Friendly',
      brandVoiceCasualVsFormal: 0.5,
      brandVoiceUrgencyVsGentle: 0.5,
      discountCeilingPercentage: 10,
      minMarginPercentage: 20,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.upsertCartEvent({
      id: 'cart_pop_01',
      cartToken: 'tok_pop_01',
      merchantId,
      currency: 'USD',
      totalPrice: 500,
      status: 'RECOVERED',
      abandonmentType: 'CHECKOUT_STEP',
      recoveryStage: 'RECOVERED',
      checkoutUrl: 'https://store.example/c1',
      items: [{ id: 'i1', title: 'Luxury Bag', price: 500, quantity: 1 }],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const headers = await makeAuthHeaders(merchantId);

    const reqJson = new NextRequest('http://localhost:3000/api/recovery/reports/export?format=json', {
      headers,
    });

    const resJson = await getReportExport(reqJson);
    expect(resJson.status).toBe(200);
    const bodyJson = await resJson.json();

    expect(bodyJson.metrics.totalAbandonedCarts).toBe(1);
    expect(bodyJson.metrics.recoveredOrders).toBe(1);
    expect(bodyJson.metrics.totalRecoveredGmv).toBe(500);
    expect(bodyJson.metrics.activeConversionRatePercent).toBe(100);

    // Documented assumptions
    expect(bodyJson.assumptions).toEqual(REPORT_ATTRIBUTION_CONFIG);
    expect(bodyJson.assumptions.holdoutBaselineConversionRate.isAssumption).toBe(true);
    expect(bodyJson.assumptions.contributionMarginRate.isAssumption).toBe(true);

    // CSV format contains Assumption labels
    const reqCsv = new NextRequest('http://localhost:3000/api/recovery/reports/export?format=csv', {
      headers,
    });
    const resCsv = await getReportExport(reqCsv);
    const textCsv = await resCsv.text();
    expect(textCsv).toContain('[Assumption:');
  });
});
