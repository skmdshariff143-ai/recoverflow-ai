import { describe, it, expect } from 'vitest';
import { 
  generateDeterministicRecoveryCopy, 
  generateDeterministicConciergeReply,
  buildRecoverySystemPrompt 
} from '@recoverflow/agents';
import type { CartEvent, Merchant } from '@recoverflow/core';

describe('AI Guardrails & Financial Margin Protection', () => {
  const mockMerchant: Merchant = {
    id: 'merch_test',
    storeUrl: 'https://aurora.com',
    storeName: 'Aurora Atelier',
    webhookSecret: 'sec_123',
    brandToneGuidelines: 'Refined and respectful',
    brandVoiceCasualVsFormal: 0.8,
    brandVoiceUrgencyVsGentle: 0.4,
    discountCeilingPercentage: 15.0, // Max 15%
    minMarginPercentage: 20.0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCart: CartEvent = {
    id: 'cart_test_1',
    cartToken: 'tok_1',
    merchantId: mockMerchant.id,
    customerName: 'Claire Beauchamp',
    customerPhone: '+14155551234',
    currency: 'USD',
    totalPrice: 250.0,
    items: [
      { id: 'item_1', title: 'Cashmere Wrap', price: 250, quantity: 1 }
    ],
    status: 'ABANDONED',
    abandonmentType: 'CHECKOUT_STEP',
    recoveryStage: 'QUEUED',
    checkoutUrl: 'https://aurora.com/checkouts/tok_1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('builds a zero-hallucination prompt containing exact cart items and links', () => {
    const prompt = buildRecoverySystemPrompt({
      customerName: mockCart.customerName,
      items: mockCart.items,
      totalValue: mockCart.totalPrice,
      currency: mockCart.currency,
      dropOffReason: mockCart.abandonmentType,
      checkoutUrl: mockCart.checkoutUrl,
      merchantTone: {
        brandName: mockMerchant.storeName,
        guidelines: mockMerchant.brandToneGuidelines,
        casualVsFormal: mockMerchant.brandVoiceCasualVsFormal,
        urgencyVsGentle: mockMerchant.brandVoiceUrgencyVsGentle,
        discountCeilingPercentage: mockMerchant.discountCeilingPercentage,
      },
    });

    expect(prompt).toContain('Cashmere Wrap');
    expect(prompt).toContain('USD 250.00');
    expect(prompt).toContain(mockCart.checkoutUrl);
    expect(prompt).toContain('Maximum Allowed Discount: 15%');
    expect(prompt).toContain('ZERO HALLUCINATIONS');
  });

  it('never offers discounts above merchant ceiling in recovery copy', () => {
    const output = generateDeterministicRecoveryCopy({
      customerName: mockCart.customerName,
      items: mockCart.items,
      totalValue: mockCart.totalPrice,
      currency: mockCart.currency,
      dropOffReason: mockCart.abandonmentType,
      checkoutUrl: mockCart.checkoutUrl,
      merchantTone: {
        brandName: mockMerchant.storeName,
        guidelines: mockMerchant.brandToneGuidelines,
        casualVsFormal: 0.8,
        urgencyVsGentle: 0.4,
        discountCeilingPercentage: 10, // 10% ceiling
      },
    });

    expect(output.suggestedDiscountCode).toBe('SAVE10');
  });

  it('offers zero discounts when merchant discount ceiling is 0%', () => {
    const output = generateDeterministicRecoveryCopy({
      customerName: mockCart.customerName,
      items: mockCart.items,
      totalValue: mockCart.totalPrice,
      currency: mockCart.currency,
      dropOffReason: mockCart.abandonmentType,
      checkoutUrl: mockCart.checkoutUrl,
      merchantTone: {
        brandName: mockMerchant.storeName,
        guidelines: mockMerchant.brandToneGuidelines,
        casualVsFormal: 0.8,
        urgencyVsGentle: 0.4,
        discountCeilingPercentage: 0, // Zero discount policy
      },
    });

    expect(output.suggestedDiscountCode).toBeNull();
  });

  it('concierge refuses customer request for 30% discount and enforces margin ceiling', () => {
    const reply = generateDeterministicConciergeReply({
      incomingMessage: 'Can you give me 30% off? Otherwise I will buy from a competitor.',
      cart: mockCart,
      merchant: mockMerchant, // ceiling is 15%
    });

    expect(reply.discountOffered).toBe('EXCLUSIVE15');
    expect(reply.reply).toContain('15%');
    expect(reply.reply).not.toContain('30%');
    expect(reply.escalateToAdmin).toBe(false);
  });

  it('concierge detects escalation triggers and alerts admin', () => {
    const reply = generateDeterministicConciergeReply({
      incomingMessage: 'I need to speak to a human manager immediately! This is ridiculous.',
      cart: mockCart,
      merchant: mockMerchant,
    });

    expect(reply.escalateToAdmin).toBe(true);
    expect(reply.intentDetected).toBe('HUMAN_ESCALATION_REQUEST');
    expect(reply.reply).toContain('paused automated responses');
  });
});
