import type { Merchant } from '@recoverflow/core';

export interface PublicMerchant {
  id: string;
  storeUrl: string;
  shopDomain?: string;
  storeName: string;
  currency?: string;
  brandToneGuidelines?: string;
  brandVoiceCasualVsFormal?: number;
  brandVoiceUrgencyVsGentle?: number;
  discountCeilingPercentage?: number;
  minMarginPercentage?: number;
  customVoiceId?: string;
  enableRazorpayRecovery?: boolean;
  enableShopifyRecovery?: boolean;
}

/**
 * Transforms a Merchant entity into a sanitized PublicMerchant object using
 * a strict explicit allowlist.
 *
 * Guarantees that internal and sensitive secrets (e.g. webhookSecret,
 * whatsappToken, encryptedWhatsappToken, shopifyAccessToken,
 * encryptedShopifyAccessToken, resendApiKey, encryptedResendApiKey,
 * geminiApiKey, encryptedGeminiApiKey) can NEVER be serialized or returned to clients.
 */
export function toPublicMerchant(
  merchant: Partial<Merchant> | null | undefined
): PublicMerchant | null {
  if (!merchant) return null;

  return {
    id: merchant.id || '',
    storeUrl: merchant.storeUrl || '',
    shopDomain: merchant.shopDomain,
    storeName: merchant.storeName || '',
    currency: merchant.currency,
    brandToneGuidelines: merchant.brandToneGuidelines,
    brandVoiceCasualVsFormal: merchant.brandVoiceCasualVsFormal,
    brandVoiceUrgencyVsGentle: merchant.brandVoiceUrgencyVsGentle,
    discountCeilingPercentage: merchant.discountCeilingPercentage,
    minMarginPercentage: merchant.minMarginPercentage,
    customVoiceId: merchant.customVoiceId,
    enableRazorpayRecovery: merchant.enableRazorpayRecovery,
    enableShopifyRecovery: merchant.enableShopifyRecovery,
  };
}
