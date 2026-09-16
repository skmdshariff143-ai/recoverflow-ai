import { describe, it, expect } from 'vitest';
import {
  isVipVoiceEligible,
  buildGeminiLiveVIPSystemPrompt,
  generateVIPVoiceTwiml,
  generate1TapSmsRescue,
  dispatchVipVoiceRescue,
} from '@recoverflow/agents';

describe('Twilio + Gemini Live WebRTC Voice Agent (VIP Rescue)', () => {
  it('correctly assesses VIP voice eligibility based on cart value and intent', () => {
    // Under threshold -> False
    expect(isVipVoiceEligible(999, 'PAYMENT_FAILED')).toBe(false);
    expect(isVipVoiceEligible(500, 'PAYMENT_FAILED')).toBe(false);

    // Over $1,000 and payment failed -> True
    expect(isVipVoiceEligible(1000, 'PAYMENT_FAILED')).toBe(true);
    expect(isVipVoiceEligible(2500, 'PAYMENT_FAILED')).toBe(true);
    expect(isVipVoiceEligible(1500, 'CHECKOUT_ABANDONED')).toBe(true);

    // Non-payment low-intent drop (e.g. browsing drop) -> False
    expect(isVipVoiceEligible(1500, 'CART_EXPIRED')).toBe(false);
  });

  it('builds a high-empathy, guardrailed Gemini Live system prompt', () => {
    const prompt = buildGeminiLiveVIPSystemPrompt({
      cartId: 'cart_123',
      cartToken: 'tok_456',
      customerName: 'Victoria Beckham',
      customerPhone: '+15558889999',
      totalPrice: 1850.0,
      currency: 'USD',
      items: [{ title: 'Silk Trench Coat', price: 1850.0, quantity: 1 }],
      storeName: 'Maison Luxe',
      checkoutUrl: 'https://maisonluxe.com/checkouts/tok_456',
      discountCeilingPercentage: 12,
    });

    expect(prompt).toContain('Victoria');
    expect(prompt).toContain('Maison Luxe');
    expect(prompt).toContain('Silk Trench Coat');
    expect(prompt).toContain('1850.00');
    expect(prompt).toContain('discount exceeding 12%');
    expect(prompt).toContain('Zero Hallucination');
    expect(prompt).toContain('Direct SMS Checkout');
  });

  it('generates valid TwiML XML with WebRTC Stream element and custom parameters', () => {
    const twiml = generateVIPVoiceTwiml({
      cartId: 'cart_999',
      cartToken: 'tok_vip_999',
      customerName: 'Marcus Aurelius',
      totalPrice: 2400.0,
      currency: 'EUR',
      items: [{ title: 'Sculpture Edition', price: 2400.0, quantity: 1 }],
      storeName: 'Imperial Artistry',
      checkoutUrl: 'https://artistry.com/pay/tok_vip_999',
    });

    expect(twiml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(twiml).toContain('<Response>');
    expect(twiml).toContain('<Say voice="Polly.Joanna-Neural" language="en-US">');
    expect(twiml).toContain('Marcus');
    expect(twiml).toContain('Imperial Artistry');
    expect(twiml).toContain('<Connect>');
    expect(twiml).toContain('<Stream url="wss://recoverflow-ai-kohl.vercel.app/api/voice/media-stream">');
    expect(twiml).toContain('<Parameter name="cartId" value="cart_999" />');
    expect(twiml).toContain('<Parameter name="totalPrice" value="2400" />');
    expect(twiml).toContain('</Connect>');
    expect(twiml).toContain('</Response>');
  });

  it('generates a clean 1-tap SMS rescue checkout link', () => {
    const sms = generate1TapSmsRescue(
      {
        cartId: 'cart_888',
        cartToken: 'tok_888',
        customerName: 'Alexander Hamilton',
        totalPrice: 1200.0,
        currency: 'USD',
        items: [{ title: 'Federalist Watch', price: 1200.0, quantity: 1 }],
        storeName: 'Liberty Horology',
        checkoutUrl: 'https://liberty.com/c/tok_888',
      },
      'VIPRESCUE15'
    );

    expect(sms).toContain('Hi Alexander');
    expect(sms).toContain('Liberty Horology VIP Concierge');
    expect(sms).toContain('https://liberty.com/c/tok_888');
    expect(sms).toContain('Use code VIPRESCUE15 at checkout.');
  });

  it('handles simulated Twilio voice outreach when credentials are in mock mode', async () => {
    const result = await dispatchVipVoiceRescue({
      context: {
        cartId: 'cart_sim_01',
        cartToken: 'tok_sim_01',
        customerName: 'Eleanor Roosevelt',
        customerPhone: '+15552345678',
        totalPrice: 1500.0,
        currency: 'USD',
        items: [{ title: 'Diplomat Pen', price: 1500.0, quantity: 1 }],
        storeName: 'Grand Archive',
        checkoutUrl: 'https://archive.com/c/123',
      },
      twilioAccountSid: 'AC_test_fake_sid',
      twilioAuthToken: 'test_token',
    });

    expect(result.success).toBe(true);
    expect(result.simulated).toBe(true);
    expect(result.callSid).toMatch(/^CA_mock_/);
    expect(result.smsRescueDispatched).toBe(true);
    expect(result.twiml).toContain('Eleanor');
  });
});
