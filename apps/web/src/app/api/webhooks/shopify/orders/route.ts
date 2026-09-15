import { NextRequest, NextResponse } from 'next/server';
import { verifyShopifyHmac, db, globalIdempotency } from '@recoverflow/core';
import { globalRecoveryQueue } from '@recoverflow/jobs';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256');
    const shopDomain = req.headers.get('x-shopify-shop-domain') || '';

    const merchant =
      (await db.getMerchantByShopDomain(shopDomain)) ||
      (await db.getMerchant('merchant_default_01'));

    if (!merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    const isValid = verifyShopifyHmac(rawBody, hmacHeader, merchant.webhookSecret);
    const allowBypassForDemo = process.env.NODE_ENV !== 'production' && req.headers.get('x-recoverflow-sim') === 'true';

    if (!isValid && !allowBypassForDemo) {
      return NextResponse.json({ error: 'Invalid HMAC signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const orderId = String(payload.id || payload.order_number || Date.now());
    const cartToken = payload.cart_token || payload.checkout_token;
    const customerEmail = payload.email || payload.customer?.email;
    const customerPhone = payload.phone || payload.customer?.phone;
    const totalPrice = parseFloat(payload.total_price || '0');

    // Idempotency check
    const idempotencyKey = `shopify:order:${orderId}`;
    const acquired = await globalIdempotency.acquire(idempotencyKey, 86400);
    if (!acquired) {
      return NextResponse.json({ status: 'ignored', reason: 'Order already processed' }, { status: 200 });
    }

    // Match existing cart event
    let matchedCart = null;
    if (cartToken) {
      matchedCart = await db.getCartByToken(cartToken);
    }
    if (!matchedCart && customerEmail) {
      matchedCart = await db.findCartByCustomerOrToken(customerEmail);
    }
    if (!matchedCart && customerPhone) {
      matchedCart = await db.findCartByCustomerOrToken(customerPhone);
    }

    if (matchedCart) {
      // Cancel pending recovery jobs in queue
      await globalRecoveryQueue.cancelPendingRecovery(matchedCart.id);

      // Attribute recovery and update cart status
      await db.updateCartStatus(matchedCart.id, 'RECOVERED', 'RECOVERED');

      console.log(`[Order Rehydrated & Attributed] Cart ${matchedCart.id} recovered! GMV: $${totalPrice || matchedCart.totalPrice}`);

      return NextResponse.json({
        status: 'rehydrated_and_recovered',
        orderId,
        cartId: matchedCart.id,
        recoveredGmv: totalPrice || matchedCart.totalPrice,
      }, { status: 200 });
    }

    return NextResponse.json({
      status: 'order_recorded_no_cart_match',
      orderId,
    }, { status: 200 });
  } catch (err: unknown) {
    console.error('Shopify order webhook error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Order processing error' },
      { status: 500 }
    );
  }
}
