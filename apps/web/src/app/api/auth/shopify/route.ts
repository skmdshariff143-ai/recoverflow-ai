import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { globalIdempotency } from '@recoverflow/core';

export const SHOPIFY_SCOPES = [
  'read_checkouts',
  'read_orders',
  'write_discounts',
  'read_products',
  'read_inventory',
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawShop = searchParams.get('shop');

  if (!rawShop) {
    return NextResponse.json({ error: 'Missing required "shop" parameter' }, { status: 400 });
  }

  // Sanitize and validate myshopify.com domain regex
  const shop = rawShop.trim().toLowerCase();
  const shopRegex = /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/;
  if (!shopRegex.test(shop)) {
    return NextResponse.json({ error: 'Invalid Shopify domain format' }, { status: 400 });
  }

  const clientId = process.env.SHOPIFY_API_KEY || 'rf_shopify_client_id_mock';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/auth/shopify/callback`;

  // Generate secure cryptographic state nonce
  const stateNonce = crypto.randomBytes(16).toString('hex');
  const stateKey = `shopify:oauth:state:${shop}:${stateNonce}`;

  // Store in Redis / memory idempotency manager with 10-minute (600s) TTL
  await globalIdempotency.acquire(stateKey, 600);

  const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('scope', SHOPIFY_SCOPES.join(','));
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', stateNonce);

  // Return redirect to Shopify consent screen
  return NextResponse.redirect(authUrl.toString(), 302);
}
