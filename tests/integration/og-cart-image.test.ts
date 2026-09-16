import { describe, it, expect } from 'vitest';
import { buildResponsiveCartEmailHtml, sendCartRecoveryEmail } from '@recoverflow/jobs';

describe('Edge-Computed Dynamic OG Cart Personalization & Email Integration', () => {
  it('embeds properly encoded dynamic OG cart preview image URL inside Resend HTML email', () => {
    const html = buildResponsiveCartEmailHtml({
      to: 'elena.rostova@example.com',
      customerName: 'Elena Rostova',
      storeName: 'Velvet & Oak',
      items: [
        {
          id: 'item_1',
          title: 'Italian Leather Handbag',
          price: 495.0,
          quantity: 1,
          imageUrl: 'https://images.unsplash.com/photo-bag',
        },
      ],
      totalPrice: 495.0,
      currency: 'USD',
      checkoutUrl: 'https://velvetandoak.com/checkouts/tok_elena_123',
      discountCode: 'WELCOME10',
    });

    expect(html).toContain('/api/og/cart?');
    expect(html).toContain('title=Italian%20Leather%20Handbag');
    expect(html).toContain('customer=Elena');
    expect(html).toContain('store=Velvet%20%26%20Oak');
    expect(html).toContain('total=USD%20495.00');
    expect(html).toContain('discount=WELCOME10');
    expect(html).toContain('alt="Cart Summary"');
  });

  it('dispatches email with embedded OG cart card in simulation mode', async () => {
    const result = await sendCartRecoveryEmail({
      to: 'test.shopper@example.com',
      customerName: 'Marcus Aurelius',
      storeName: 'Stoic Editions',
      items: [{ id: 'item_stoic_1', title: 'Meditations Folio', price: 120.0, quantity: 1 }],
      totalPrice: 120.0,
      currency: 'USD',
      checkoutUrl: 'https://stoic.com/pay/123',
      apiKey: 're_test_mock_key',
    });

    expect(result.success).toBe(true);
    expect(result.simulated).toBe(true);
    expect(result.emailId).toMatch(/^email_mock_/);
    expect(result.htmlPreview).toContain('/api/og/cart?');
  });
});
