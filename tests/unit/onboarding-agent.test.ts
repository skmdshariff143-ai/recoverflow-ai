import { describe, it, expect } from 'vitest';
import {
  analyzeStorefrontBrand,
  harvestStorefrontMetadata,
  runMerchantOnboarding,
} from '@recoverflow/agents';
import { db } from '@recoverflow/core';

describe('Agentic Zero-Shot Merchant Onboarding (Track 1)', () => {
  it('derives luxury brand characteristics and conservative discount ceiling for high-ticket catalog', async () => {
    const profile = await analyzeStorefrontBrand({
      title: 'Atelier Maurice Haute Couture',
      description: 'Handcrafted bespoke silk dresses and tailored luxury garments made in Paris.',
      sampleProductTitles: ['Silk Velvet Gown', 'Tailored Wool Tuxedo', 'Cashmere Cape'],
      samplePricePoints: [850, 1400, 2200],
      currency: 'USD',
    });

    expect(profile.brandVoiceCasualVsFormal).toBeGreaterThan(0.6); // Formal / Luxury
    expect(profile.suggestedDiscountCeiling).toBeLessThanOrEqual(15); // Strict margin protection
    expect(profile.detectedPriceTier).toBe('LUXURY');
    expect(profile.toneDescription.length).toBeGreaterThan(10);
  });

  it('derives casual/high-urgency tone for outlet / streetwear catalogs', async () => {
    const profile = await analyzeStorefrontBrand({
      title: 'Daily Streetwear Outlet Deals',
      description: 'Trendy graphic tees, hoodies, and limited drops.',
      sampleProductTitles: ['Vintage Graphic Tee', 'Oversized Hoodie', 'Skate Beanie'],
      samplePricePoints: [28, 45, 65],
      currency: 'USD',
    });

    expect(profile.brandVoiceCasualVsFormal).toBeLessThan(0.5); // Casual
    expect(profile.suggestedDiscountCeiling).toBeGreaterThanOrEqual(15); // Higher discount room
  });

  it('falls back gracefully to domain heuristics when storefront is offline', async () => {
    const data = await harvestStorefrontMetadata('nonexistent-store-offline-999.myshopify.com');
    expect(data.title).toContain('nonexistent store offline 999');
    expect(data.samplePricePoints.length).toBeGreaterThan(0);
  });

  it('runs the complete onboarding pipeline and updates the merchant record in the database', async () => {
    const merchantId = `merch_onboard_test_${Date.now()}`;
    await db.upsertMerchant({
      id: merchantId,
      storeUrl: 'https://velvet-nordic.myshopify.com',
      storeName: 'Velvet Nordic',
      shopDomain: 'velvet-nordic.myshopify.com',
      webhookSecret: 'whsec_test',
      brandToneGuidelines: 'Initial placeholder tone',
      brandVoiceCasualVsFormal: 0.5,
      brandVoiceUrgencyVsGentle: 0.5,
      discountCeilingPercentage: 15.0,
      minMarginPercentage: 20.0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await runMerchantOnboarding({
      shopDomain: 'velvet-nordic.myshopify.com',
      merchantId,
    });

    expect(result.success).toBe(true);
    expect(result.profile.brandVoiceCasualVsFormal).toBeDefined();
    expect(result.profile.suggestedDiscountCeiling).toBeDefined();

    // Verify DB updated
    const updated = await db.getMerchant(merchantId);
    expect(updated).not.toBeNull();
    expect(updated?.brandProfile).toBeDefined();
    expect(updated?.brandToneGuidelines).not.toBe('Initial placeholder tone');
  });
});
