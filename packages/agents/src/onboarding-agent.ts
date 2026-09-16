import { db, type Merchant } from '@recoverflow/core';
import { getGeminiClient } from './gemini';

export interface MerchantBrandProfile {
  brandVoiceCasualVsFormal: number; // 0.0 (Casual) to 1.0 (Formal)
  brandVoiceUrgencyVsGentle: number; // 0.0 (Gentle) to 1.0 (Urgent)
  suggestedDiscountCeiling: number; // percentage, e.g. 10 to 25
  toneDescription: string;
  inferredCategory: string;
  detectedPriceTier: 'BUDGET' | 'MID_TIER' | 'PREMIUM' | 'LUXURY';
}

export interface StorefrontRawData {
  title: string;
  description: string;
  sampleProductTitles: string[];
  samplePricePoints: number[];
  currency: string;
}

/**
 * Scrapes or inspects public storefront metadata to discover product catalog and copy.
 */
export async function harvestStorefrontMetadata(shopDomain: string): Promise<StorefrontRawData> {
  const cleanDomain = shopDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const url = `https://${cleanDomain}`;

  try {
    // Attempt fetching products.json from Shopify storefront
    const productsRes = await fetch(`${url}/products.json?limit=10`, {
      headers: { 'User-Agent': 'RecoverFlow-Storefront-Scanner/1.0' },
      signal: AbortSignal.timeout(4000),
    });

    if (productsRes.ok) {
      const data = (await productsRes.json()) as {
        products?: Array<{
          title: string;
          body_html?: string;
          variants?: Array<{ price: string }>;
        }>;
      };

      if (data.products && data.products.length > 0) {
        const sampleProductTitles = data.products.map((p) => p.title);
        const samplePricePoints = data.products
          .flatMap((p) => p.variants || [])
          .map((v) => parseFloat(v.price))
          .filter((p) => !isNaN(p) && p > 0);

        return {
          title: cleanDomain.replace('.myshopify.com', '').replace(/[-_]/g, ' '),
          description: data.products[0]?.body_html?.replace(/<[^>]*>?/gm, '').slice(0, 300) || '',
          sampleProductTitles,
          samplePricePoints,
          currency: 'USD',
        };
      }
    }
  } catch {
    // Fall back to domain heuristics
  }

  // Fallback heuristic extraction from domain name
  const storeName = cleanDomain.replace('.myshopify.com', '').replace(/[-_]/g, ' ');
  return {
    title: storeName,
    description: `Independent e-commerce brand operating on ${cleanDomain}`,
    sampleProductTitles: [`${storeName} Core Product`, `${storeName} Signature Collection`],
    samplePricePoints: [75, 150, 250],
    currency: 'USD',
  };
}

/**
 * Executes zero-shot brand voice and discount ceiling analysis using Gemini.
 */
export async function analyzeStorefrontBrand(storeData: StorefrontRawData): Promise<MerchantBrandProfile> {
  const avgPrice =
    storeData.samplePricePoints.length > 0
      ? storeData.samplePricePoints.reduce((a, b) => a + b, 0) / storeData.samplePricePoints.length
      : 100;

  const gemini = getGeminiClient();
  if (gemini) {
    const prompt = `Analyze this e-commerce storefront for automated cart recovery tone calibration:
Store Name: ${storeData.title}
Store Overview: ${storeData.description}
Sample Products: ${storeData.sampleProductTitles.join(', ')}
Sample Prices: ${storeData.samplePricePoints.join(', ')} (Avg: $${avgPrice.toFixed(2)})

Determine:
1. brandVoiceCasualVsFormal: float between 0.0 (very casual/friendly) and 1.0 (formal/exclusive luxury).
2. brandVoiceUrgencyVsGentle: float between 0.0 (gentle/supportive) and 1.0 (high-urgency scarcity).
3. suggestedDiscountCeiling: max discount percentage (5 to 25%) based on price tier (luxury gets lower discounts, fast fashion gets higher).
4. toneDescription: 1-2 sentence brand guidelines summary.
5. inferredCategory: apparel, electronics, luxury, beauty, homeware, or fitness.
6. detectedPriceTier: BUDGET, MID_TIER, PREMIUM, or LUXURY.

Return ONLY valid raw JSON with keys: brandVoiceCasualVsFormal, brandVoiceUrgencyVsGentle, suggestedDiscountCeiling, toneDescription, inferredCategory, detectedPriceTier.`;

    try {
      const response = await gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const text = response.text || '';
      const parsed = JSON.parse(text) as Partial<MerchantBrandProfile>;
      return {
        brandVoiceCasualVsFormal: Math.max(0, Math.min(1, Number(parsed.brandVoiceCasualVsFormal ?? 0.35))),
        brandVoiceUrgencyVsGentle: Math.max(0, Math.min(1, Number(parsed.brandVoiceUrgencyVsGentle ?? 0.4))),
        suggestedDiscountCeiling: Math.max(5, Math.min(25, Number(parsed.suggestedDiscountCeiling ?? 15))),
        toneDescription: parsed.toneDescription || 'Polite, conversational, value-driven recovery tone.',
        inferredCategory: parsed.inferredCategory || 'General Merchandise',
        detectedPriceTier: parsed.detectedPriceTier || (avgPrice > 300 ? 'LUXURY' : avgPrice > 100 ? 'PREMIUM' : 'MID_TIER'),
      };
    } catch {
      // Fallback to deterministic heuristic profiling
    }
  }

  // Deterministic rule-based fallback
  const isLuxury = avgPrice >= 300 || /luxe|couture|atelier|bespoke|jewel/i.test(storeData.title);
  const isCasual = /deals|outlet|fun|apparel|streetwear/i.test(storeData.title);

  return {
    brandVoiceCasualVsFormal: isLuxury ? 0.85 : isCasual ? 0.2 : 0.45,
    brandVoiceUrgencyVsGentle: isLuxury ? 0.25 : 0.5,
    suggestedDiscountCeiling: isLuxury ? 10 : isCasual ? 20 : 15,
    toneDescription: isLuxury
      ? 'Sophisticated, respectful white-glove tone prioritizing brand integrity and exclusivity.'
      : 'Engaging, warm and supportive recovery tone focused on product satisfaction.',
    inferredCategory: isLuxury ? 'Luxury Goods' : 'Apparel & Lifestyle',
    detectedPriceTier: isLuxury ? 'LUXURY' : avgPrice > 100 ? 'PREMIUM' : 'MID_TIER',
  };
}

/**
 * Complete zero-shot onboarding pipeline: Scrapes domain, generates profile, and updates DB.
 */
export async function runMerchantOnboarding(params: {
  shopDomain: string;
  merchantId: string;
}): Promise<{ success: boolean; profile: MerchantBrandProfile; merchant?: Merchant | null }> {
  const { shopDomain, merchantId } = params;

  const rawData = await harvestStorefrontMetadata(shopDomain);
  const profile = await analyzeStorefrontBrand(rawData);

  const existing = await db.getMerchant(merchantId);
  if (existing) {
    const updated = await db.upsertMerchant({
      ...existing,
      brandToneGuidelines: profile.toneDescription,
      brandVoiceCasualVsFormal: profile.brandVoiceCasualVsFormal,
      brandVoiceUrgencyVsGentle: profile.brandVoiceUrgencyVsGentle,
      discountCeilingPercentage: profile.suggestedDiscountCeiling,
      brandProfile: profile as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    });

    return {
      success: true,
      profile,
      merchant: updated,
    };
  }

  return {
    success: true,
    profile,
  };
}
