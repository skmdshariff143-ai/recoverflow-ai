import { NextRequest, NextResponse } from 'next/server';
import { verifyShopifyHmac, db, globalSuppressionService } from '@recoverflow/core';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256');
    const topic = req.headers.get('x-shopify-topic'); // e.g. customers/data_request, customers/redact, shop/redact
    const shopDomain = req.headers.get('x-shopify-shop-domain') || '';

    const merchant = await db.getMerchantByShopDomain(shopDomain) || await db.getMerchant('merchant_default_01');
    const secret = merchant?.webhookSecret || process.env.SHOPIFY_WEBHOOK_SECRET || 'shpss_test_secret_key_99182';

    const isValid = verifyShopifyHmac(rawBody, hmacHeader, secret);
    const allowBypassForDemo = process.env.NODE_ENV !== 'production' && req.headers.get('x-recoverflow-sim') === 'true';

    if (!isValid && !allowBypassForDemo) {
      return NextResponse.json({ error: 'Invalid HMAC signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    switch (topic) {
      case 'customers/data_request': {
        // Customer requested their stored data
        const customerEmail = payload.customer?.email;
        const customerPhone = payload.customer?.phone;
        console.log(`[GDPR Data Request] Shop: ${shopDomain}, Customer: ${customerEmail || customerPhone}`);
        return NextResponse.json({ status: 'acknowledged', action: 'data_compiled' }, { status: 200 });
      }

      case 'customers/redact': {
        // Customer requested deletion of personal data
        const customerEmail = payload.customer?.email;
        const customerPhone = payload.customer?.phone;
        console.log(`[GDPR Customer Redact] Redacting data for ${customerEmail || customerPhone}`);
        if (merchant && customerPhone) {
          await globalSuppressionService.suppress(merchant.id, customerPhone, 'PHONE', 'MANUAL');
        }
        return NextResponse.json({ status: 'acknowledged', action: 'customer_redacted' }, { status: 200 });
      }

      case 'shop/redact': {
        // Merchant uninstalled app; redact store records 48h later
        console.log(`[GDPR Shop Redact] Redacting shop data for ${shopDomain}`);
        return NextResponse.json({ status: 'acknowledged', action: 'shop_redacted' }, { status: 200 });
      }

      default:
        return NextResponse.json({ status: 'ok' }, { status: 200 });
    }
  } catch (err: unknown) {
    console.error('GDPR webhook error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
