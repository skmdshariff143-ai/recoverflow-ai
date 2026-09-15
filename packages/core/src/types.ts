export type CartStatus = 'ABANDONED' | 'CONTACTED' | 'RECOVERED' | 'EXPIRED' | 'OUT_OF_STOCK_ABORTED';
export type AbandonmentType = 'CHECKOUT_STEP' | 'PAYMENT_FAILED' | 'CART_PAGE';
export type RecoveryStage = 'QUEUED' | 'WHATSAPP_SENT' | 'EMAIL_FALLBACK' | 'CONCIERGE_ACTIVE' | 'RECOVERED' | 'EXPIRED' | 'OUT_OF_STOCK_ABORTED';
export type MessageChannel = 'WHATSAPP' | 'EMAIL';
export type MessageDirection = 'OUTBOUND' | 'INBOUND';
export type DeliveryStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'REPLIED' | 'FAILED';
export type SuppressionType = 'PHONE' | 'EMAIL';
export type UrgencyLevel = 'LOW' | 'MED' | 'HIGH';

export interface CartItem {
  id: string;
  variantId?: string;
  title: string;
  variantTitle?: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  productUrl?: string;
}

export interface Merchant {
  id: string;
  storeUrl: string;
  shopDomain?: string;
  storeName: string;
  webhookSecret: string;
  shopifyScopes?: string[];
  shopifyAccessToken?: string;
  encryptedShopifyAccessToken?: string;
  whatsappToken?: string;
  encryptedWhatsappToken?: string;
  whatsappPhoneId?: string;
  whatsappTemplateName?: string;
  resendApiKey?: string;
  encryptedResendApiKey?: string;
  fromEmail?: string;
  brandToneGuidelines: string;
  brandVoiceCasualVsFormal: number; // 0.0 (Very Casual) to 1.0 (Very Formal)
  brandVoiceUrgencyVsGentle: number; // 0.0 (Gentle/Supportive) to 1.0 (High Urgency)
  discountCeilingPercentage: number; // e.g. 15 for 15%
  minMarginPercentage: number; // e.g. 20 for 20%
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface CartEvent {
  id: string;
  cartToken: string;
  merchantId: string;
  customerPhone?: string;
  customerEmail?: string;
  customerName?: string;
  currency: string;
  totalPrice: number;
  items: CartItem[];
  status: CartStatus;
  abandonmentType: AbandonmentType;
  recoveryStage: RecoveryStage;
  checkoutUrl: string;
  suggestedDiscountCode?: string | null;
  recoveredAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface MessageLog {
  id: string;
  cartEventId?: string;
  merchantId: string;
  channel: MessageChannel;
  direction: MessageDirection;
  content: string;
  tokensUsed?: number;
  latencyMs?: number;
  deliveryStatus: DeliveryStatus;
  externalMessageId?: string;
  createdAt: string | Date;
}

export interface SuppressionEntry {
  id: string;
  identifier: string; // phone in E.164 format or normalized email
  type: SuppressionType;
  reason: 'USER_UNSUBSCRIBE' | 'BOUNCE' | 'COMPLAINT' | 'MANUAL';
  optedOutAt: string | Date;
  merchantId: string;
}

export interface RecoveryAgentInput {
  customerName?: string;
  items: CartItem[];
  totalValue: number;
  currency: string;
  dropOffReason: AbandonmentType;
  checkoutUrl: string;
  merchantTone: {
    brandName: string;
    guidelines: string;
    casualVsFormal: number;
    urgencyVsGentle: number;
    discountCeilingPercentage: number;
  };
}

export interface RecoveryAgentOutput {
  messageBody: string;
  callToActionUrl: string;
  suggestedDiscountCode: string | null;
  urgencyLevel: UrgencyLevel;
  channel: MessageChannel;
  reasoning?: string;
}

export interface ConciergeMessage {
  role: 'user' | 'assistant' | 'admin';
  content: string;
  timestamp: string | Date;
}

export interface ConciergeSession {
  sessionId: string;
  cartEventId: string;
  customerPhone: string;
  customerName?: string;
  merchantId: string;
  history: ConciergeMessage[];
  isAdminTakenOver: boolean;
  takeoverExpiresAt?: number;
  activeCart: CartEvent;
  lastInteractionAt: string | Date;
}

export interface SingleUseDiscountConfig {
  merchantId: string;
  cartToken: string;
  discountPercentage: number;
  minSubtotalAmount: number;
  currency: string;
  durationHours?: number; // default 2 hours
}

export interface DiscountCodeResult {
  code: string;
  discountPercentage: number;
  expiresAt: Date;
  subtotalMinimum: number;
}

export interface InventoryCheckResult {
  allAvailable: boolean;
  unavailableItems: string[];
}

export interface ShopifyGdprPayload {
  shop_id: number;
  shop_domain: string;
  customer?: {
    id: number;
    email?: string;
    phone?: string;
  };
  orders_to_redact?: number[];
}

export type OutboxStatus = 'PENDING' | 'PROCESSING' | 'PUBLISHED' | 'FAILED';

export interface OutboxEvent {
  id: string;
  aggregateType: string; // e.g. 'CartEvent', 'MessageLog'
  aggregateId: string;
  eventType: string;     // e.g. 'CART_ABANDONED', 'PAYMENT_FAILED', 'DISCOUNT_APPLIED'
  payload: unknown;
  idempotencyKey: string; // sha256(shopDomain + cartToken + eventTimestamp)
  status: OutboxStatus;
  retryCount: number;
  createdAt: string | Date;
  processedAt?: string | Date | null;
}

export interface SecurityIncident {
  id: string;
  cartToken?: string;
  merchantId?: string;
  attackType: string;
  flaggedPatterns: string[];
  rawInput: string;
  normalizedInput: string;
  riskScore: number;
  createdAt: string | Date;
}
