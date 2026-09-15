import { getGeminiClient } from './gemini';
import type { RecoveryAgentInput, RecoveryAgentOutput, UrgencyLevel } from '@recoverflow/core';

/**
 * Builds the strict, zero-hallucination system prompt for RecoveryAgent.
 */
export function buildRecoverySystemPrompt(input: RecoveryAgentInput): string {
  const toneLabel = input.merchantTone.casualVsFormal > 0.6 ? 'Formal, refined, and prestigious' : 'Warm, conversational, and accessible';
  const urgencyLabel = input.merchantTone.urgencyVsGentle > 0.6 ? 'High urgency (limited reserved stock / expiring basket)' : 'Gentle, supportive, and friction-free';
  
  const itemListText = input.items
    .map((item) => `- ${item.title}${item.variantTitle ? ` (${item.variantTitle})` : ''} x${item.quantity}: ${input.currency} ${(item.price * item.quantity).toFixed(2)}`)
    .join('\n');

  return `You are RecoverFlow AI's autonomous e-commerce recovery agent acting on behalf of ${input.merchantTone.brandName}.
Your objective is to craft an authentic, high-converting checkout recovery message for an abandoned customer.

### MERCHANT BRAND DIRECTIVES
- Brand Name: ${input.merchantTone.brandName}
- Tone Profile: ${toneLabel} (Formal index: ${(input.merchantTone.casualVsFormal * 100).toFixed(0)}%)
- Urgency Profile: ${urgencyLabel} (Urgency index: ${(input.merchantTone.urgencyVsGentle * 100).toFixed(0)}%)
- Merchant Custom Guidelines: "${input.merchantTone.guidelines}"
- Maximum Allowed Discount: ${input.merchantTone.discountCeilingPercentage}% (NEVER exceed this percentage)

### CART CONTEXT
- Customer Name: ${input.customerName || 'Valued Customer'}
- Abandonment Reason: ${input.dropOffReason}
- Currency: ${input.currency}
- Total Cart Value: ${input.currency} ${input.totalValue.toFixed(2)}
- Cart Items:
${itemListText}
- Rehydration Checkout Link: ${input.checkoutUrl}

### STRICT SAFETY & RECOVERY RULES
1. ZERO HALLUCINATIONS: Do not alter the cart total, do not invent items, and use the exact checkout link provided.
2. REASON TAILORING:
   - If PAYMENT_FAILED: Empathize with potential card/bank security blocks with ZERO customer blame. Note that items are reserved and alternate payment methods (e.g. Apple Pay, Shop Pay, PayPal) are available.
   - If CHECKOUT_STEP: Reassure about fast delivery, effortless returns, or answer sizing/material quality questions.
   - If CART_PAGE: Highlight the standout qualities of the items in their basket.
3. DISCOUNT POLICY: If a discount is offered, suggestedDiscountCode MUST not exceed ${input.merchantTone.discountCeilingPercentage}%. If discountCeilingPercentage is 0, suggestedDiscountCode MUST be null.
4. FORMAT: Return ONLY valid JSON matching this exact structure:
{
  "messageBody": "The full personalized message for WhatsApp or SMS",
  "callToActionUrl": "${input.checkoutUrl}",
  "suggestedDiscountCode": "DISCOUNT_CODE_OR_NULL",
  "urgencyLevel": "LOW" | "MED" | "HIGH",
  "reasoning": "Brief explanation of tone calibration and friction point addressed"
}`;
}

/**
 * Fallback deterministic generator when Gemini API is offline or unconfigured.
 */
export function generateDeterministicRecoveryCopy(input: RecoveryAgentInput): RecoveryAgentOutput {
  const name = input.customerName ? input.customerName.split(' ')[0] : 'there';
  const firstItem = input.items[0]?.title || 'your selected items';
  const isPaymentFailed = input.dropOffReason === 'PAYMENT_FAILED';
  const isHighUrgency = input.merchantTone.urgencyVsGentle > 0.6;
  const isFormal = input.merchantTone.casualVsFormal > 0.6;

  let discountCode: string | null = null;
  if (input.merchantTone.discountCeilingPercentage >= 10) {
    discountCode = `SAVE${Math.min(15, Math.floor(input.merchantTone.discountCeilingPercentage))}`;
  }

  const ctaUrl = discountCode 
    ? `${input.checkoutUrl}?discount=${discountCode}`
    : input.checkoutUrl;

  let body = '';
  let urgencyLevel: UrgencyLevel = 'MED';

  if (isPaymentFailed) {
    urgencyLevel = 'HIGH';
    if (isFormal) {
      body = `Hello ${name}, we noticed your recent transaction for the ${firstItem} was interrupted by a bank security review. Your selection has been reserved. You may complete your order securely via ${ctaUrl}`;
    } else {
      body = `Hi ${name}! It looks like your card payment for the ${firstItem} didn't go through — no worries at all! We've held your items so you don't lose your spot. Tap here to retry or use Apple Pay/PayPal: ${ctaUrl}`;
    }
  } else {
    urgencyLevel = isHighUrgency ? 'HIGH' : 'LOW';
    if (isFormal) {
      body = `Dear ${name}, thank you for visiting ${input.merchantTone.brandName}. Your cart containing the ${firstItem} is saved and ready for final review. Complete your purchase here: ${ctaUrl}`;
    } else {
      body = `Hey ${name}! You left the ${firstItem} in your cart at ${input.merchantTone.brandName}. ${discountCode ? `To make it easier, use code ${discountCode} for a special discount! ` : ''}Grab it here before stock runs out: ${ctaUrl}`;
    }
  }

  return {
    messageBody: body,
    callToActionUrl: ctaUrl,
    suggestedDiscountCode: discountCode,
    urgencyLevel,
    channel: 'WHATSAPP',
    reasoning: `Deterministic recovery calibrated for ${input.dropOffReason} with tone index ${input.merchantTone.casualVsFormal} and max discount ${input.merchantTone.discountCeilingPercentage}%`,
  };
}

/**
 * Executes the RecoveryAgent pipeline.
 */
export async function runRecoveryAgent(input: RecoveryAgentInput): Promise<RecoveryAgentOutput> {
  const gemini = getGeminiClient();

  if (!gemini) {
    return generateDeterministicRecoveryCopy(input);
  }

  const systemPrompt = buildRecoverySystemPrompt(input);

  try {
    const response = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: systemPrompt }],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3, // Low temperature for factual compliance
      },
    });

    const text = response.text || '';
    const parsed = JSON.parse(text);

    // Verify discount guardrail
    let discountCode = parsed.suggestedDiscountCode;
    if (input.merchantTone.discountCeilingPercentage <= 0) {
      discountCode = null;
    }

    return {
      messageBody: parsed.messageBody || generateDeterministicRecoveryCopy(input).messageBody,
      callToActionUrl: parsed.callToActionUrl || input.checkoutUrl,
      suggestedDiscountCode: discountCode,
      urgencyLevel: (parsed.urgencyLevel as UrgencyLevel) || 'MED',
      channel: 'WHATSAPP',
      reasoning: parsed.reasoning,
    };
  } catch {
    // Graceful fallback to deterministic engine on network or JSON parsing error
    return generateDeterministicRecoveryCopy(input);
  }
}
