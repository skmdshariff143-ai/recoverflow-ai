import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@recoverflow/core';

describe('Multi-Tenant Row-Level Security & Data Isolation', () => {
  const MERCHANT_A = 'merchant_tenant_alpha';
  const MERCHANT_B = 'merchant_tenant_beta';

  beforeEach(async () => {
    // Register Tenant Alpha
    await db.upsertMerchant({
      id: MERCHANT_A,
      storeUrl: 'https://alpha.myshopify.com',
      storeName: 'Alpha Store',
      shopDomain: 'alpha.myshopify.com',
      webhookSecret: 'whsec_alpha_123',
      shopifyAccessToken: 'shpat_alpha_123',
      whatsappToken: 'token_alpha',
      whatsappPhoneId: 'phone_alpha',
      whatsappTemplateName: 'recovery_alpha',
      resendApiKey: 'resend_alpha',
      fromEmail: 'alpha@store.com',
      brandToneGuidelines: 'Friendly and premium',
      brandVoiceCasualVsFormal: 60,
      brandVoiceUrgencyVsGentle: 40,
      discountCeilingPercentage: 15,
      minMarginPercentage: 20,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Register Tenant Beta
    await db.upsertMerchant({
      id: MERCHANT_B,
      storeUrl: 'https://beta.myshopify.com',
      storeName: 'Beta Store',
      shopDomain: 'beta.myshopify.com',
      webhookSecret: 'whsec_beta_456',
      shopifyAccessToken: 'shpat_beta_456',
      whatsappToken: 'token_beta',
      whatsappPhoneId: 'phone_beta',
      whatsappTemplateName: 'recovery_beta',
      resendApiKey: 'resend_beta',
      fromEmail: 'beta@store.com',
      brandToneGuidelines: 'Modern luxury',
      brandVoiceCasualVsFormal: 30,
      brandVoiceUrgencyVsGentle: 70,
      discountCeilingPercentage: 20,
      minMarginPercentage: 25,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create Cart for Tenant Alpha
    await db.createCartWithOutbox({
      merchantId: MERCHANT_A,
      cartToken: 'tok_alpha_cart_001',
      customerEmail: 'customer.alpha@example.com',
      customerPhone: '+15551112222',
      customerName: 'Alice Alpha',
      items: [{ id: 'item_a_1', title: 'Alpha Item', price: 100, quantity: 1 }],
      totalPrice: 100,
      currency: 'USD',
      checkoutUrl: 'https://alpha.myshopify.com/checkouts/tok_alpha_cart_001',
      abandonmentType: 'CHECKOUT_STEP',
      status: 'OPEN',
      recoveryStage: 'NOT_STARTED',
      suggestedDiscountCode: null,
    });

    // Create Cart for Tenant Beta
    await db.createCartWithOutbox({
      merchantId: MERCHANT_B,
      cartToken: 'tok_beta_cart_001',
      customerEmail: 'customer.beta@example.com',
      customerPhone: '+15553334444',
      customerName: 'Bob Beta',
      items: [{ id: 'item_b_1', title: 'Beta Item', price: 200, quantity: 1 }],
      totalPrice: 200,
      currency: 'USD',
      checkoutUrl: 'https://beta.myshopify.com/checkouts/tok_beta_cart_001',
      abandonmentType: 'PAYMENT_FAILED',
      status: 'OPEN',
      recoveryStage: 'NOT_STARTED',
      suggestedDiscountCode: null,
    });
  });

  it('prevents cross-tenant cart retrieval via getCartByToken', async () => {
    // Tenant Alpha requests Tenant Alpha's cart -> Found
    const alphaCart = await db.getCartByToken('tok_alpha_cart_001', MERCHANT_A);
    expect(alphaCart).not.toBeNull();
    expect(alphaCart?.customerName).toBe('Alice Alpha');

    // Tenant Beta requests Tenant Alpha's cart -> Blocked / Null
    const betaIllegalRead = await db.getCartByToken('tok_alpha_cart_001', MERCHANT_B);
    expect(betaIllegalRead).toBeNull();
  });

  it('prevents cross-tenant customer search via findCartByCustomerOrToken', async () => {
    // Tenant Beta tries searching by Alice's email
    const crossTenantSearch = await db.findCartByCustomerOrToken('customer.alpha@example.com', MERCHANT_B);
    expect(crossTenantSearch).toBeNull();

    // Tenant Alpha searching Alice's email -> Found
    const validSearch = await db.findCartByCustomerOrToken('customer.alpha@example.com', MERCHANT_A);
    expect(validSearch).not.toBeNull();
    expect(validSearch?.cartToken).toBe('tok_alpha_cart_001');
  });

  it('isolates cart listings strictly per merchantId', async () => {
    const alphaList = await db.listCartEvents(MERCHANT_A);
    const betaList = await db.listCartEvents(MERCHANT_B);

    expect(alphaList.every((c) => c.merchantId === MERCHANT_A)).toBe(true);
    expect(betaList.every((c) => c.merchantId === MERCHANT_B)).toBe(true);
  });

  it('isolates pending outbox events per merchantId', async () => {
    const alphaOutbox = await (db as any).getPendingOutboxEvents(50, MERCHANT_A);
    const betaOutbox = await (db as any).getPendingOutboxEvents(50, MERCHANT_B);

    expect(alphaOutbox.every((e: any) => e.merchantId === MERCHANT_A)).toBe(true);
    expect(betaOutbox.every((e: any) => e.merchantId === MERCHANT_B)).toBe(true);
  });
});
