import { describe, it, expect } from 'vitest';
import {
  detectLanguageAndCodeSwitching,
  generateDeterministicConciergeReply,
  type ConciergeAgentInput,
} from '../../packages/agents/src/concierge-agent';
import type { CartEvent, Merchant } from '@recoverflow/core';

describe('Polyglot Code-Switching Engine (Track 2)', () => {
  const mockMerchant: Merchant = {
    id: 'merchant_polyglot_01',
    storeUrl: 'https://aurora-luxury.myshopify.com',
    storeName: 'Aurora Luxury',
    webhookSecret: 'sec_test_123',
    brandToneGuidelines: 'Sophisticated, warm, concise, highlighting craftsmanship and customer care.',
    brandVoiceCasualVsFormal: 0.5,
    brandVoiceUrgencyVsGentle: 0.4,
    discountCeilingPercentage: 15.0,
    minMarginPercentage: 20.0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCart: CartEvent = {
    id: 'cart_polyglot_01',
    cartToken: 'tok_polyglot_991',
    merchantId: mockMerchant.id,
    customerPhone: '+919876543210',
    currency: 'USD',
    totalPrice: 220.0,
    items: [
      {
        id: 'item_1',
        title: 'Silk Cashmere Cardigan',
        price: 220.0,
        quantity: 1,
      },
    ],
    status: 'ABANDONED',
    abandonmentType: 'CHECKOUT_STEP',
    recoveryStage: 'QUEUED',
    checkoutUrl: 'https://aurora-luxury.myshopify.com/checkouts/c/tok_polyglot_991/recover',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('detectLanguageAndCodeSwitching Heuristic', () => {
    it('detects pure English correctly', () => {
      const result = detectLanguageAndCodeSwitching('Is this cardigan available in size M?');
      expect(result.primaryLanguage).toBe('en');
      expect(result.isCodeSwitching).toBe(false);
      expect(result.detectedDialects).toContain('English');
    });

    it('detects Hinglish code-switching (Hindi + English)', () => {
      const result = detectLanguageAndCodeSwitching('Bhai ye cardigan pe koi discount coupon milega kya please?');
      expect(result.primaryLanguage).toBe('hi');
      expect(result.isCodeSwitching).toBe(true);
      expect(result.detectedDialects.some((d) => d.includes('Hindi'))).toBe(true);
      expect(result.linguisticGuidance).toContain('Hinglish');
    });

    it('detects Telugish code-switching (Telugu + English)', () => {
      const result = detectLanguageAndCodeSwitching('Bro ee silk cardigan size fit bagundi unda? Rate taggiste order chestha.');
      expect(result.primaryLanguage).toBe('te');
      expect(result.isCodeSwitching).toBe(true);
      expect(result.detectedDialects.some((d) => d.includes('Telugu'))).toBe(true);
      expect(result.linguisticGuidance).toContain('Telugish');
    });

    it('detects Spanish inquiries', () => {
      const result = detectLanguageAndCodeSwitching('Hola amigo, ¿tienen algún descuento para este producto?');
      expect(result.primaryLanguage).toBe('es');
      expect(result.detectedDialects).toContain('Spanish');
    });

    it('detects native Devanagari Hindi script', () => {
      const result = detectLanguageAndCodeSwitching('नमस्ते, क्या इस ड्रेस पर कोई डिस्काउंट उपलब्ध है?');
      expect(result.primaryLanguage).toBe('hi');
      expect(result.detectedDialects).toContain('Hindi (Devanagari)');
    });

    it('detects native Telugu script', () => {
      const result = detectLanguageAndCodeSwitching('నమస్కారం, ఈ ప్రాడక్ట్ డెలివరీ ఎప్పుడు వస్తుంది?');
      expect(result.primaryLanguage).toBe('te');
      expect(result.detectedDialects).toContain('Telugu (Native Script)');
    });
  });

  describe('generateDeterministicConciergeReply with Code-Switching Tone', () => {
    it('responds in Hinglish when customer inquires about discount in Hinglish', () => {
      const input: ConciergeAgentInput = {
        incomingMessage: 'Bhai koi extra discount milega kya ispe?',
        cart: mockCart,
        merchant: mockMerchant,
      };

      const result = generateDeterministicConciergeReply(input);
      expect(result.intentDetected).toBe('DISCOUNT_NEGOTIATION');
      expect(result.discountOffered).toBe('EXCLUSIVE15');
      expect(result.reply).toContain('Aapke order par hum best authorized 15% discount');
    });

    it('responds in Telugish when customer inquires about sizing in Telugish', () => {
      const input: ConciergeAgentInput = {
        incomingMessage: 'Bro size fit ela untundi cardigan ki?',
        cart: mockCart,
        merchant: mockMerchant,
      };

      const result = generateDeterministicConciergeReply(input);
      expect(result.intentDetected).toBe('SIZING_INQUIRY');
      expect(result.reply).toContain('standard perfect fit untundi bro');
    });

    it('responds in Spanish when customer negotiates in Spanish', () => {
      const input: ConciergeAgentInput = {
        incomingMessage: 'Hola, tienen algún descuento para mi carrito?',
        cart: mockCart,
        merchant: mockMerchant,
      };

      const result = generateDeterministicConciergeReply(input);
      expect(result.intentDetected).toBe('DISCOUNT_NEGOTIATION');
      expect(result.reply).toContain('¡Nos encantaría ayudarte! El mejor descuento');
    });
  });
});
