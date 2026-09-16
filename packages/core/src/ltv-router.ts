import type { CartEvent, AbandonmentType } from './types';

export interface TelemetryIntentSignals {
  exitVelocityY?: number; // px/ms, negative indicates departure toward browser toolbar
  tabBlurCount?: number;
  formFieldBlurs?: number;
  discountFailedAttempts?: number;
  dwellTimeSeconds?: number;
}

export interface PredictiveLtvInput {
  totalPrice: number;
  currency?: string;
  itemCount?: number;
  abandonmentType: AbandonmentType;
  customerPhone?: string;
  customerEmail?: string;
  items?: Array<{ title?: string; price: number; quantity?: number }>;
  telemetry?: TelemetryIntentSignals;
  discountCeilingPercentage?: number;
}

export type LtvRoutingTier = 'VIP_IMMEDIATE' | 'PRIORITY_MESSAGING' | 'STANDARD_CADENCE';

export interface LtvRoutingDecision {
  predictiveLtvScore: number; // 0.00 to 1.00
  tier: LtvRoutingTier;
  recommendedChannel: 'VOICE_AND_SMS' | 'WHATSAPP' | 'EMAIL';
  initialDelayMs: number;
  reasoning: string;
  factors: {
    valueFactor: number;
    intentFactor: number;
    velocityBoost: number;
    contactQualityFactor: number;
  };
}

/**
 * Computes multi-factor Predictive LTV score and intelligent routing decision.
 */
export function computePredictiveLtvScore(input: PredictiveLtvInput): LtvRoutingDecision {
  const {
    totalPrice,
    abandonmentType,
    customerPhone,
    customerEmail,
    items = [],
    telemetry = {},
  } = input;

  // 1. Cart Value Factor (0.0 to 0.45)
  // Scale dynamically: $1,200+ reaches max score
  const normalizedValue = Math.min(1.0, Math.max(0, totalPrice / 1200));
  const valueFactor = normalizedValue * 0.45;

  // 2. High-Intent Funnel Position (0.0 to 0.30)
  let intentFactor = 0.10;
  if (abandonmentType === 'PAYMENT_FAILED') {
    intentFactor = 0.30; // Maximum purchase intent blocked by payment gateway
  } else if (abandonmentType === 'CHECKOUT_STEP') {
    intentFactor = 0.20;
  } else if (abandonmentType === 'CART_PAGE') {
    intentFactor = 0.10;
  }

  // 3. Contact Details Completeness (0.0 to 0.15)
  let contactQualityFactor = 0.0;
  if (customerPhone && customerEmail) {
    contactQualityFactor = 0.15;
  } else if (customerPhone) {
    contactQualityFactor = 0.12;
  } else if (customerEmail) {
    contactQualityFactor = 0.08;
  }

  // 4. Basket Composition / Luxury Item Bonus (0.0 to 0.10)
  const hasHighPriceItem = items.some((item) => item.price >= 400);
  const basketItemBonus = hasHighPriceItem ? 0.10 : items.length > 2 ? 0.05 : 0.02;

  // Base raw score sum (0.0 to 1.0)
  const baseScore = valueFactor + intentFactor + contactQualityFactor + basketItemBonus;

  // 5. Exit Intent Velocity Multiplier
  // Rapid acceleration toward the close button / tab bar triggers high-urgency rescue
  let velocityMultiplier = 1.0;
  if (telemetry.exitVelocityY !== undefined && telemetry.exitVelocityY < -1.0) {
    velocityMultiplier = 1.25; // Urgent departure detected
  } else if (telemetry.discountFailedAttempts && telemetry.discountFailedAttempts >= 2) {
    velocityMultiplier = 1.15; // Frustrated coupon hunter
  }

  const rawFinalScore = baseScore * velocityMultiplier;
  const score = Math.min(1.0, Math.max(0.0, parseFloat(rawFinalScore.toFixed(3))));

  // Routing Tier Evaluation
  if (score > 0.8) {
    return {
      predictiveLtvScore: score,
      tier: 'VIP_IMMEDIATE',
      recommendedChannel: 'VOICE_AND_SMS',
      initialDelayMs: 0, // Zero delay for high LTV VIP carts
      reasoning: `High predictive LTV score (${score}) with high value ($${totalPrice.toFixed(2)}) & intent. Dispatched immediately to VIP Voice Concierge.`,
      factors: {
        valueFactor: parseFloat(valueFactor.toFixed(3)),
        intentFactor: parseFloat(intentFactor.toFixed(3)),
        velocityBoost: parseFloat(velocityMultiplier.toFixed(2)),
        contactQualityFactor: parseFloat(contactQualityFactor.toFixed(3)),
      },
    };
  }

  if (score >= 0.5) {
    return {
      predictiveLtvScore: score,
      tier: 'PRIORITY_MESSAGING',
      recommendedChannel: 'WHATSAPP',
      initialDelayMs: abandonmentType === 'PAYMENT_FAILED' ? 3 * 60 * 1000 : 15 * 60 * 1000,
      reasoning: `Moderate-high predictive LTV score (${score}). Routed to priority WhatsApp recovery sequence.`,
      factors: {
        valueFactor: parseFloat(valueFactor.toFixed(3)),
        intentFactor: parseFloat(intentFactor.toFixed(3)),
        velocityBoost: parseFloat(velocityMultiplier.toFixed(2)),
        contactQualityFactor: parseFloat(contactQualityFactor.toFixed(3)),
      },
    };
  }

  return {
    predictiveLtvScore: score,
    tier: 'STANDARD_CADENCE',
    recommendedChannel: customerPhone ? 'WHATSAPP' : 'EMAIL',
    initialDelayMs: 30 * 60 * 1000, // 30 minutes standard
    reasoning: `Standard cart LTV score (${score}). Scheduled for standard 30-minute recovery cadence.`,
    factors: {
      valueFactor: parseFloat(valueFactor.toFixed(3)),
      intentFactor: parseFloat(intentFactor.toFixed(3)),
      velocityBoost: parseFloat(velocityMultiplier.toFixed(2)),
      contactQualityFactor: parseFloat(contactQualityFactor.toFixed(3)),
    },
  };
}

/**
 * Convenience helper to evaluate a CartEvent directly.
 */
export function routeCartByLtv(cart: CartEvent, telemetry?: TelemetryIntentSignals): LtvRoutingDecision {
  return computePredictiveLtvScore({
    totalPrice: cart.totalPrice,
    currency: cart.currency,
    abandonmentType: cart.abandonmentType,
    customerPhone: cart.customerPhone,
    customerEmail: cart.customerEmail,
    items: cart.items,
    telemetry,
  });
}
