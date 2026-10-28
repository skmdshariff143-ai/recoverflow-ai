import { describe, it, expect, afterEach, vi } from 'vitest';
import { buildResponsiveCartEmailHtml, sendWhatsAppMessage } from '@recoverflow/jobs';
import { normalizePhone } from '@recoverflow/core';

describe('Pre-launch Security & Functional Invariant Fixes', () => {
  describe('1. Cart Recovery Email HTML Injection Mitigation', () => {
    it('escapes script tags, quotes, and malicious markup in item titles and customer names', () => {
      const html = buildResponsiveCartEmailHtml({
        to: 'victim@example.com',
        customerName: '<script>alert("pwned")</script> Elena',
        storeName: 'Velvet & "Oak" <Store>',
        items: [
          {
            id: 'item_xss',
            title: '<img src=x onerror=alert(1)> Luxury Silk Scarf',
            variantTitle: '<b>Gold Edition</b>',
            price: 150.0,
            quantity: 1,
            imageUrl: 'https://images.unsplash.com/photo-bag?test="><script>',
          },
        ],
        totalPrice: 150.0,
        currency: 'USD',
        checkoutUrl: 'https://store.test/checkout',
        discountCode: '<evil>&"code"',
        messageBody: '<style>body{display:none}</style>Special courtesy note.',
      });

      // Assert malicious tags are neutralized into safe HTML entities
      expect(html).not.toContain('<script>alert("pwned")</script>');
      expect(html).toContain('&lt;script&gt;alert(&quot;pwned&quot;)&lt;/script&gt;');

      expect(html).not.toContain('<img src=x onerror=alert(1)>');
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');

      expect(html).not.toContain('<b>Gold Edition</b>');
      expect(html).toContain('&lt;b&gt;Gold Edition&lt;/b&gt;');

      expect(html).not.toContain('<evil>&"code"');
      expect(html).toContain('&lt;evil&gt;&amp;&quot;code&quot;');

      expect(html).not.toContain('<style>body{display:none}</style>');
      expect(html).toContain('&lt;style&gt;body{display:none}&lt;/style&gt;');
    });
  });

  describe('2. WhatsApp Outbound Fail-Closed Invariant in LIVE/SANDBOX Mode', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('fails closed when WhatsApp credentials are unset in LIVE mode', async () => {
      vi.stubEnv('RECOVERFLOW_RUNTIME_MODE', 'LIVE');
      delete process.env.WHATSAPP_API_TOKEN;
      delete process.env.WHATSAPP_PHONE_NUMBER_ID;

      const result = await sendWhatsAppMessage({
        to: '+919876543210',
        bodyText: 'Payment failed follow up',
      });

      expect(result.success).toBe(false);
      expect(result.simulated).toBeUndefined();
      expect(result.error).toContain('CREDENTIALS_UNCONFIGURED');
    });

    it('fails closed when WhatsApp credentials are unset in SANDBOX mode', async () => {
      vi.stubEnv('RECOVERFLOW_RUNTIME_MODE', 'SANDBOX');
      delete process.env.WHATSAPP_API_TOKEN;
      delete process.env.WHATSAPP_PHONE_NUMBER_ID;

      const result = await sendWhatsAppMessage({
        to: '+919876543210',
        bodyText: 'Payment failed follow up',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('CREDENTIALS_UNCONFIGURED');
    });
  });

  describe('3. Phone Normalization Country Code Logic', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('formats 10-digit Indian numbers with +91 when currency is INR', () => {
      vi.stubEnv('MERCHANT_CURRENCY', 'INR');
      expect(normalizePhone('9876543210')).toBe('+919876543210');
    });

    it('formats 10-digit numbers with custom country code when supplied', () => {
      expect(normalizePhone('9876543210', '44')).toBe('+449876543210');
      expect(normalizePhone('9876543210', '+91')).toBe('+919876543210');
    });

    it('preserves existing E.164 plus prefix numbers', () => {
      expect(normalizePhone('+447911123456')).toBe('+447911123456');
    });
  });
});
