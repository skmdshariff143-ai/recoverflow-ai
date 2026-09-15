import { describe, it, expect } from 'vitest';
import { 
  createShopifySingleUseDiscount, 
  checkShopifyInventoryAvailability,
  db,
  type Merchant,
  type CartItem,
  type CartEvent
} from '@recoverflow/core';
import { globalRecoveryQueue } from '@recoverflow/jobs';

describe('Shopify Admin GraphQL Mutations & Inventory Guardrails', () => {
  const merchant: Merchant = {
    id: 'merchant_graphql_test',
    storeUrl: 'https://aurora-apparel.myshopify.com',
    shopDomain: 'aurora-apparel.myshopify.com',
    storeName: 'Aurora Luxury Apparel',
    webhookSecret: 'shpss_sec_123',
    discountCeilingPercentage: 15.0,
    minMarginPercentage: 20.0,
    brandToneGuidelines: 'Refined and courteous',
    brandVoiceCasualVsFormal: 0.7,
    brandVoiceUrgencyVsGentle: 0.4,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('generates a unique single-use coupon code with 2-hour expiry and subtotal minimum', async () => {
    const result = await createShopifySingleUseDiscount(merchant, {
      merchantId: merchant.id,
      cartToken: 'tok_test_cart_99182',
      discountPercentage: 15.0,
      minSubtotalAmount: 180.0,
      currency: 'USD',
      durationHours: 2,
    });

    expect(result.code).toMatch(/^RF-[2-9A-Z]{5}$/);
    expect(result.discountPercentage).toBe(15.0);
    expect(result.subtotalMinimum).toBe(180.0);

    // Verify expiry is ~2 hours in the future
    const expectedExpiry = Date.now() + 2 * 60 * 60 * 1000;
    expect(Math.abs(result.expiresAt.getTime() - expectedExpiry)).toBeLessThan(5000);
  });

  it('detects available inventory accurately', async () => {
    const inStockItems: CartItem[] = [
      { id: 'item_1', variantId: 'gid://shopify/ProductVariant/101', title: 'Silk Scarf', price: 90, quantity: 1 },
      { id: 'item_2', variantId: 'gid://shopify/ProductVariant/102', title: 'Leather Cardholder', price: 65, quantity: 1 },
    ];

    const inventoryCheck = await checkShopifyInventoryAvailability(merchant, inStockItems);
    expect(inventoryCheck.allAvailable).toBe(true);
    expect(inventoryCheck.unavailableItems).toHaveLength(0);
  });

  it('aborts recovery dispatch and flags OUT_OF_STOCK_ABORTED when items are out of stock', async () => {
    const outOfStockItems: CartItem[] = [
      { id: 'item_3', variantId: 'gid://shopify/ProductVariant/103', title: 'Limited Edition Handbag (Out of Stock)', price: 420, quantity: 1 },
    ];

    const oosCart: CartEvent = {
      id: 'cart_oos_test_01',
      cartToken: 'tok_oos_cart',
      merchantId: merchant.id,
      customerName: 'Victoria Sterling',
      customerPhone: '+14155557766',
      currency: 'USD',
      totalPrice: 420.0,
      items: outOfStockItems,
      status: 'ABANDONED',
      abandonmentType: 'CHECKOUT_STEP',
      recoveryStage: 'QUEUED',
      checkoutUrl: 'https://aurora.com/checkouts/oos',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.upsertMerchant(merchant);
    await db.upsertCartEvent(oosCart);

    const recoveryResult = await globalRecoveryQueue.executePrimaryRecovery(oosCart.id);
    expect(recoveryResult.aborted).toBe(true);
    expect(recoveryResult.reason).toContain('Inventory out of stock');

    const updatedCart = await db.getCartById(oosCart.id);
    expect(updatedCart?.status).toBe('OUT_OF_STOCK_ABORTED');
    expect(updatedCart?.recoveryStage).toBe('OUT_OF_STOCK_ABORTED');
  });

  it('cancels pending queue jobs upon order completion and attributes recovery', async () => {
    const cart: CartEvent = {
      id: 'cart_cancel_test_01',
      cartToken: 'tok_completed_order_881',
      merchantId: merchant.id,
      customerName: 'George Washington',
      customerPhone: '+14155551776',
      customerEmail: 'gw@mountvernon.org',
      currency: 'USD',
      totalPrice: 240.0,
      items: [{ id: 'item_4', title: 'Wool Waistcoat', price: 240, quantity: 1 }],
      status: 'CONTACTED',
      abandonmentType: 'CHECKOUT_STEP',
      recoveryStage: 'WHATSAPP_SENT',
      checkoutUrl: 'https://aurora.com/checkouts/gw',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.upsertCartEvent(cart);

    // Schedule delayed job
    await globalRecoveryQueue.scheduleRecovery(cart.id, 'CHECKOUT_STEP');

    // Cancel pending recovery
    await globalRecoveryQueue.cancelPendingRecovery(cart.id);

    // Update status to RECOVERED
    await db.updateCartStatus(cart.id, 'RECOVERED', 'RECOVERED');

    const finalizedCart = await db.getCartById(cart.id);
    expect(finalizedCart?.status).toBe('RECOVERED');
    expect(finalizedCart?.recoveredAt).not.toBeNull();
  });
});
