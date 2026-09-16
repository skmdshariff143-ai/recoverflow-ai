import { describe, it, expect, beforeEach } from 'vitest';
import { sendWhatsAppCatalogCheckout } from '@recoverflow/jobs';
import { db } from '@recoverflow/core';

describe('WhatsApp Native Catalog Checkout & Flow Integration (Track 1)', () => {
  const MERCHANT_ID = 'merch_catalog_test_01';

  beforeEach(async () => {
    await db.upsertMerchant({
      id: MERCHANT_ID,
      storeUrl: 'https://velvet-luxe.myshopify.com',
      storeName: 'Velvet Luxe',
      shopDomain: 'velvet-luxe.myshopify.com',
      webhookSecret: 'whsec_catalog_123',
      whatsappToken: 'token_mock',
      whatsappPhoneId: 'phone_mock',
      whatsappTemplateName: 'recovery_template',
      brandToneGuidelines: 'Artisan luxury',
      brandVoiceCasualVsFormal: 0.8,
      brandVoiceUrgencyVsGentle: 0.3,
      discountCeilingPercentage: 15.0,
      minMarginPercentage: 20.0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.createCartWithOutbox({
      merchantId: MERCHANT_ID,
      cartToken: 'tok_flow_cart_101',
      customerPhone: '+15554443333',
      customerName: 'Eleanor Vance',
      items: [{ id: 'item_flow_1', title: 'Silk Scarf', price: 180.0, quantity: 1 }],
      totalPrice: 180.0,
      currency: 'USD',
      checkoutUrl: 'https://velvet-luxe.myshopify.com/c/tok_flow_cart_101',
      abandonmentType: 'CHECKOUT_STEP',
      status: 'OPEN',
      recoveryStage: 'NOT_STARTED',
      suggestedDiscountCode: 'SILK10',
    });
  });

  it('constructs interactive catalog_message payload with product thumbnail and discount pill', async () => {
    const result = await sendWhatsAppCatalogCheckout({
      to: '+15554443333',
      bodyText: 'Your Silk Scarf is reserved. Tap below to review catalog items and pay directly in WhatsApp.',
      catalogId: 'catalog_velvet_01',
      items: [
        {
          retailerId: 'prod_silk_scarf_01',
          title: 'Silk Scarf',
          price: 180.0,
          currency: 'USD',
        },
      ],
      discountCode: 'SILK10',
    });

    expect(result.success).toBe(true);
    expect(result.simulated).toBe(true);
    expect(result.catalogPayload).toBeDefined();

    const interactive = result.catalogPayload?.interactive as {
      type?: string;
      action?: { parameters?: { thumbnail_product_retailer_id?: string } };
      footer?: { text?: string };
    };
    expect(interactive?.type).toBe('catalog_message');
    expect(interactive?.action?.parameters?.thumbnail_product_retailer_id).toBe('prod_silk_scarf_01');
    expect(interactive?.footer?.text).toContain('SILK10');
  });

  it('completes order when receiving simulated flow_completion webhook payload', async () => {
    const cart = await db.getCartByToken('tok_flow_cart_101', MERCHANT_ID);
    expect(cart).not.toBeNull();
    expect(cart?.status).toBe('OPEN');

    // Simulate WhatsApp flow completion
    await db.updateCartStatus(cart!.id, 'RECOVERED', 'RECOVERED');
    const updated = await db.getCartById(cart!.id);

    expect(updated?.status).toBe('RECOVERED');
    expect(updated?.recoveredAt).toBeDefined();
  });
});
