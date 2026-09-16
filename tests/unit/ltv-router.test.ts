import { describe, it, expect } from 'vitest';
import { computePredictiveLtvScore, routeCartByLtv, type CartEvent } from '@recoverflow/core';

describe('Predictive LTV Routing Engine (Track 2)', () => {
  it('assigns VIP_IMMEDIATE tier (> 0.8) for high-value carts with payment failure', () => {
    const decision = computePredictiveLtvScore({
      totalPrice: 1450.0,
      currency: 'USD',
      itemCount: 2,
      abandonmentType: 'PAYMENT_FAILED',
      customerPhone: '+15551234567',
      customerEmail: 'vip@luxurybuyer.com',
      items: [{ title: 'Fine Leather Briefcase', price: 1450.0, quantity: 1 }],
      telemetry: {
        exitVelocityY: -1.2, // fast departure acceleration
      },
    });

    expect(decision.predictiveLtvScore).toBeGreaterThan(0.8);
    expect(decision.tier).toBe('VIP_IMMEDIATE');
    expect(decision.recommendedChannel).toBe('VOICE_AND_SMS');
    expect(decision.initialDelayMs).toBe(0);
    expect(decision.factors.valueFactor).toBeCloseTo(0.45, 1);
    expect(decision.factors.intentFactor).toBe(0.3);
  });

  it('assigns PRIORITY_MESSAGING tier (0.5 - 0.8) for moderate carts', () => {
    const decision = computePredictiveLtvScore({
      totalPrice: 350.0,
      currency: 'USD',
      itemCount: 1,
      abandonmentType: 'CHECKOUT_STEP',
      customerPhone: '+15559876543',
      customerEmail: 'shopper@example.com',
      items: [{ title: 'Running Shoes', price: 350.0, quantity: 1 }],
    });

    expect(decision.predictiveLtvScore).toBeGreaterThanOrEqual(0.5);
    expect(decision.predictiveLtvScore).toBeLessThanOrEqual(0.8);
    expect(decision.tier).toBe('PRIORITY_MESSAGING');
    expect(decision.recommendedChannel).toBe('WHATSAPP');
  });

  it('assigns STANDARD_CADENCE tier (< 0.5) for low-value initial cart drops', () => {
    const decision = computePredictiveLtvScore({
      totalPrice: 45.0,
      currency: 'USD',
      itemCount: 1,
      abandonmentType: 'CART_PAGE',
      customerEmail: 'casual@example.com',
      items: [{ title: 'Phone Case', price: 45.0, quantity: 1 }],
    });

    expect(decision.predictiveLtvScore).toBeLessThan(0.5);
    expect(decision.tier).toBe('STANDARD_CADENCE');
    expect(decision.initialDelayMs).toBe(30 * 60 * 1000);
  });

  it('properly evaluates full CartEvent via routeCartByLtv helper', () => {
    const mockCart: CartEvent = {
      id: 'cart_high_val_01',
      cartToken: 'tok_high_val_01',
      merchantId: 'merch_01',
      customerPhone: '+15550001111',
      customerEmail: 'ceo@tech.com',
      customerName: 'Tech Founder',
      currency: 'USD',
      totalPrice: 1600.0,
      items: [{ id: 'item_1', title: 'Ergonomic Desk', price: 1600.0, quantity: 1 }],
      status: 'ABANDONED',
      abandonmentType: 'PAYMENT_FAILED',
      recoveryStage: 'QUEUED',
      checkoutUrl: 'https://store.myshopify.com/checkouts/tok_high_val_01',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const decision = routeCartByLtv(mockCart, { exitVelocityY: -1.5 });
    expect(decision.tier).toBe('VIP_IMMEDIATE');
    expect(decision.predictiveLtvScore).toBeGreaterThan(0.8);
  });
});
