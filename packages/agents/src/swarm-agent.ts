import type { CartEvent, Merchant } from '@recoverflow/core';
import { getGeminiClient } from './gemini';

export type SwarmCopyAngle = 'URGENCY' | 'EMPATHY' | 'SOCIAL_PROOF';

export interface SwarmVariation {
  angle: SwarmCopyAngle;
  messageBody: string;
  callToActionUrl: string;
  suggestedDiscountCode: string | null;
  reason: string;
}

export interface SwarmArmDistribution {
  angle: SwarmCopyAngle;
  alpha: number; // successes + prior (2.0)
  beta: number;  // failures + prior (2.0)
  pulls: number;
  conversions: number;
  totalRevenue: number;
  lastDecayedAt: number;
}

export interface SwarmGenerationResult {
  variations: Record<SwarmCopyAngle, SwarmVariation>;
  selectedAngle: SwarmCopyAngle;
  chosenVariation: SwarmVariation;
}

export class SwarmMultiArmedBandit {
  // Key: `${merchantId}:${cartTier}` -> Map<SwarmCopyAngle, SwarmArmDistribution>
  private armDistributions = new Map<string, Map<SwarmCopyAngle, SwarmArmDistribution>>();

  constructor() {
    this.initDefaultPriors('merchant_default_01');
  }

  private makeKey(merchantId: string, cartTier = 'STANDARD'): string {
    return `${merchantId}:${cartTier}`;
  }

  public initDefaultPriors(merchantId: string, cartTier = 'STANDARD') {
    const key = this.makeKey(merchantId, cartTier);
    if (!this.armDistributions.has(key)) {
      const armMap = new Map<SwarmCopyAngle, SwarmArmDistribution>();
      const angles: SwarmCopyAngle[] = ['URGENCY', 'EMPATHY', 'SOCIAL_PROOF'];

      for (const angle of angles) {
        armMap.set(angle, {
          angle,
          alpha: 2.0,
          beta: 2.0,
          pulls: 0,
          conversions: 0,
          totalRevenue: 0,
          lastDecayedAt: Date.now(),
        });
      }
      this.armDistributions.set(key, armMap);
    }
  }

  /**
   * Samples a float from Beta(alpha, beta) using standard numerical transformation.
   */
  private sampleBeta(alpha: number, beta: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1 || 0.0001)) * Math.cos(2.0 * Math.PI * u2);
    const mean = alpha / (alpha + beta);
    const variance = (alpha * beta) / (Math.pow(alpha + beta, 2) * (alpha + beta + 1));
    const sample = mean + z0 * Math.sqrt(variance);
    return Math.max(0.001, Math.min(0.999, sample));
  }

  /**
   * Applies rolling 24-hour decay to losing arms so the swarm self-optimizes over time.
   */
  public apply24HourDecay(merchantId: string, cartTier = 'STANDARD', decayFactor = 0.90): void {
    const key = this.makeKey(merchantId, cartTier);
    const armMap = this.armDistributions.get(key);
    if (!armMap) return;

    for (const state of armMap.values()) {
      // Decay alpha and beta toward prior (2.0)
      state.alpha = 2.0 + (state.alpha - 2.0) * decayFactor;
      state.beta = 2.0 + (state.beta - 2.0) * decayFactor;
      state.lastDecayedAt = Date.now();
    }
  }

  /**
   * Selects the winning copy angle for this impression using Thompson Sampling.
   */
  public selectOptimalAngle(merchantId: string, cartTier = 'STANDARD'): SwarmCopyAngle {
    const key = this.makeKey(merchantId, cartTier);
    let armMap = this.armDistributions.get(key);
    if (!armMap) {
      this.initDefaultPriors(merchantId, cartTier);
      armMap = this.armDistributions.get(key)!;
    }

    let bestAngle: SwarmCopyAngle = 'EMPATHY';
    let highestSample = -Infinity;

    for (const [angle, state] of armMap.entries()) {
      const sample = this.sampleBeta(state.alpha, state.beta);
      if (sample > highestSample) {
        highestSample = sample;
        bestAngle = angle;
      }
    }

    return bestAngle;
  }

  /**
   * Records conversion/revenue outcome for a specific copy angle.
   */
  public recordOutcome(
    merchantId: string,
    cartTier: string,
    angle: SwarmCopyAngle,
    converted: boolean,
    recoveredAmount = 0
  ): SwarmArmDistribution {
    const key = this.makeKey(merchantId, cartTier);
    let armMap = this.armDistributions.get(key);
    if (!armMap) {
      this.initDefaultPriors(merchantId, cartTier);
      armMap = this.armDistributions.get(key)!;
    }

    const state = armMap.get(angle)!;
    state.pulls += 1;
    if (converted) {
      state.alpha += 1.0;
      state.conversions += 1;
      state.totalRevenue += recoveredAmount;
    } else {
      state.beta += 1.0;
    }

    armMap.set(angle, state);
    return state;
  }

  /**
   * Retrieves live convergence distribution for all copy angles.
   */
  public getSwarmDistributions(merchantId: string, cartTier = 'STANDARD'): SwarmArmDistribution[] {
    const key = this.makeKey(merchantId, cartTier);
    const armMap = this.armDistributions.get(key);
    if (!armMap) {
      this.initDefaultPriors(merchantId, cartTier);
      return Array.from(this.armDistributions.get(key)!.values()).map((s) => ({ ...s }));
    }
    return Array.from(armMap.values()).map((s) => ({ ...s }));
  }
}

export const globalSwarmBandit = new SwarmMultiArmedBandit();

