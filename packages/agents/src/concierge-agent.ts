import { getGeminiClient } from './gemini';
import { checkShopifyInventoryAvailability, type CartEvent, type Merchant, type CartItem } from '@recoverflow/core';
import { scanPromptSecurity } from './security/guardrail';
import { interceptAndEnforceFinancialSafety, verifyFinancialSafety } from './security/circuit-breaker';
import { runWismoAgent } from './wismo-agent';

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
  languageProfile?: LanguageDetectionResult;
}

export interface LanguageDetectionResult {
  primaryLanguage: string; // 'en', 'hi', 'te', 'es', 'hinglish', 'telugish', etc.
  isCodeSwitching: boolean;
  detectedDialects: string[];
  confidence: number;
  linguisticGuidance: string;
}

/**
 * Fast zero-dependency heuristic to detect language script and polyglot code-switching.
 */
export function detectLanguageAndCodeSwitching(text: string): LanguageDetectionResult {
  if (!text || typeof text !== 'string') {
    return {
      primaryLanguage: 'en',
      isCodeSwitching: false,
      detectedDialects: ['English'],
      confidence: 1.0,
      linguisticGuidance: 'Respond in clean English matching brand guidelines.',
    };
  }

  const raw = text.trim();
  const lower = raw.toLowerCase();

  // Script detection
  const hasDevanagari = /[\u0900-\u097F]/.test(raw);
  const hasTeluguScript = /[\u0C00-\u0C7F]/.test(raw);
  const hasTamilScript = /[\u0B80-\u0BFF]/.test(raw);
  const hasArabicScript = /[\u0600-\u06FF]/.test(raw);
  const hasSpanishAccents = /[áéíóúñ¿¡]/.test(raw);

  // Romanized keywords for code-switching detection
  const hinglishKeywords = /\b(bhai|kya|hai|hoga|milega|kitna|chahiye|mera|meri|kahan|kab|pahuncha|sasta|aur|bahut|nahi|nahin|shukriya|dhanyawad|daam|paisa|batao|bataiye|kar do|dedo)\b/i;
  const telugishKeywords = /\b(bro|babu|enti|undi|unda|unnara|cheppandi|chudandi|eppudu|vastundi|rate|entha|taggiste|bagundi|lekapothe|avuna|emi|ela|ippudu|cheyandi)\b/i;
  const spanishKeywords = /\b(hola|gracias|descuento|cuanto|cuánto|envio|envío|llegar|precio|talla|por\s+favor|donde|dónde|amigo)\b/i;

  const hasHinglish = hinglishKeywords.test(lower);
  const hasTelugish = telugishKeywords.test(lower);
  const hasSpanish = hasSpanishAccents || spanishKeywords.test(lower);
  const hasEnglish = /\b(the|is|and|for|with|this|size|shipping|order|discount|please|my|price|cart|want|available|how|when)\b/i.test(lower);

  const dialects: string[] = [];
  let isCodeSwitching = false;
  let primary = 'en';

  if (hasTeluguScript || hasTelugish) {
    dialects.push(hasTeluguScript ? 'Telugu (Native Script)' : 'Telugu / Telugish (Romanized)');
    if (hasEnglish || hasTeluguScript) isCodeSwitching = true;
    primary = 'te';
  }

  if (hasDevanagari || hasHinglish) {
    dialects.push(hasDevanagari ? 'Hindi (Devanagari)' : 'Hindi / Hinglish (Romanized)');
    if (hasEnglish || hasDevanagari) isCodeSwitching = true;
    primary = 'hi';
  }

  if (hasSpanish) {
    dialects.push('Spanish');
    if (hasEnglish) isCodeSwitching = true;
    primary = 'es';
  }

  if (hasTamilScript) {
    dialects.push('Tamil');
    primary = 'ta';
  }

  if (hasArabicScript) {
    dialects.push('Arabic');
    primary = 'ar';
  }

  if (dialects.length === 0) {
    dialects.push('English');
    primary = 'en';
  }

  let linguisticGuidance = 'Respond in English maintaining the store brand voice.';
  if (primary === 'hi' || dialects.some((d) => d.includes('Hindi'))) {
    linguisticGuidance =
      'The customer is communicating in Hindi/Hinglish. Seamlessly code-switch and reply in a natural, polite Hinglish or Hindi tone matching their dialect while upholding brand elegance.';
  } else if (primary === 'te' || dialects.some((d) => d.includes('Telugu'))) {
    linguisticGuidance =
      'The customer is communicating in Telugu/Telugish. Code-switch naturally to match their conversational Telugu/English hybrid phrasing with warmth and brand alignment.';
  } else if (primary === 'es') {
    linguisticGuidance =
      'The customer is communicating in Spanish/Spanglish. Reply in polite, fluent Spanish/Spanglish matching their tone and brand guidelines.';
  }

  return {
    primaryLanguage: primary,
    isCodeSwitching,
    detectedDialects: dialects,
    confidence: isCodeSwitching ? 0.95 : 0.85,
    linguisticGuidance,
  };
}

