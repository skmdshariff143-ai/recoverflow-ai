import { NextRequest, NextResponse } from 'next/server';
import {
  verifyShopifyHmac,
  globalIdempotency,
  db,
  type FulfillmentRecord,
  type FulfillmentTransitStatus,
  type OrderRecord,
} from '@recoverflow/core';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256');
    const storeDomain = req.headers.get('x-shopify-shop-domain') || 'aurora-apparel.myshopify.com';

    // Retrieve merchant
    const merchant =
      (await db.getMerchantByStoreUrl(`https://${storeDomain}`)) ||
      (await db.getMerchantByShopDomain(storeDomain)) ||
      (await db.getMerchant('merchant_default_01'));

    if (!merchant) {
      return NextResponse.json({ error: 'Merchant not registered' }, { status: 404 });
    }

    // Verify HMAC signature
    const isAuthentic = verifyShopifyHmac(rawBody, hmacHeader, merchant.webhookSecret);
    const allowBypassForDemo =
      process.env.NODE_ENV !== 'production' &&
      (req.headers.get('x-recoverflow-sim') === 'true' || req.headers.get('x-test-bypass') === 'true');

    if (!isAuthentic && !allowBypassForDemo) {
      return NextResponse.json({ error: 'Invalid HMAC signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const fulfillmentId = String(payload.id || `ful_${Date.now()}`);
    const orderId = String(payload.order_id || payload.orderId || `ord_${Date.now()}`);
    const updatedAt = payload.updated_at || new Date().toISOString();

    // Idempotency check
    const idempotencyKey = `shopify:fulfillment:${fulfillmentId}:${updatedAt}`;
    const acquired = await globalIdempotency.acquire(idempotencyKey, 86400);

    if (!acquired) {
      return NextResponse.json(
        { status: 'ignored', reason: 'Duplicate fulfillment event already processed' },
        { status: 200 }
      );
    }

    // Normalize shipment status
    const rawStatus = (payload.shipment_status || payload.status || 'in_transit').toLowerCase();
    let transitStatus: FulfillmentTransitStatus = 'IN_TRANSIT';

    if (rawStatus.includes('delivered') || rawStatus === 'success') {
      transitStatus = 'DELIVERED';
    } else if (rawStatus.includes('out_for_delivery') || rawStatus.includes('out for delivery')) {
      transitStatus = 'OUT_FOR_DELIVERY';
    } else if (rawStatus.includes('label') || rawStatus.includes('confirmed') || rawStatus.includes('info') || rawStatus === 'pending') {
      transitStatus = 'INFO_RECEIVED';
    } else if (rawStatus.includes('failure') || rawStatus.includes('exception') || rawStatus.includes('attempted')) {
      transitStatus = 'EXCEPTION';
    }

    const trackingCompany = payload.tracking_company || payload.carrier || 'Express Courier';
    const trackingNumber = payload.tracking_number || payload.tracking_numbers?.[0] || `TRK${Date.now().toString().slice(-8)}`;
    const trackingUrl =
      payload.tracking_url ||
      payload.tracking_urls?.[0] ||
      `https://track.recoverflow.ai/${trackingCompany.toLowerCase()}?trk=${trackingNumber}`;

    // Compute estimated delivery date (default +3 days from shipped if not provided)
    const shippedAt = payload.created_at ? new Date(payload.created_at) : new Date();
    const estimatedDeliveryAt = payload.estimated_delivery_at
      ? new Date(payload.estimated_delivery_at)
      : new Date(shippedAt.getTime() + 3 * 24 * 60 * 60 * 1000);

    // Persist or update Fulfillment
    const existingFulfillment = await db.getFulfillmentByShopifyId(fulfillmentId);
    const fulfillmentRecord: FulfillmentRecord = {
      id: existingFulfillment?.id || `ful_rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      orderId,
      merchantId: merchant.id,
      shopifyFulfillmentId: fulfillmentId,
      trackingCompany,
      trackingNumber,
      trackingUrl,
      status: transitStatus,
      estimatedDeliveryAt,
      shippedAt,
      deliveredAt: transitStatus === 'DELIVERED' ? new Date() : existingFulfillment?.deliveredAt || null,
      latestLocation: payload.destination?.city
        ? `${payload.destination.city}, ${payload.destination.province || payload.destination.country}`
        : payload.location || 'Regional Logistics Hub',
      createdAt: existingFulfillment?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    await db.createOrUpdateFulfillment(fulfillmentRecord);

    // If corresponding Order exists, update its fulfillment status
    let matchedOrder: OrderRecord | null = await db.getOrderByShopifyId(orderId);
    if (!matchedOrder) {
      // Auto-create order shell if payload includes line items or customer
      const customerEmail = payload.email || payload.customer?.email;
      const customerPhone = payload.phone || payload.customer?.phone;
      matchedOrder = {
        id: `ord_${orderId}`,
        merchantId: merchant.id,
        shopifyOrderId: orderId,
        orderNumber: payload.order_name || `#${orderId.slice(-4)}`,
        customerEmail,
        customerPhone,
        customerName: payload.customer ? `${payload.customer.first_name || ''} ${payload.customer.last_name || ''}`.trim() : undefined,
        currency: payload.currency || 'USD',
        totalPrice: parseFloat(payload.total_price || '0') || 100.0,
        financialStatus: 'PAID',
        fulfillmentStatus: transitStatus === 'DELIVERED' ? 'FULFILLED' : 'PARTIALLY_FULFILLED',
        items: (payload.line_items || []).map((li: Record<string, unknown>, idx: number) => ({
          id: String(li.id || `item_${idx}`),
          title: (li.title as string) || 'Ordered Item',
          price: parseFloat(String(li.price || '50')),
          quantity: Number(li.quantity || 1),
        })),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.createOrUpdateOrder(matchedOrder);
    } else {
      matchedOrder.fulfillmentStatus = transitStatus === 'DELIVERED' ? 'FULFILLED' : 'PARTIALLY_FULFILLED';
      matchedOrder.updatedAt = new Date();
      await db.createOrUpdateOrder(matchedOrder);
    }

    return NextResponse.json({
      status: 'processed',
      fulfillmentId,
      orderId,
      transitStatus,
      trackingNumber,
      estimatedDeliveryAt: estimatedDeliveryAt.toISOString(),
    });
  } catch (err: unknown) {
    console.error('Shopify fulfillments webhook error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal fulfillment error' },
      { status: 500 }
    );
  }
}