/**
 * Generates 3 distinct semantic variations across URGENCY, EMPATHY, and SOCIAL_PROOF.
 */
export async function generateCopywritingSwarm(input: {
  customerName?: string;
  cart: CartEvent;
  merchant: Merchant;
  discountCode?: string | null;
}): Promise<SwarmGenerationResult> {
  const { customerName, cart, merchant, discountCode } = input;
  const name = customerName ? customerName.split(' ')[0] : 'there';
  const firstItemTitle = cart.items[0]?.title || 'your selected items';
  const discountText = discountCode ? ` Use courtesy code ${discountCode}.` : '';

  const gemini = getGeminiClient();

  if (gemini) {
    const prompt = `Generate 3 distinct cart recovery copywriting variations for an e-commerce customer.
Store: ${merchant.storeName}
Customer: ${name}
Item: ${firstItemTitle}
Total Value: ${cart.currency} ${cart.totalPrice.toFixed(2)}
Checkout Link: ${cart.checkoutUrl}
Discount Code: ${discountCode || 'None'}

Generate valid JSON with 3 objects matching these exact keys:
1. URGENCY: Highlighting limited stock, reservation timer, and preventing cart expiration.
2. EMPATHY: Warm, reassuring support inquiring if any payment/technical friction occurred.
3. SOCIAL_PROOF: Highlighting verified 5-star customer acclaim, trending demand, and artisan craftsmanship.

Return raw JSON structure:
{
  "URGENCY": { "messageBody": "...", "reason": "..." },
  "EMPATHY": { "messageBody": "...", "reason": "..." },
  "SOCIAL_PROOF": { "messageBody": "...", "reason": "..." }
}`;

    try {
      const response = await gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
          temperature: 0.4,
        },
      });

      const parsed = JSON.parse(response.text || '{}') as Record<string, { messageBody?: string; reason?: string }>;

      const variations: Record<SwarmCopyAngle, SwarmVariation> = {
        URGENCY: {
          angle: 'URGENCY',
          messageBody: parsed.URGENCY?.messageBody || `Hi ${name}! High demand alert: Your ${firstItemTitle} is reserved for just 2 hours at ${merchant.storeName}.${discountText} Complete checkout before stock releases: ${cart.checkoutUrl}`,
          callToActionUrl: cart.checkoutUrl,
          suggestedDiscountCode: discountCode || null,
          reason: parsed.URGENCY?.reason || 'Scarcity and reservation countdown',
        },
        EMPATHY: {
          angle: 'EMPATHY',
          messageBody: parsed.EMPATHY?.messageBody || `Hello ${name}, we noticed an issue completing your order for ${firstItemTitle} at ${merchant.storeName}. We've saved your cart safely.${discountText} Need any help? Finish here: ${cart.checkoutUrl}`,
          callToActionUrl: cart.checkoutUrl,
          suggestedDiscountCode: discountCode || null,
          reason: parsed.EMPATHY?.reason || 'Friction-free supportive reassurance',
        },
        SOCIAL_PROOF: {
          angle: 'SOCIAL_PROOF',
          messageBody: parsed.SOCIAL_PROOF?.messageBody || `Hi ${name}, join hundreds of verified customers loving their ${firstItemTitle} from ${merchant.storeName}.${discountText} Complete your verified order here: ${cart.checkoutUrl}`,
          callToActionUrl: cart.checkoutUrl,
          suggestedDiscountCode: discountCode || null,
          reason: parsed.SOCIAL_PROOF?.reason || 'Social validation and customer acclaim',
        },
      };

      const selectedAngle = globalSwarmBandit.selectOptimalAngle(merchant.id, cart.totalPrice > 300 ? 'HIGH' : 'STANDARD');

      return {
        variations,
        selectedAngle,
        chosenVariation: variations[selectedAngle],
      };
    } catch {
      // Fall through to deterministic generator
    }
  }

  // Deterministic copy generator
  const variations: Record<SwarmCopyAngle, SwarmVariation> = {
    URGENCY: {
      angle: 'URGENCY',
      messageBody: `Hi ${name}! Stock alert: Your ${firstItemTitle} at ${merchant.storeName} is reserved for a limited time.${discountText} Complete your order before items release: ${cart.checkoutUrl}`,
      callToActionUrl: cart.checkoutUrl,
      suggestedDiscountCode: discountCode || null,
      reason: 'Scarcity and reservation countdown',
    },
    EMPATHY: {
      angle: 'EMPATHY',
      messageBody: `Hello ${name}, we saved your cart for ${firstItemTitle} at ${merchant.storeName}.${discountText} If you experienced payment friction or have sizing questions, complete your order safely here: ${cart.checkoutUrl}`,
      callToActionUrl: cart.checkoutUrl,
      suggestedDiscountCode: discountCode || null,
      reason: 'Supportive concierge reassurance',
    },
    SOCIAL_PROOF: {
      angle: 'SOCIAL_PROOF',
      messageBody: `Hi ${name}! The ${firstItemTitle} is currently one of our top-rated essentials at ${merchant.storeName}.${discountText} Complete your purchase here: ${cart.checkoutUrl}`,
      callToActionUrl: cart.checkoutUrl,
      suggestedDiscountCode: discountCode || null,
      reason: 'Bestseller validation and verified reviews',
    },
  };

  const selectedAngle = globalSwarmBandit.selectOptimalAngle(merchant.id, cart.totalPrice > 300 ? 'HIGH' : 'STANDARD');

  return {
    variations,
    selectedAngle,
    chosenVariation: variations[selectedAngle],
  };
}