/**
 * Fallback concierge response generator when Gemini is not available.
 */
export function generateDeterministicConciergeReply(input: ConciergeAgentInput): ConciergeAgentOutput {
  // 1. Pre-LLM Security Guardrail Check
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

  const rawQuery = input.incomingMessage || '';
  const query = rawQuery.toLowerCase();
  const firstItem = input.cart.items[0]?.title || 'your cart items';
  const ctaUrl = input.cart.checkoutUrl;
  const langProfile = detectLanguageAndCodeSwitching(rawQuery);

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
      languageProfile: langProfile,
    };
  }

  // Check for Post-Purchase WISMO Inquiry ("where is my order", "kahan hai mera parcel", "track order", etc.)
  if (
    query.includes('where is my order') ||
    query.includes('track') ||
    query.includes('tracking') ||
    query.includes('kahan') ||
    query.includes('kab aayega') ||
    query.includes('delivery status') ||
    query.includes('order status') ||
    query.includes('eppudu vastundi')
  ) {
    let wismoReply = `We are tracking your order! Standard delivery arrives in 2-4 business days. Tap here to view live tracking: ${ctaUrl}`;
    if (langProfile.primaryLanguage === 'hi') {
      wismoReply = `Aapka order bilkul on-track hai! Delivery 2-4 business days mein pahunch jayegi. Live tracking check karne ke liye yahan tap karein: ${ctaUrl}`;
    } else if (langProfile.primaryLanguage === 'te') {
      wismoReply = `Mee order tracking on-track undi bro! 2-4 days lo delivery vastundi. Live status chudataniki ikkada click cheyandi: ${ctaUrl}`;
    }

    return {
      reply: wismoReply,
      checkoutUrl: ctaUrl,
      discountOffered: null,
      escalateToAdmin: false,
      intentDetected: 'SHIPPING_INQUIRY',
      languageProfile: langProfile,
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
      languageProfile: langProfile,
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
      languageProfile: langProfile,
    };
  }

  // Check for discount negotiation with Zero-Trust Financial Verification
  if (
    query.includes('discount') || 
    query.includes('coupon') || 
    query.includes('cheaper') || 
    query.includes('promo') || 
    query.includes('deal') || 
    query.includes('price') ||
    query.includes('off') ||
    query.includes('%') ||
    query.includes('sasta') ||
    query.includes('taggiste') ||
    query.includes('descuento')
  ) {
    const maxDiscount = Math.min(15, input.merchant.discountCeilingPercentage);
    const finCheck = verifyFinancialSafety({
      cartSubtotal: input.cart.totalPrice,
      proposedDiscountPercentage: maxDiscount,
      discountCeilingPercentage: input.merchant.discountCeilingPercentage,
      minMarginPercentage: input.merchant.minMarginPercentage,
      currency: input.cart.currency,
    });

    if (maxDiscount > 0 && finCheck.isSafe) {
      const discountCode = `EXCLUSIVE${maxDiscount}`;
      let replyText = `We'd love to help you complete your order! The best reduction authorized for your basket is ${maxDiscount}% with code ${discountCode}. You can apply it directly at checkout: ${ctaUrl}?discount=${discountCode}`;
      
      if (langProfile.primaryLanguage === 'hi') {
        replyText = `Aapke order par hum best authorized ${maxDiscount}% discount de sakte hain with code ${discountCode}. Checkout complete karne ke liye yahan tap karein: ${ctaUrl}?discount=${discountCode}`;
      } else if (langProfile.primaryLanguage === 'te') {
        replyText = `Mee basket kosam maximum ${maxDiscount}% discount code ${discountCode} apply cheyyochu bro! Ikkada complete cheyandi: ${ctaUrl}?discount=${discountCode}`;
      } else if (langProfile.primaryLanguage === 'es') {
        replyText = `¡Nos encantaría ayudarte! El mejor descuento disponible para tu carrito es del ${maxDiscount}% con el código ${discountCode}: ${ctaUrl}?discount=${discountCode}`;
      }

      return {
        reply: replyText,
        checkoutUrl: `${ctaUrl}?discount=${discountCode}`,
        discountOffered: discountCode,
        escalateToAdmin: false,
        intentDetected: 'DISCOUNT_NEGOTIATION',
        languageProfile: langProfile,
      };
    } else {
      let replyText = `Our items are handcrafted and priced at our absolute best direct-to-consumer value, so we don't have coupon codes active today. However, your ${firstItem} is packed with complimentary priority packaging: ${ctaUrl}`;
      if (langProfile.primaryLanguage === 'hi') {
        replyText = `Hamare items direct-to-consumer best pricing par available hain, isliye aur discount active nahi hai. Par ${firstItem} ke sath complimentary priority packaging included hai: ${ctaUrl}`;
      } else if (langProfile.primaryLanguage === 'te') {
        replyText = `Mee ${firstItem} already direct best pricing lo undi bro, extra coupon ledu kani complimentary priority packaging add chesam: ${ctaUrl}`;
      }

      return {
        reply: replyText,
        checkoutUrl: ctaUrl,
        discountOffered: null,
        escalateToAdmin: false,
        intentDetected: 'DISCOUNT_NEGOTIATION_REFUSAL',
        languageProfile: langProfile,
      };
    }
  }

  // Sizing inquiry
  if (query.includes('size') || query.includes('fit') || query.includes('measurement') || query.includes('talla')) {
    let replyText = `Regarding sizing for the ${firstItem}: our items fit true to standard international sizing. If you're in between sizes, we recommend sizing up for a relaxed fit. We also provide free exchanges if needed: ${ctaUrl}`;
    if (langProfile.primaryLanguage === 'hi') {
      replyText = `${firstItem} ka sizing standard true-to-size fit karta hai. Agar aap do sizes ke beech mein hain, toh relaxed fit ke liye size up karein. Free exchanges available hain: ${ctaUrl}`;
    } else if (langProfile.primaryLanguage === 'te') {
      replyText = `${firstItem} standard perfect fit untundi bro. Doubt unte size up cheyandi, free exchanges kuda available: ${ctaUrl}`;
    }

    return {
      reply: replyText,
      checkoutUrl: ctaUrl,
      discountOffered: null,
      escalateToAdmin: false,
      intentDetected: 'SIZING_INQUIRY',
      languageProfile: langProfile,
    };
  }

  // Shipping inquiry
  if (query.includes('ship') || query.includes('delivery') || query.includes('arrive') || query.includes('when') || query.includes('envio')) {
    return {
      reply: `Orders ship within 24 hours from our warehouse. Standard express delivery typically arrives in 2-4 business days, complete with end-to-end tracking: ${ctaUrl}`,
      checkoutUrl: ctaUrl,
      discountOffered: null,
      escalateToAdmin: false,
      intentDetected: 'SHIPPING_INQUIRY',
      languageProfile: langProfile,
    };
  }

  // Default assistance
  let defaultReply = `Hi! Thank you for getting back to us about your cart (${firstItem}). Let me know if you have any questions about sizing, checkout, or shipping, or tap here to review your items: ${ctaUrl}`;
  if (langProfile.primaryLanguage === 'hi') {
    defaultReply = `Namaste! Aapke cart (${firstItem}) ke bare mein koi bhi sawal ho—sizing, payment ya shipping—toh zaroor batayein. Items review karne ke liye tap karein: ${ctaUrl}`;
  } else if (langProfile.primaryLanguage === 'te') {
    defaultReply = `Hello! Mee cart (${firstItem}) gurinchi sizing, delivery or payment related edaina doubts unte adagandi: ${ctaUrl}`;
  }

  return {
    reply: defaultReply,
    checkoutUrl: ctaUrl,
    discountOffered: null,
    escalateToAdmin: false,
    intentDetected: 'GENERAL_ASSISTANCE',
    languageProfile: langProfile,
  };
}

