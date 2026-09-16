import { describe, it, expect } from 'vitest';
import { generateVIPVoiceTwiml } from '@recoverflow/agents';
import { db } from '@recoverflow/core';

describe('VIP Founder Voice Cloning Integration (Track 3)', () => {
  it('injects customVoiceId into TwiML <Say voice="..."> and stream parameters', () => {
    const twiml = generateVIPVoiceTwiml({
      cartId: 'cart_vc_01',
      cartToken: 'tok_vc_01',
      customerName: 'Claire Underwood',
      totalPrice: 1800.0,
      currency: 'USD',
      items: [{ title: 'Presidential Suite Bag', price: 1800.0, quantity: 1 }],
      storeName: 'Capitol Atelier',
      checkoutUrl: 'https://capitol.com/c/123',
      customVoiceId: 'voice_clone_capitol_founder_9981a',
    });

    expect(twiml).toContain('<Say voice="voice_clone_capitol_founder_9981a" language="en-US">');
    expect(twiml).toContain('<Parameter name="customVoiceId" value="voice_clone_capitol_founder_9981a" />');
  });

  it('falls back to Polly.Joanna-Neural when no custom voice is configured', () => {
    const twiml = generateVIPVoiceTwiml({
      cartId: 'cart_std_01',
      cartToken: 'tok_std_01',
      customerName: 'Francis',
      totalPrice: 1200.0,
      currency: 'USD',
      items: [{ title: 'Classic Blazer', price: 1200.0, quantity: 1 }],
      storeName: 'Heritage Store',
      checkoutUrl: 'https://heritage.com/c/123',
    });

    expect(twiml).toContain('<Say voice="Polly.Joanna-Neural" language="en-US">');
    expect(twiml).not.toContain('<Parameter name="customVoiceId"');
  });

  it('updates merchant database record with newly registered customVoiceId', async () => {
    const merchantId = `merch_vc_test_${Date.now()}`;
    await db.upsertMerchant({
      id: merchantId,
      storeUrl: 'https://founder-atelier.com',
      storeName: 'Founder Atelier',
      webhookSecret: 'whsec_vc',
      brandToneGuidelines: 'Elite executive voice',
      brandVoiceCasualVsFormal: 0.9,
      brandVoiceUrgencyVsGentle: 0.2,
      discountCeilingPercentage: 10.0,
      minMarginPercentage: 30.0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const merchant = await db.getMerchant(merchantId);
    expect(merchant?.customVoiceId).toBeUndefined();

    // Set cloned voice ID
    merchant!.customVoiceId = 'voice_clone_founder_atelier_77a1b';
    await db.upsertMerchant(merchant!);

    const updated = await db.getMerchant(merchantId);
    expect(updated?.customVoiceId).toBe('voice_clone_founder_atelier_77a1b');
  });
});
