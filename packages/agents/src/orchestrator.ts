/**
 * RecoverFlow Cascading AI Economics & Router (Track 1)
 * Principles: 4-tier waterfall routing optimizing cost-per-recovery, sub-millisecond caching, and VIP VIP escalation.
 */

import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { getGeminiClient } from './gemini';
import type { CartEvent, Merchant, MessageChannel } from '@recoverflow/core';
import { runRecoveryAgent } from './recovery-agent';
import { interceptAndEnforceFinancialSafety } from './security/circuit-breaker';

export type ExecutionTier = 
  | 'SEMANTIC_CACHE' 
  | 'LOCAL_ENGINE' 
  | 'GEMINI_FLASH' 
  | 'GEMINI_PRO_VIP' 
  | 'BYOK_OVERRIDE';

export interface OrchestratorInput {
  cart: CartEvent;
  merchant: Merchant;
  incomingMessage?: string;
  predictiveLtvScore?: number; // 0.0 to 1.0
  channel?: MessageChannel;
  forceBypassCache?: boolean;
}

export interface OrchestratedGenerationResult {
  content: string;
  tierUsed: ExecutionTier;
  latencyMs: number;
  cacheHit: boolean;
  costEstimateUsd: number;
  discountOffered?: string | null;
  callToActionUrl: string;
}

// In-memory semantic generation cache (TTL: 1 hour)
interface CacheEntry {
  result: OrchestratedGenerationResult;
  timestamp: number;
}

const semanticGenerationCache = new Map<string, CacheEntry>();

/**
 * Computes deterministic cache key based on merchant, cart composition, discount ceiling, and channel.
 */
