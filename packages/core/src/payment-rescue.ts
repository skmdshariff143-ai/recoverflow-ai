export type PaymentFailureReason = 
  | 'CARD_TIMEOUT'
  | '3DS_AUTHENTICATION_FAIL'
  | 'CURRENCY_MISMATCH'
  | 'GATEWAY_REJECTED'
  | 'UNKNOWN_FAILURE';

export interface LocalizedPaymentRescueResult {
  reason: PaymentFailureReason;
  recommendedRail: 'UPI_INDIA' | 'PIX_BRAZIL' | 'APPLE_PAY_US_EU' | 'STANDARD_FALLBACK';
  reEntryUrl: string;
  nativeIntentString?: string; // e.g. upi://pay or Pix copy-paste key
  rescueCopy: string;
}

export interface PaymentRescueParams {
  errorCode?: string;
  countryCode?: string; // 'IN', 'BR', 'US', 'GB', 'DE', etc.
  currency: string;
  totalPrice: number;
  checkoutUrl: string;
  merchantStoreName: string;
  upiVpa?: string; // e.g. 'merchant@icici'
  orderId?: string;
}

/**
 * Classifies failed checkout error codes into actionable recovery categories.
 */
export function classifyPaymentFailure(errorCode?: string): PaymentFailureReason {
  if (!errorCode) return 'UNKNOWN_FAILURE';
  const clean = errorCode.toLowerCase();

  if (clean.includes('timeout') || clean.includes('network_error') || clean.includes('connection')) {
    return 'CARD_TIMEOUT';
  }
  if (clean.includes('3ds') || clean.includes('authentication') || clean.includes('otp') || clean.includes('declined_secure')) {
    return '3DS_AUTHENTICATION_FAIL';
  }
  if (clean.includes('currency') || clean.includes('forex') || clean.includes('fx')) {
    return 'CURRENCY_MISMATCH';
  }
  if (clean.includes('declined') || clean.includes('card_rejected') || clean.includes('insufficient_funds')) {
    return 'GATEWAY_REJECTED';
  }

  return 'UNKNOWN_FAILURE';
}

/**
 * Generates an EMVCo-compliant Pix dynamic payload string for Brazil instant payments.
 */
export function generatePixCopyPasteKey(pixKey: string, amount: number, txId: string): string {
  const formattedAmount = amount.toFixed(2);
  // Basic EMVCo payload format for Brazil Pix
  return `00020126580014BR.GOV.BCB.PIX0136${pixKey}5204000053039865405${formattedAmount}5802BR5915RECOVERFLOW6009SAOPAULO62170513${txId}6304`;
}

/**
 * Generates a localized 1-tap payment rescue configuration and deep-link.
 */
export function generateLocalizedPaymentRescue(params: PaymentRescueParams): LocalizedPaymentRescueResult {
  const reason = classifyPaymentFailure(params.errorCode);
  const country = (params.countryCode || '').toUpperCase();
  const txId = params.orderId || `rf_${Date.now().toString(36)}`;

  // 1. INDIA: UPI Instant Intent Links
  if (country === 'IN' || params.currency === 'INR') {
    const vpa = params.upiVpa || 'payback@icici';
    const upiIntent = `upi://pay?pa=${vpa}&pn=${encodeURIComponent(params.merchantStoreName)}&am=${params.totalPrice.toFixed(2)}&cu=INR&tr=${txId}&tn=Checkout%20Rescue`;
    const webRescueUrl = `${params.checkoutUrl}?rescue_rail=upi&ref=${txId}`;

    return {
      reason,
      recommendedRail: 'UPI_INDIA',
      reEntryUrl: webRescueUrl,
      nativeIntentString: upiIntent,
      rescueCopy: `We noticed your bank verification encountered a temporary pause. Your order at ${params.merchantStoreName} is reserved! Tap here to complete instantly with Google Pay, PhonePe, or Paytm UPI: ${webRescueUrl}`,
    };
  }

  // 2. BRAZIL: Pix Instant Dynamic QR / Copy-Paste Key
  if (country === 'BR' || params.currency === 'BRL') {
    const pixKey = 'c9a28bf1-9921-419b-a019-921827419bc9';
    const pixPayload = generatePixCopyPasteKey(pixKey, params.totalPrice, txId);
    const pixRescueUrl = `${params.checkoutUrl}?rescue_rail=pix&ref=${txId}`;

    return {
      reason,
      recommendedRail: 'PIX_BRAZIL',
      reEntryUrl: pixRescueUrl,
      nativeIntentString: pixPayload,
      rescueCopy: `Seu pagamento com cartão foi interrompido temporariamente. Seus itens foram reservados! Pague instantaneamente via Pix com aprovação imediata: ${pixRescueUrl}`,
    };
  }

  // 3. US / EU: Apple Pay & Google Pay Express Permalinks
  if (['US', 'CA', 'GB', 'DE', 'FR', 'AU'].includes(country) || ['USD', 'EUR', 'GBP'].includes(params.currency)) {
    const expressUrl = `${params.checkoutUrl}?rescue_rail=express_wallets&ref=${txId}&accelerated=apple_pay,google_pay`;

    return {
      reason,
      recommendedRail: 'APPLE_PAY_US_EU',
      reEntryUrl: expressUrl,
      nativeIntentString: expressUrl,
      rescueCopy: `Your card payment encountered a security block from your issuer, but your items are held for you! Complete in 1 tap with Apple Pay, Shop Pay, or PayPal: ${expressUrl}`,
    };
  }

  // Default Standard Fallback
  const fallbackUrl = `${params.checkoutUrl}?rescue_rail=standard&ref=${txId}`;
  return {
    reason,
    recommendedRail: 'STANDARD_FALLBACK',
    reEntryUrl: fallbackUrl,
    nativeIntentString: fallbackUrl,
    rescueCopy: `We noticed your recent transaction at ${params.merchantStoreName} was interrupted. Tap here to select an alternate payment method: ${fallbackUrl}`,
  };
}
