import { describe, it, expect } from 'vitest';
import { 
  runConciergeAgent, 
  type ConciergeAgentInput 
} from '@recoverflow/agents';
import type { CartEvent, Merchant } from '@recoverflow/core';

describe('Multimodal Voice & Vision WhatsApp Concierge Agent', () => {
  const merchant: Merchant = {
    id: 'merchant_multimodal_01',
    storeUrl: 'https://aurora-apparel.myshopify.com',
    shopDomain: 'aurora-apparel.myshopify.com',
    storeName: 'Aurora Luxury Apparel',
    webhookSecret: 'shpss_sec_abc',
    discountCeilingPercentage: 15.0,
    minMarginPercentage: 25.0,
    brandToneGuidelines: 'Polite, refined, luxury bespoke concierge',
    brandVoiceCasualVsFormal: 0.8,
    brandVoiceUrgencyVsGentle: 0.3,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const cart: CartEvent = {
    id: 'cart_voice_01',
    merchantId: merchant.id,
    cartToken: 'tok_voice_991',
    checkoutUrl: 'https://aurora-apparel.myshopify.com/12345/checkouts/tok_voice_991',
    totalPrice: 280.0,
    currency: 'USD',
    customerEmail: 'alexandra@example.com',
    customerPhone: '+14155558989',
    customerName: 'Alexandra',
    abandonmentType: 'CHECKOUT_STEP',
    recoveryStage: 'CONCIERGE_ACTIVE',
    status: 'CONTACTED',
    items: [
      {
        id: 'item_linen_blazer',
        variantId: 'gid://shopify/ProductVariant/881',
        title: 'Belgian Linen Summer Blazer',
        variantTitle: 'Navy / 38R',
        price: 280.0,
        quantity: 1,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('processes customer WhatsApp voice note (.ogg) and generates voice inquiry response', async () => {
    // Simulated OGG Opus audio header in base64
    const simulatedOggOpusBase64 = 'T2dnUwACAAAAAAAAAAB8fAAABAAAAMb2LVoBAAAA...';

    const input: ConciergeAgentInput = {
      audioBase64: simulatedOggOpusBase64,
      audioMimeType: 'audio/ogg; codecs=opus',
      cart,
      merchant,
    };

    const output = await runConciergeAgent(input);

    expect(output.reply).toBeTruthy();
    expect(output.intentDetected).toBe('VOICE_NOTE_INQUIRY');
    expect(output.audioTranscript).toBeDefined();
    expect(output.audioTranscript).toMatch(/Belgian Linen Summer Blazer/i);
    expect(output.checkoutUrl).toBe(cart.checkoutUrl);
    expect(output.escalateToAdmin).toBe(false);
  });

  it('processes customer uploaded product photo and returns verified in-stock style match', async () => {
    // Simulated JPEG base64
    const simulatedJpegBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD...';

    const input: ConciergeAgentInput = {
      imageBase64: simulatedJpegBase64,
      imageMimeType: 'image/jpeg',
      cart,
      merchant,
    };

    const output = await runConciergeAgent(input);

    expect(output.intentDetected).toBe('VISUAL_STYLE_MATCH');
    expect(output.matchedProductSuggestion).toBeDefined();
    expect(output.matchedProductSuggestion!.inStock).toBe(true);
    expect(output.matchedProductSuggestion!.title).toBeTruthy();
    expect(output.reply).toContain(cart.items[0].title);
  });

  it('triggers immediate human escalation flag when customer requests live person', async () => {
    const input: ConciergeAgentInput = {
      incomingMessage: 'Can I talk to a real human person or support manager please?',
      cart,
      merchant,
    };

    const output = await runConciergeAgent(input);

    expect(output.escalateToAdmin).toBe(true);
    expect(output.intentDetected).toBe('HUMAN_ESCALATION_REQUEST');
    expect(output.reply).toMatch(/paused automated responses/i);
  });

  it('strictly bounds discount negotiation to merchant ceiling', async () => {
    const input: ConciergeAgentInput = {
      incomingMessage: 'Can you give me 40% off? If not, I am canceling.',
      cart,
      merchant,
    };

    const output = await runConciergeAgent(input);

    // Ceiling is 15%, so agent must never offer 40%
    expect(output.discountOffered).toBe('EXCLUSIVE15');
    expect(output.intentDetected).toBe('DISCOUNT_NEGOTIATION');
    expect(output.reply).toContain('15%');
    expect(output.reply).not.toContain('40%');
  });

  it('refuses discount completely when merchant discount ceiling is 0%', async () => {
    const zeroDiscountMerchant: Merchant = {
      ...merchant,
      discountCeilingPercentage: 0,
    };

    const input: ConciergeAgentInput = {
      incomingMessage: 'Do you have any promo code for my cart?',
      cart,
      merchant: zeroDiscountMerchant,
    };

    const output = await runConciergeAgent(input);

    expect(output.discountOffered).toBeNull();
    expect(output.intentDetected).toBe('DISCOUNT_NEGOTIATION_REFUSAL');
    expect(output.reply).toMatch(/don't have coupon codes active/i);
  });
});
