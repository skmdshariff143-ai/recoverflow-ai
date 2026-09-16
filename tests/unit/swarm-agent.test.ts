import { describe, it, expect } from 'vitest';
import {
  generateCopywritingSwarm,
  SwarmMultiArmedBandit,
} from '@recoverflow/agents';
import type { CartEvent, Merchant } from '@recoverflow/core';

describe('Autonomous A/B Copywriting Swarms (Track 2)', () => {
  const mockMerchant: Merchant = {
    id: 'merch_swarm_01',
    storeUrl: 'https://aurora-luxe.com',
    storeName: 'Aurora Luxe',
    webhookSecret: 'whsec_test',
    brandToneGuidelines: 'Artisanal luxury and elegance',
    brandVoiceCasualVsFormal: 0.8,
    brandVoiceUrgencyVsGentle: 0.3,
    discountCeilingPercentage: 15.0,
    minMarginPercentage: 20.0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCart: CartEvent = {
    id: 'cart_swarm_01',
    cartToken: 'tok_swarm_01',
    merchantId: 'merch_swarm_01',
    customerName: 'Marcus Aurelius',
    customerPhone: '+15551234567',
    totalPrice: 450.0,
    currency: 'USD',
    items: [{ id: 'item_1', title: 'Cashmere Overcoat', price: 450.0, quantity: 1 }],
    status: 'ABANDONED',
    abandonmentType: 'CHECKOUT_STEP',
    recoveryStage: 'QUEUED',
    checkoutUrl: 'https://aurora-luxe.com/c/tok_swarm_01',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('generates 3 semantically distinct copy variations: URGENCY, EMPATHY, and SOCIAL_PROOF', async () => {
    const swarmResult = await generateCopywritingSwarm({
      customerName: 'Marcus Aurelius',
      cart: mockCart,
      merchant: mockMerchant,
      discountCode: 'WELCOME10',
    });

    expect(swarmResult.variations.URGENCY).toBeDefined();
    expect(swarmResult.variations.EMPATHY).toBeDefined();
    expect(swarmResult.variations.SOCIAL_PROOF).toBeDefined();

    // Verify distinct semantic themes
    expect(swarmResult.variations.URGENCY.angle).toBe('URGENCY');
    expect(swarmResult.variations.URGENCY.messageBody.toLowerCase()).toMatch(/stock|demand|reserv|limit/);

    expect(swarmResult.variations.EMPATHY.angle).toBe('EMPATHY');
    expect(swarmResult.variations.EMPATHY.messageBody.toLowerCase()).toMatch(/saved|issue|help|friction|safely/);

    expect(swarmResult.variations.SOCIAL_PROOF.angle).toBe('SOCIAL_PROOF');
    expect(swarmResult.variations.SOCIAL_PROOF.messageBody.toLowerCase()).toMatch(/rated|customer|essential|popular|join/);

    // Verify chosen arm is one of the 3
    expect(['URGENCY', 'EMPATHY', 'SOCIAL_PROOF']).toContain(swarmResult.selectedAngle);
    expect(swarmResult.chosenVariation).toBe(swarmResult.variations[swarmResult.selectedAngle]);
  });

  it('self-optimizes and applies 24-hour decaying weights to losing arms in Thompson Sampling', () => {
    const bandit = new SwarmMultiArmedBandit();
    const merchantId = 'merch_decay_test';

    bandit.initDefaultPriors(merchantId);

    // Record high conversion reward for EMPATHY arm
    for (let i = 0; i < 5; i++) {
      bandit.recordOutcome(merchantId, 'STANDARD', 'EMPATHY', true, 500);
    }

    // Record failures for URGENCY arm
    for (let i = 0; i < 5; i++) {
      bandit.recordOutcome(merchantId, 'STANDARD', 'URGENCY', false, 0);
    }

    const distBefore = bandit.getSwarmDistributions(merchantId);
    const empathyBefore = distBefore.find((d) => d.angle === 'EMPATHY')!;
    const urgencyBefore = distBefore.find((d) => d.angle === 'URGENCY')!;

    expect(empathyBefore.alpha).toBeGreaterThan(urgencyBefore.alpha);
    expect(urgencyBefore.beta).toBeGreaterThan(empathyBefore.beta);

    // Apply 24-hour decay
    bandit.apply24HourDecay(merchantId, 'STANDARD', 0.85);

    const distAfter = bandit.getSwarmDistributions(merchantId);
    const empathyAfter = distAfter.find((d) => d.angle === 'EMPATHY')!;
    const urgencyAfter = distAfter.find((d) => d.angle === 'URGENCY')!;

    expect(empathyAfter.alpha).toBeLessThan(empathyBefore.alpha);
    expect(urgencyAfter.beta).toBeLessThan(urgencyBefore.beta);
  });
});