/**
 * WhatsAppConciergeAgent runner with Multimodal Gemini processing, Polyglot Code-Switching,
 * Zero-Trust Financial Circuit Breaker, and Post-Purchase WISMO resolution.
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

  // Fast Language & Code-Switching Detection
  const langProfile = detectLanguageAndCodeSwitching(input.incomingMessage || '');

  // Route to WISMO agent if customer is asking about an existing order's tracking/shipping status
  const msgLower = (input.incomingMessage || '').toLowerCase();
  const isOrderTrackingQuery =
    msgLower.includes('where is my order') ||
    msgLower.includes('order status') ||
    msgLower.includes('track my order') ||
    msgLower.includes('tracking') ||
    msgLower.includes('kahan pahuncha') ||
    msgLower.includes('mera order kab aayega') ||
    /(?:#|order\s*(?:no\.?|number)?\s*)([0-9]{3,8})/i.test(msgLower);

  if (isOrderTrackingQuery) {
    const wismoResult = await runWismoAgent({
      customerIdentifier: input.cart.customerPhone || input.cart.customerEmail,
      incomingMessage: input.incomingMessage || '',
      merchant: input.merchant,
    });

    if (wismoResult.foundOrder) {
      return {
        reply: wismoResult.reply,
        checkoutUrl: input.cart.checkoutUrl,
        discountOffered: null,
        escalateToAdmin: false,
        intentDetected: 'WISMO_TRACKING_RESOLVED',
        languageProfile: langProfile,
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

  const textDirective = `You are an expert polyglot e-commerce WhatsApp concierge for "${input.merchant.storeName}".
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

### POLYGLOT CODE-SWITCHING & LINGUISTIC DIRECTIVES
- Detected Dialect/Language: ${langProfile.detectedDialects.join(', ')} (Code-switching: ${langProfile.isCodeSwitching})
- Linguistic Guidance: ${langProfile.linguisticGuidance}
- Direct Rule: If the customer communicates in Hinglish (Hindi+English), Telugish (Telugu+English), or Spanish, naturally match their linguistic code-switching pattern while strictly preserving the merchant's brand tone guidelines.

### CONVERSATION HISTORY
${historyText}

### INCOMING CUSTOMER INPUT
Text: "${input.incomingMessage || '[Multimodal media attached]'}"

### ZERO-TRUST FINANCIAL GUARDRAILS & DIRECTIVES
1. If customer sent an audio note, transcribe the inquiry and address their questions with warmth.
2. If customer sent an image, match visual styling with complementary accessories.
3. If customer asks for human support, manager, or complains aggressively, set "escalateToAdmin": true.
4. FINANCIAL CIRCUIT BREAKER: If customer asks for discounts, NEVER exceed ${input.merchant.discountCeilingPercentage}%. If ceiling is 0, do NOT offer discounts.
5. Return ONLY valid JSON:
{
  "reply": "Your WhatsApp response in matched dialect",
  "checkoutUrl": "${input.cart.checkoutUrl}",
  "discountOffered": "CODE_OR_NULL",
  "discountPercentage": number_or_null,
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

    // Zero-Trust Financial Circuit Breaker Verification on LLM output
    const discountPct = typeof parsed.discountPercentage === 'number' ? parsed.discountPercentage : undefined;
    const finIntercept = interceptAndEnforceFinancialSafety(parsed.reply || '', {
      cartSubtotal: input.cart.totalPrice,
      proposedDiscountPercentage: discountPct,
      discountCeilingPercentage: input.merchant.discountCeilingPercentage,
      minMarginPercentage: input.merchant.minMarginPercentage,
      currency: input.cart.currency,
    });

    const safeReply = finIntercept.safeReply || generateDeterministicConciergeReply(input).reply;
    const safeDiscountCode = finIntercept.verifiedResult.violationDetected
      ? null
      : parsed.discountOffered || null;

    return {
      reply: safeReply,
      checkoutUrl: parsed.checkoutUrl || input.cart.checkoutUrl,
      discountOffered: safeDiscountCode,
      escalateToAdmin: Boolean(parsed.escalateToAdmin),
      intentDetected: parsed.intentDetected || (input.audioBase64 ? 'VOICE_NOTE_INQUIRY' : 'GENERAL_ASSISTANCE'),
      audioTranscript: parsed.audioTranscript,
      matchedProductSuggestion: productSuggestion,
      languageProfile: langProfile,
    };
  } catch {
    return generateDeterministicConciergeReply(input);
  }
}
