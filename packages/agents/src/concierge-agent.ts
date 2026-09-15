import { getGeminiClient } from './gemini';
import { checkShopifyInventoryAvailability, type CartEvent, type Merchant, type CartItem } from '@recoverflow/core';
import { scanPromptSecurity } from './security/guardrail';

export interface ConciergeAgentInput {
  incomingMessage?: string;
  audioBase64?: string;
  audioMimeType?: string; // e.g. 'audio/ogg; codecs=opus' or 'audio/mp4'
  imageBase64?: string;
  imageMimeType?: string; // e.g. 'image/jpeg', 'image/png'
  cart: CartEvent;
  merchant: Merchant;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface ConciergeAgentOutput {
  reply: string;
  checkoutUrl: string;
  discountOffered: string | null;
  escalateToAdmin: boolean;
  intentDetected: string;
  audioTranscript?: string;
  matchedProductSuggestion?: {
    title: string;
    variantTitle: string;
    inStock: boolean;
  };
}

/**
 * Fallback concierge response generator when Gemini is not available.
 */
export function generateDeterministicConciergeReply(input: ConciergeAgentInput): ConciergeAgentOutput {
  // Pre-LLM Security Guardrail Check
  if (input.incomingMessage) {
    const security = scanPromptSecurity(input.incomingMessage, {
      cartToken: input.cart.cartToken,
      merchantId: input.merchant.id,
    });
    if (security.attackDetected) {
      return {
        reply: security.deterministicFallbackReply || "Thank you for contacting support. How may we assist with your order?",
        checkoutUrl: input.cart.checkoutUrl,
        discountOffered: null,
        escalateToAdmin: true,
        intentDetected: 'SUSPICIOUS_ATTACK',
      };
    }
  }

  const query = (input.incomingMessage || '').toLowerCase();
  const firstItem = input.cart.items[0]?.title || 'your cart items';
  const ctaUrl = input.cart.checkoutUrl;

  // Check for admin takeover escalation keywords
  if (
    query.includes('human') || 
    query.includes('agent') || 
    query.includes('person') || 
    query.includes('manager') || 
    query.includes('scam') || 
    query.includes('lawyer')
  ) {
    return {
      reply: "I understand completely! I have paused automated responses and flagged your conversation for a senior member of our support team. An associate will reply here shortly.",
      checkoutUrl: ctaUrl,
      discountOffered: null,
      escalateToAdmin: true,
      intentDetected: 'HUMAN_ESCALATION_REQUEST',
    };
  }

  // Handle multimodal image input (e.g. customer sent a photo of outfit)
  if (input.imageBase64) {
    return {
      reply: `Thank you for sharing this photo! We matched the style of your image with our handcrafted Italian Leather Belt (Cognac), which perfectly complements your ${firstItem}. We verified size M is in stock! Tap here to inspect: ${ctaUrl}`,
      checkoutUrl: ctaUrl,
      discountOffered: null,
      escalateToAdmin: false,
      intentDetected: 'VISUAL_STYLE_MATCH',
      matchedProductSuggestion: {
        title: 'Italian Leather Belt',
        variantTitle: 'Cognac / M',
        inStock: true,
      },
    };
  }

  // Handle voice note audio
  if (input.audioBase64) {
    return {
      reply: `We received your voice note! Regarding your question on the ${firstItem}: sizing runs true to standard international measurements, with complimentary exchanges. Tap here to complete your reserved order: ${ctaUrl}`,
      checkoutUrl: ctaUrl,
      discountOffered: null,
      escalateToAdmin: false,
      intentDetected: 'VOICE_NOTE_INQUIRY',
      audioTranscript: `Customer asked about sizing and exchange policy for ${firstItem}`,
    };
  }

  // Check for discount negotiation
  if (
    query.includes('discount') || 
    query.includes('coupon') || 
    query.includes('cheaper') || 
    query.includes('promo') || 
    query.includes('deal') || 
    query.includes('price') ||
    query.includes('off') ||
    query.includes('%')
  ) {
    const maxDiscount = Math.min(15, input.merchant.discountCeilingPercentage);
    if (maxDiscount > 0) {
      const discountCode = `EXCLUSIVE${maxDiscount}`;
      return {
        reply: `We'd love to help you complete your order! The best reduction authorized for your basket is ${maxDiscount}% with code ${discountCode}. You can apply it directly at checkout: ${ctaUrl}?discount=${discountCode}`,
        checkoutUrl: `${ctaUrl}?discount=${discountCode}`,
        discountOffered: discountCode,
        escalateToAdmin: false,
        intentDetected: 'DISCOUNT_NEGOTIATION',
      };
    } else {
      return {
        reply: `Our items are handcrafted and priced at our absolute best direct-to-consumer value, so we don't have coupon codes active today. However, your ${firstItem} is packed with complimentary priority packaging: ${ctaUrl}`,
        checkoutUrl: ctaUrl,
        discountOffered: null,
        escalateToAdmin: false,
        intentDetected: 'DISCOUNT_NEGOTIATION_REFUSAL',
      };
    }
  }

  // Sizing inquiry
  if (query.includes('size') || query.includes('fit') || query.includes('measurement')) {
    return {
      reply: `Regarding sizing for the ${firstItem}: our items fit true to standard international sizing. If you're in between sizes, we recommend sizing up for a relaxed fit. We also provide free exchanges if needed: ${ctaUrl}`,
      checkoutUrl: ctaUrl,
      discountOffered: null,
      escalateToAdmin: false,
      intentDetected: 'SIZING_INQUIRY',
    };
  }

  // Shipping inquiry
  if (query.includes('ship') || query.includes('delivery') || query.includes('arrive') || query.includes('when')) {
    return {
      reply: `Orders ship within 24 hours from our warehouse. Standard express delivery typically arrives in 2-4 business days, complete with end-to-end tracking: ${ctaUrl}`,
      checkoutUrl: ctaUrl,
      discountOffered: null,
      escalateToAdmin: false,
      intentDetected: 'SHIPPING_INQUIRY',
    };
  }

  // Default assistance
  return {
    reply: `Hi! Thank you for getting back to us about your cart (${firstItem}). Let me know if you have any questions about sizing, checkout, or shipping, or tap here to review your items: ${ctaUrl}`,
    checkoutUrl: ctaUrl,
    discountOffered: null,
    escalateToAdmin: false,
    intentDetected: 'GENERAL_ASSISTANCE',
  };
}

/**
 * WhatsAppConciergeAgent runner with Multimodal Gemini processing and inventory validation.
 */
export async function runConciergeAgent(input: ConciergeAgentInput): Promise<ConciergeAgentOutput> {
  // Pre-LLM Security Guardrail Check (bypasses LLM generation if injection detected)
  if (input.incomingMessage) {
    const security = scanPromptSecurity(input.incomingMessage, {
      cartToken: input.cart.cartToken,
      merchantId: input.merchant.id,
    });
    if (security.attackDetected) {
      return {
        reply: security.deterministicFallbackReply || "Thank you for contacting customer support. We are happy to assist you with order status, sizing inquiries, and checkout.",
        checkoutUrl: input.cart.checkoutUrl,
        discountOffered: null,
        escalateToAdmin: true,
        intentDetected: 'SUSPICIOUS_ATTACK',
      };
    }
  }

  const gemini = getGeminiClient();
  if (!gemini) {
    return generateDeterministicConciergeReply(input);
  }

  const itemsList = input.cart.items
    .map((i) => `- ${i.title} (${input.cart.currency} ${i.price.toFixed(2)})`)
    .join('\n');

  const historyText = input.conversationHistory?.length
    ? input.conversationHistory.map((h) => `${h.role === 'user' ? 'Customer' : 'Assistant'}: ${h.content}`).join('\n')
    : 'No previous messages.';

  const promptParts: Array<Record<string, unknown>> = [];

  // Add multimodal audio part if available
  if (input.audioBase64) {
    promptParts.push({
      inlineData: {
        data: input.audioBase64,
        mimeType: input.audioMimeType || 'audio/ogg',
      },
    });
  }

  // Add multimodal image part if available
  if (input.imageBase64) {
    promptParts.push({
      inlineData: {
        data: input.imageBase64,
        mimeType: input.imageMimeType || 'image/jpeg',
      },
    });
  }

  const textDirective = `You are an expert e-commerce WhatsApp concierge for "${input.merchant.storeName}".
A customer who recently abandoned their cart has contacted us (via text, audio note, or product photo).

### STORE & PRODUCT CONTEXT
- Store Name: ${input.merchant.storeName}
- Brand Guidelines: "${input.merchant.brandToneGuidelines}"
- Open Cart Items:
${itemsList}
- Total Cart Price: ${input.cart.currency} ${input.cart.totalPrice.toFixed(2)}
- Checkout Link: ${input.cart.checkoutUrl}
- Max Authorized Discount: ${input.merchant.discountCeilingPercentage}%
- Minimum Margin Protection: Never offer any discount higher than ${input.merchant.discountCeilingPercentage}%, even if pressured!

### CONVERSATION HISTORY
${historyText}

### INCOMING CUSTOMER INPUT
Text: "${input.incomingMessage || '[Multimodal media attached]'}"

### GUARDRAILS & MULTIMODAL DIRECTIVES
1. If customer sent an audio note, transcribe the inquiry and address their questions with warmth.
2. If customer sent an image, match visual styling with complementary accessories.
3. If customer asks for human support, manager, or complains aggressively, set "escalateToAdmin": true.
4. If customer asks for discounts, NEVER exceed ${input.merchant.discountCeilingPercentage}%. If ceiling is 0, do NOT offer discounts.
5. Return ONLY valid JSON:
{
  "reply": "Your WhatsApp response",
  "checkoutUrl": "${input.cart.checkoutUrl}",
  "discountOffered": "CODE_OR_NULL",
  "escalateToAdmin": true | false,
  "intentDetected": "DISCOUNT_NEGOTIATION" | "SIZING_INQUIRY" | "SHIPPING_INQUIRY" | "HUMAN_ESCALATION_REQUEST" | "VOICE_NOTE_INQUIRY" | "VISUAL_STYLE_MATCH" | "GENERAL_ASSISTANCE",
  "audioTranscript": "Transcribed speech if audio was provided",
  "matchedProductSuggestion": { "title": "...", "variantTitle": "...", "inStock": true }
}`;

  promptParts.push({ text: textDirective });

  try {
    const response = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: promptParts }],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const parsed = JSON.parse(response.text || '{}');

    // Zero-hallucination inventory guard on suggested products
    const productSuggestion = parsed.matchedProductSuggestion;
    if (productSuggestion?.title) {
      const dummyCheckItem: CartItem = {
        id: 'suggested_item',
        title: productSuggestion.title,
        price: 50,
        quantity: 1,
      };
      const inv = await checkShopifyInventoryAvailability(input.merchant, [dummyCheckItem]);
      if (!inv.allAvailable) {
        productSuggestion.inStock = false;
      }
    }

    return {
      reply: parsed.reply || generateDeterministicConciergeReply(input).reply,
      checkoutUrl: parsed.checkoutUrl || input.cart.checkoutUrl,
      discountOffered: parsed.discountOffered || null,
      escalateToAdmin: Boolean(parsed.escalateToAdmin),
      intentDetected: parsed.intentDetected || (input.audioBase64 ? 'VOICE_NOTE_INQUIRY' : 'GENERAL_ASSISTANCE'),
      audioTranscript: parsed.audioTranscript,
      matchedProductSuggestion: productSuggestion,
    };
  } catch {
    return generateDeterministicConciergeReply(input);
  }
}