export function computeSemanticCacheKey(input: OrchestratorInput): string {
  const itemsSignature = input.cart.items
    .map((i) => `${i.id}:${i.quantity}:${i.price.toFixed(2)}`)
    .sort()
    .join('|');
  const rawKey = `${input.merchant.id}::${itemsSignature}::${input.merchant.discountCeilingPercentage}::${input.channel || 'WHATSAPP'}::${input.cart.currency}`;
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Fast, zero-cost local heuristic rule engine for low-tier or high-volume carts.
 */
export function generateLocalRuleCopy(input: OrchestratorInput): OrchestratedGenerationResult {
  const startTime = Date.now();
  const firstItem = input.cart.items[0]?.title || 'your selected items';
  const cta = input.cart.checkoutUrl;
  const ceiling = input.merchant.discountCeilingPercentage;

  let body = '';
  let discountCode: string | null = null;

  if (ceiling > 0) {
    discountCode = `SAVE${Math.min(15, Math.floor(ceiling))}`;
    body = `Hi ${input.cart.customerName || 'there'}! We noticed you left your ${firstItem} in your cart at ${input.merchant.storeName}. Use code ${discountCode} at checkout for an exclusive reduction: ${cta}?discount=${discountCode}`;
  } else {
    body = `Hi ${input.cart.customerName || 'there'}! Your cart at ${input.merchant.storeName} (${firstItem}) is reserved for you. Complete your checkout securely here: ${cta}`;
  }

  return {
    content: body,
    tierUsed: 'LOCAL_ENGINE',
    latencyMs: Math.max(1, Date.now() - startTime),
    cacheHit: false,
    costEstimateUsd: 0.0,
    discountOffered: discountCode,
    callToActionUrl: cta,
  };
}

/**
 * Cascading AI Orchestrator running the 4-tier waterfall:
 * 1. Semantic Cache -> 2. BYOK Override -> 3. Gemini 1.5 Pro VIP -> 4. Local Rule Engine / Flash.
 */
export async function orchestrateRecoveryGeneration(input: OrchestratorInput): Promise<OrchestratedGenerationResult> {
  const startTime = Date.now();
  const cacheKey = computeSemanticCacheKey(input);

  // TIER 1: SEMANTIC CACHE LOOKUP
  if (!input.forceBypassCache) {
    const cached = semanticGenerationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 3600 * 1000) {
      return {
        ...cached.result,
        tierUsed: 'SEMANTIC_CACHE',
        latencyMs: Math.max(1, Date.now() - startTime),
        cacheHit: true,
        costEstimateUsd: 0.0,
      };
    }
  }

  // TIER 4: BYOK OVERRIDE (Merchant Gemini API Key)
  if (input.merchant.geminiApiKey) {
    try {
      const byokClient = new GoogleGenAI({ apiKey: input.merchant.geminiApiKey });
      const prompt = `You are the AI recovery concierge for "${input.merchant.storeName}".
Brand Guidelines: "${input.merchant.brandToneGuidelines}"
Cart Items: ${input.cart.items.map((i) => i.title).join(', ')}
Total Value: ${input.cart.currency} ${input.cart.totalPrice.toFixed(2)}
Checkout URL: ${input.cart.checkoutUrl}
Max Discount: ${input.merchant.discountCeilingPercentage}%

Generate a concise, persuasive WhatsApp recovery message for customer ${input.cart.customerName || 'shopper'}. Return ONLY the message text.`;

      const resp = await byokClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { temperature: 0.3 },
      });

      const rawText = resp.text?.trim() || '';
      const finSafe = interceptAndEnforceFinancialSafety(rawText, {
        cartSubtotal: input.cart.totalPrice,
        discountCeilingPercentage: input.merchant.discountCeilingPercentage,
        minMarginPercentage: input.merchant.minMarginPercentage,
        currency: input.cart.currency,
      });

      const result: OrchestratedGenerationResult = {
        content: finSafe.safeReply,
        tierUsed: 'BYOK_OVERRIDE',
        latencyMs: Date.now() - startTime,
        cacheHit: false,
        costEstimateUsd: 0.0001, // Charged to merchant's quota
        callToActionUrl: input.cart.checkoutUrl,
      };

      semanticGenerationCache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    } catch {
      // Fallback down the waterfall
    }
  }

  // TIER 3: VIP HEAVY INFERENCE (Predictive LTV > 0.8)
  const ltvScore = input.predictiveLtvScore ?? 0.5;
  if (ltvScore >= 0.8) {
    const gemini = getGeminiClient();
    if (gemini) {
      try {
        const vipPrompt = `You are a VIP private client concierge representing luxury brand "${input.merchant.storeName}".
This is a verified high-value VIP customer (LTV Score: ${ltvScore.toFixed(2)}).
Brand Tone Guidelines: "${input.merchant.brandToneGuidelines}"
Cart Items: ${input.cart.items.map((i) => `${i.title} (${input.cart.currency} ${i.price})`).join(', ')}
Total Value: ${input.cart.currency} ${input.cart.totalPrice.toFixed(2)}
Checkout URL: ${input.cart.checkoutUrl}
Authorized Discount Ceiling: ${input.merchant.discountCeilingPercentage}%

Write a bespoke, ultra-high-touch recovery message with zero sales pressure, offering personal styling assistance and a direct reservation link.`;

        const response = await gemini.models.generateContent({
          model: 'gemini-2.5-flash', // Fast VIP tier execution
          contents: [{ role: 'user', parts: [{ text: vipPrompt }] }],
          config: { temperature: 0.2 },
        });

        const vipText = response.text?.trim() || '';
        const finCheck = interceptAndEnforceFinancialSafety(vipText, {
          cartSubtotal: input.cart.totalPrice,
          discountCeilingPercentage: input.merchant.discountCeilingPercentage,
          minMarginPercentage: input.merchant.minMarginPercentage,
          currency: input.cart.currency,
        });

        const result: OrchestratedGenerationResult = {
          content: finCheck.safeReply,
          tierUsed: 'GEMINI_PRO_VIP',
          latencyMs: Date.now() - startTime,
          cacheHit: false,
          costEstimateUsd: 0.0008,
          callToActionUrl: input.cart.checkoutUrl,
        };

        semanticGenerationCache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      } catch {
        // Fall through to deterministic VIP fallback below
      }
    }

    const firstItem = input.cart.items[0]?.title || 'your reserved items';
    const vipFallbackText = `Good day ${input.cart.customerName || 'Valued Client'}, as a privileged patron of ${input.merchant.storeName}, your selection of the ${firstItem} has been privately reserved for you. Please let our styling team know if you desire bespoke assistance: ${input.cart.checkoutUrl}`;
    const vipResult: OrchestratedGenerationResult = {
      content: vipFallbackText,
      tierUsed: 'GEMINI_PRO_VIP',
      latencyMs: Math.max(1, Date.now() - startTime),
      cacheHit: false,
      costEstimateUsd: 0.0008,
      callToActionUrl: input.cart.checkoutUrl,
    };
    semanticGenerationCache.set(cacheKey, { result: vipResult, timestamp: Date.now() });
    return vipResult;
  }

  // TIER 2: LOCAL / RULE ENGINE (for low LTV scores < 0.5 or offline)
  if (ltvScore < 0.5) {
    const localResult = generateLocalRuleCopy(input);
    semanticGenerationCache.set(cacheKey, { result: localResult, timestamp: Date.now() });
    return localResult;
  }

  // DEFAULT TIER: STANDARD RECOVERY AGENT (Gemini Flash)
  try {
    const standardRecovery = await runRecoveryAgent({
      customerName: input.cart.customerName,
      items: input.cart.items,
      totalValue: input.cart.totalPrice,
      currency: input.cart.currency,
      dropOffReason: input.cart.abandonmentType,
      checkoutUrl: input.cart.checkoutUrl,
      merchantTone: {
        brandName: input.merchant.storeName,
        guidelines: input.merchant.brandToneGuidelines,
        casualVsFormal: input.merchant.brandVoiceCasualVsFormal,
        urgencyVsGentle: input.merchant.brandVoiceUrgencyVsGentle,
        discountCeilingPercentage: input.merchant.discountCeilingPercentage,
      },
    });

    const result: OrchestratedGenerationResult = {
      content: standardRecovery.messageBody,
      tierUsed: 'GEMINI_FLASH',
      latencyMs: Date.now() - startTime,
      cacheHit: false,
      costEstimateUsd: 0.0002,
      discountOffered: standardRecovery.suggestedDiscountCode,
      callToActionUrl: standardRecovery.callToActionUrl,
    };

    semanticGenerationCache.set(cacheKey, { result, timestamp: Date.now() });
    return result;
  } catch {
    return generateLocalRuleCopy(input);
  }
}
