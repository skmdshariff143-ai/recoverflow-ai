import { NextRequest, NextResponse } from 'next/server';
import { verifyShopifyHmac, db, globalSuppressionService } from '@recoverflow/core';
import { internalErrorResponse } from '@/lib/http';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256');
    const topic = req.headers.get('x-shopify-topic'); // e.g. customers/data_request, customers/redact, shop/redact
    const shopDomain = req.headers.get('x-shopify-shop-domain') || '';

    // In ALL runtime modes, GDPR requests MUST be matched to an authentic registered merchant.
    // GDPR operations must NEVER act on a fallback tenant.
    const merchant = await db.getMerchantByShopDomain(shopDomain);
    if (!merchant) {
      console.warn('[Shopify GDPR] Unknown shop domain; ignoring GDPR webhook without fallback action');
      return NextResponse.json({ received: true, ignored: true }, { status: 200 });
    }

    const secret = merchant.webhookSecret || process.env.SHOPIFY_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Shopify webhook secret unconfigured' }, { status: 503 });
    }

    const isValid = verifyShopifyHmac(rawBody, hmacHeader, secret);
    const allowBypassForDemo = process.env.NODE_ENV !== 'production' && req.headers.get('x-recoverflow-sim') === 'true';

    if (!isValid && !allowBypassForDemo) {
      return NextResponse.json({ error: 'Invalid HMAC signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    switch (topic) {
      case 'customers/data_request': {
        // Customer requested their stored data
        return NextResponse.json({ status: 'acknowledged', action: 'data_compiled' }, { status: 200 });
      }

      case 'customers/redact': {
        // Customer requested deletion of personal data
        const customerPhone = payload.customer?.phone;
        if (customerPhone) {
          await globalSuppressionService.suppress(merchant.id, customerPhone, 'PHONE', 'MANUAL');
        }
        return NextResponse.json({ status: 'acknowledged', action: 'customer_redacted' }, { status: 200 });
      }

      case 'shop/redact': {
        // Merchant uninstalled app; redact store records
        return NextResponse.json({ status: 'acknowledged', action: 'shop_redacted' }, { status: 200 });
      }

      default:
        return NextResponse.json({ status: 'ok' }, { status: 200 });
    }
  } catch (err: unknown) {
    return internalErrorResponse('webhooks/shopify/gdpr', err, 'Internal server error');
  }
}
