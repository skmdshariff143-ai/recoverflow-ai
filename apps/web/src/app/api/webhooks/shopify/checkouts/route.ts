import { NextRequest, NextResponse } from 'next/server';
import {
  verifyShopifyHmac,
  globalIdempotency,
  globalSuppressionService,
  db,
  type CartEvent,
  type CartItem,
  type AbandonmentType,
} from '@recoverflow/core';
import { globalRecoveryQueue } from '@recoverflow/jobs';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256');
    const storeDomain = req.headers.get('x-shopify-shop-domain') || 'aurora-apparel.myshopify.com';

    // Retrieve merchant
    const merchant =
      (await db.getMerchantByStoreUrl(`https://${storeDomain}`)) ||
      (await db.getMerchant('merchant_default_01'));

    if (!merchant) {
      return NextResponse.json({ error: 'Merchant not registered' }, { status: 404 });
    }

    // Verify HMAC
    const isAuthentic = verifyShopifyHmac(rawBody, hmacHeader, merchant.webhookSecret);
    const allowBypassForDemo = process.env.NODE_ENV !== 'production' && req.headers.get('x-recoverflow-sim') === 'true';

    if (!isAuthentic && !allowBypassForDemo) {
      return NextResponse.json({ error: 'Invalid HMAC signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const cartToken = payload.token || payload.cart_token || `shpfy_${Date.now()}`;

    // Idempotency check
    const idempotencyKey = `shopify:checkout:${cartToken}:${payload.updated_at || 'initial'}`;
    const acquired = await globalIdempotency.acquire(idempotencyKey, 86400);

    if (!acquired) {
      return NextResponse.json(
        { status: 'ignored', reason: 'Duplicate event already in flight' },
        { status: 200 }
      );
    }

    // Determine Abandonment Type
    let abandonmentType: AbandonmentType = 'CHECKOUT_STEP';
    if (payload.payment_gateway_names?.length === 0 || payload.gateway === 'failed' || payload.error_code) {
      abandonmentType = 'PAYMENT_FAILED';
    }

    // Parse items
    const items: CartItem[] = (payload.line_items || []).map((li: Record<string, unknown>, idx: number) => ({
      id: String(li.id || `item_${idx}`),
      title: (li.title as string) || 'Product',
      variantTitle: li.variant_title as string | undefined,
      price: parseFloat(String(li.price || '0')),
      quantity: Number(li.quantity || 1),
      imageUrl: (li.image_url as string) || 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400',
      productUrl: li.product_id ? `${merchant.storeUrl}/products/${li.product_id}` : merchant.storeUrl,
    }));

    const customerPhone = payload.customer?.phone || payload.phone || payload.shipping_address?.phone;
    const customerEmail = payload.customer?.email || payload.email;
    const customerName = payload.customer
      ? `${payload.customer.first_name || ''} ${payload.customer.last_name || ''}`.trim()
      : undefined;

    // Suppression list check
    if (customerPhone) {
      const isSuppressed = await globalSuppressionService.isSuppressed(merchant.id, customerPhone, 'PHONE');
      if (isSuppressed) {
        return NextResponse.json(
          { status: 'suppressed', reason: 'Customer phone opted-out' },
          { status: 200 }
        );
      }
    }

    const cartEvent: CartEvent = {
      id: `cart_evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      cartToken,
      merchantId: merchant.id,
      customerPhone,
      customerEmail,
      customerName: customerName || 'Valued Shopper',
      currency: payload.currency || 'USD',
      totalPrice: parseFloat(payload.total_price || '0') || 150.0,
      items: items.length > 0 ? items : [
        {
          id: 'item_sample',
          title: 'Signature Atelier Collection Item',
          price: parseFloat(payload.total_price || '150'),
          quantity: 1,
        },
      ],
      status: 'ABANDONED',
      abandonmentType,
      recoveryStage: 'QUEUED',
      checkoutUrl: payload.abandoned_checkout_url || `${merchant.storeUrl}/checkouts/c/${cartToken}/recover`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.upsertCartEvent(cartEvent);

    // Schedule recovery job
    const scheduled = await globalRecoveryQueue.scheduleRecovery(
      cartEvent.id,
      abandonmentType,
      allowBypassForDemo ? 100 : undefined // Immediate execution for demo simulation
    );

    return NextResponse.json({
      status: 'queued',
      cartEventId: cartEvent.id,
      abandonmentType,
      scheduledDelayMs: scheduled.delayMs,
    });
  } catch (err: unknown) {
    console.error('Shopify checkout webhook error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
