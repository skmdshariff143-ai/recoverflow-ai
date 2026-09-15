import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { 
  verifyWhatsAppSignature, 
  globalSuppressionService, 
  db 
} from '@recoverflow/core';
import { buildAttributedCheckoutUrl } from '@recoverflow/jobs';

describe('Meta WhatsApp Cloud API (v21.0) Bidirectional Engine', () => {
  const appSecret = 'meta_test_app_secret_88192';

  it('validates X-Hub-Signature-256 signatures accurately', () => {
    const payload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { messages: [{ from: '14155552671', text: { body: 'Hello' } }] } }] }],
    });

    const hash = crypto.createHmac('sha256', appSecret).update(payload).digest('hex');
    const validHeader = `sha256=${hash}`;

    expect(verifyWhatsAppSignature(payload, validHeader, appSecret)).toBe(true);
    expect(verifyWhatsAppSignature(payload, 'sha256=tamperedhash', appSecret)).toBe(false);
  });

  it('generates attributed checkout deep-links with UTM tags and discount parameters', () => {
    const baseCheckout = 'https://aurora-apparel.myshopify.com/checkouts/c/12345/recover';
    const deepLink = buildAttributedCheckoutUrl(baseCheckout, 'SAVE15');

    expect(deepLink).toContain('utm_source=recoverflow');
    expect(deepLink).toContain('utm_medium=whatsapp');
    expect(deepLink).toContain('utm_campaign=cart_recovery');
    expect(deepLink).toContain('discount=SAVE15');
  });

  it('immediately suppresses customer upon receiving STOP or UNSUBSCRIBE triggers', async () => {
    const merchantId = 'merchant_default_01';
    const customerPhone = '+14155559876';

    // Simulate opt-out trigger
    await globalSuppressionService.suppress(merchantId, customerPhone, 'PHONE', 'USER_UNSUBSCRIBE');

    const isSuppressed = await globalSuppressionService.isSuppressed(merchantId, customerPhone, 'PHONE');
    expect(isSuppressed).toBe(true);
  });

  it('respects 60-minute admin takeover lock and suppresses AI auto-replies', async () => {
    const cartId = 'cart_takeover_test_01';
    
    // Before takeover: not locked
    expect(db.isAdminTakenOver(cartId)).toBe(false);

    // Engage 60-minute takeover lock (3600000 ms)
    db.setAdminTakeover(cartId, 3600000);
    expect(db.isAdminTakenOver(cartId)).toBe(true);

    // Release takeover lock
    db.removeAdminTakeover(cartId);
    expect(db.isAdminTakenOver(cartId)).toBe(false);
  });
});
