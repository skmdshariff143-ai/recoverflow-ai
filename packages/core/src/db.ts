import crypto from 'crypto';
import type {
  Merchant,
  CartEvent,
  MessageLog,
  SuppressionEntry,
  CartStatus,
  RecoveryStage,
  OutboxEvent,
  SecurityIncident,
} from './types';
import { encryptCredential } from './crypto';

export class MemoryDatabase {
  public merchants = new Map<string, Merchant>();
  public cartEvents = new Map<string, CartEvent>();
  public messageLogs = new Map<string, MessageLog>();
  public suppressions = new Map<string, SuppressionEntry>();
  public takeoverLocks = new Map<string, number>(); // cartId -> expiration timestamp
  public outboxEvents = new Map<string, OutboxEvent>();
  public securityIncidents = new Map<string, SecurityIncident>();

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults() {
    // Default Merchant with encrypted tokens
    const defaultMerchant: Merchant = {
      id: 'merchant_default_01',
      storeUrl: 'https://aurora-apparel.myshopify.com',
      shopDomain: 'aurora-apparel.myshopify.com',
      storeName: 'Aurora Luxury Apparel',
      webhookSecret: process.env.SHOPIFY_WEBHOOK_SECRET || 'shpss_test_secret_key_99182',
      shopifyScopes: ['read_checkouts', 'read_orders', 'write_discounts', 'read_products', 'read_inventory'],
      encryptedShopifyAccessToken: encryptCredential('shpat_live_mock_token_99182'),
      whatsappToken: process.env.WHATSAPP_API_TOKEN || 'EAAG_test_token_mock',
      encryptedWhatsappToken: encryptCredential(process.env.WHATSAPP_API_TOKEN || 'EAAG_test_token_mock'),
      whatsappPhoneId: process.env.WHATSAPP_PHONE_NUMBER_ID || '1088291029102',
      whatsappTemplateName: 'recoverflow_abandoned_cart_v1',
      resendApiKey: process.env.RESEND_API_KEY || 're_test_mock_key',
      encryptedResendApiKey: encryptCredential(process.env.RESEND_API_KEY || 're_test_mock_key'),
      fromEmail: 'vip@aurora-apparel.com',
      brandToneGuidelines: 'Sophisticated, warm, concise, highlighting craftsmanship and customer care.',
      brandVoiceCasualVsFormal: 0.7, // Leaning formal/elegant
      brandVoiceUrgencyVsGentle: 0.35, // Polite & respectful
      discountCeilingPercentage: 15.0, // Max 15% discount
      minMarginPercentage: 25.0, // Never sell below 25% margin
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date(),
    };
    this.merchants.set(defaultMerchant.id, defaultMerchant);

    // Sample initial cart events for realistic demonstration
    const sampleCart1: CartEvent = {
      id: 'cart_evt_001',
      cartToken: 'tok_shpfy_99214a',
      merchantId: defaultMerchant.id,
      customerName: 'Sarah Jenkins',
      customerPhone: '+14155552671',
      customerEmail: 'sarah.jenkins@gmail.com',
      currency: 'USD',
      totalPrice: 285.0,
      items: [
        {
          id: 'item_01',
          variantId: 'gid://shopify/ProductVariant/4412019128',
          title: 'Cashmere Ribbed Knit Cardigan',
          variantTitle: 'Ivory / Small',
          price: 195.0,
          quantity: 1,
          imageUrl: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&q=80',
          productUrl: 'https://aurora-apparel.myshopify.com/products/cashmere-cardigan',
        },
        {
          id: 'item_02',
          variantId: 'gid://shopify/ProductVariant/4412019129',
          title: 'Silk Minimalist Scarf',
          variantTitle: 'Champagne Gold',
          price: 90.0,
          quantity: 1,
          imageUrl: 'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=400&q=80',
          productUrl: 'https://aurora-apparel.myshopify.com/products/silk-scarf',
        },
      ],
      status: 'ABANDONED',
      abandonmentType: 'CHECKOUT_STEP',
      recoveryStage: 'QUEUED',
      checkoutUrl: 'https://aurora-apparel.myshopify.com/checkouts/c/tok_shpfy_99214a/recover',
      createdAt: new Date(Date.now() - 1000 * 60 * 18),
      updatedAt: new Date(Date.now() - 1000 * 60 * 18),
    };

    const sampleCart2: CartEvent = {
      id: 'cart_evt_002',
      cartToken: 'tok_shpfy_88192b',
      merchantId: defaultMerchant.id,
      customerName: 'Marcus Vance',
      customerPhone: '+12065550192',
      customerEmail: 'marcus.vance@techcorp.io',
      currency: 'USD',
      totalPrice: 420.0,
      items: [
        {
          id: 'item_03',
          variantId: 'gid://shopify/ProductVariant/4412019130',
          title: 'Structured Wool Overcoat',
          variantTitle: 'Charcoal Grey / 42R',
          price: 420.0,
          quantity: 1,
          imageUrl: 'https://images.unsplash.com/photo-1544022613-e87ce7526edb?w=400&q=80',
          productUrl: 'https://aurora-apparel.myshopify.com/products/wool-overcoat',
        },
      ],
      status: 'CONTACTED',
      abandonmentType: 'PAYMENT_FAILED',
      recoveryStage: 'WHATSAPP_SENT',
      checkoutUrl: 'https://aurora-apparel.myshopify.com/checkouts/c/tok_shpfy_88192b/recover',
      suggestedDiscountCode: 'AURORA10',
      createdAt: new Date(Date.now() - 1000 * 60 * 45),
      updatedAt: new Date(Date.now() - 1000 * 60 * 20),
    };

    const sampleCart3: CartEvent = {
      id: 'cart_evt_003',
      cartToken: 'tok_shpfy_77401c',
      merchantId: defaultMerchant.id,
      customerName: 'Elena Rostova',
      customerPhone: '+13125557812',
      customerEmail: 'elena.rostova@designstudio.org',
      currency: 'USD',
      totalPrice: 160.0,
      items: [
        {
          id: 'item_04',
          variantId: 'gid://shopify/ProductVariant/4412019131',
          title: 'Italian Leather Crossbody',
          variantTitle: 'Cognac Brown',
          price: 160.0,
          quantity: 1,
          imageUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&q=80',
          productUrl: 'https://aurora-apparel.myshopify.com/products/leather-crossbody',
        },
      ],
      status: 'RECOVERED',
      abandonmentType: 'CHECKOUT_STEP',
      recoveryStage: 'RECOVERED',
      checkoutUrl: 'https://aurora-apparel.myshopify.com/checkouts/c/tok_shpfy_77401c/recover',
      suggestedDiscountCode: 'AURORA10',
      recoveredAt: new Date(Date.now() - 1000 * 60 * 15),
      createdAt: new Date(Date.now() - 1000 * 60 * 95),
      updatedAt: new Date(Date.now() - 1000 * 60 * 15),
    };

    this.cartEvents.set(sampleCart1.id, sampleCart1);
    this.cartEvents.set(sampleCart2.id, sampleCart2);
    this.cartEvents.set(sampleCart3.id, sampleCart3);

    const sampleLog: MessageLog = {
      id: 'msg_log_001',
      cartEventId: sampleCart2.id,
      merchantId: defaultMerchant.id,
      channel: 'WHATSAPP',
      direction: 'OUTBOUND',
      content: 'Hi Marcus, your payment for the Structured Wool Overcoat encountered a temporary card security block. We reserved your size in Charcoal 42R. Tap here to complete securely with Apple Pay or PayPal: https://aurora-apparel.myshopify.com/checkouts/c/tok_shpfy_88192b/recover?discount=AURORA10',
      tokensUsed: 142,
      latencyMs: 380,
      deliveryStatus: 'DELIVERED',
      externalMessageId: 'wamid.HBgLMTIwNjU1NTAxOTIVAgARGBI1',
      createdAt: new Date(Date.now() - 1000 * 60 * 20),
    };
    this.messageLogs.set(sampleLog.id, sampleLog);
  }

  // Merchant methods
  async getMerchant(id: string): Promise<Merchant | null> {
    return this.merchants.get(id) || null;
  }

  async getMerchantById(id: string): Promise<Merchant | null> {
    return this.getMerchant(id);
  }

  async getMerchantByStoreUrl(storeUrl: string): Promise<Merchant | null> {
    const cleanUrl = storeUrl.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    for (const m of this.merchants.values()) {
      const mClean = m.storeUrl.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
      if (mClean === cleanUrl || (m.shopDomain && m.shopDomain.toLowerCase() === cleanUrl)) {
        return m;
      }
    }
    return null;
  }

  async getMerchantByShopDomain(shopDomain: string): Promise<Merchant | null> {
    const clean = shopDomain.toLowerCase().trim();
    for (const m of this.merchants.values()) {
      if (m.shopDomain && m.shopDomain.toLowerCase() === clean) {
        return m;
      }
      if (m.storeUrl.toLowerCase().includes(clean)) {
        return m;
      }
    }
    return null;
  }

  async upsertMerchant(merchant: Merchant): Promise<Merchant> {
    this.merchants.set(merchant.id, {
      ...merchant,
      updatedAt: new Date(),
    });
    return merchant;
  }

  async updateMerchantTone(
    id: string,
    updates: Partial<Pick<Merchant, 'brandVoiceCasualVsFormal' | 'brandVoiceUrgencyVsGentle' | 'discountCeilingPercentage' | 'brandToneGuidelines'>>
  ): Promise<Merchant | null> {
    const m = this.merchants.get(id);
    if (!m) return null;
    const updated = { ...m, ...updates, updatedAt: new Date() };
    this.merchants.set(id, updated);
    return updated;
  }

  // Cart methods
  async getCartByToken(cartToken: string): Promise<CartEvent | null> {
    for (const c of this.cartEvents.values()) {
      if (c.cartToken === cartToken) return c;
    }
    return null;
  }

  async getCartById(id: string): Promise<CartEvent | null> {
    return this.cartEvents.get(id) || null;
  }

  async findCartByCustomerOrToken(identifier: string): Promise<CartEvent | null> {
    const clean = identifier.toLowerCase().trim();
    for (const c of this.cartEvents.values()) {
      if (c.cartToken.toLowerCase() === clean) return c;
      if (c.customerEmail && c.customerEmail.toLowerCase() === clean) return c;
      if (c.customerPhone && c.customerPhone.includes(clean)) return c;
    }
    return null;
  }

  async upsertCartEvent(cart: CartEvent): Promise<CartEvent> {
    this.cartEvents.set(cart.id, cart);
    return cart;
  }

  async updateCartStatus(
    id: string,
    status: CartStatus,
    stage?: RecoveryStage,
    discountCode?: string | null
  ): Promise<CartEvent | null> {
    const cart = this.cartEvents.get(id);
    if (!cart) return null;
    cart.status = status;
    if (stage) cart.recoveryStage = stage;
    if (discountCode !== undefined) cart.suggestedDiscountCode = discountCode;
    if (status === 'RECOVERED') cart.recoveredAt = new Date();
    cart.updatedAt = new Date();
    this.cartEvents.set(id, cart);
    return cart;
  }

  async listCartEvents(merchantId?: string): Promise<CartEvent[]> {
    const list = Array.from(this.cartEvents.values());
    if (merchantId) {
      return list.filter((c) => c.merchantId === merchantId);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Message Log methods
  async logMessage(log: MessageLog): Promise<MessageLog> {
    this.messageLogs.set(log.id, log);
    return log;
  }

  async listMessageLogs(merchantId?: string): Promise<MessageLog[]> {
    const list = Array.from(this.messageLogs.values());
    if (merchantId) {
      return list.filter((l) => l.merchantId === merchantId);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Admin Takeover Locks (60 minutes default)
  setAdminTakeover(cartId: string, durationMs = 3600000): void {
    this.takeoverLocks.set(cartId, Date.now() + durationMs);
  }

  removeAdminTakeover(cartId: string): void {
    this.takeoverLocks.delete(cartId);
  }

  isAdminTakenOver(cartId: string): boolean {
    const expiresAt = this.takeoverLocks.get(cartId);
    if (!expiresAt) return false;
    if (expiresAt < Date.now()) {
      this.takeoverLocks.delete(cartId);
      return false;
    }
    return true;
  }

  // ==========================================
  // TRANSACTIONAL OUTBOX PATTERN (Martin Kleppmann & Martin Fowler)
  // ==========================================

  /**
   * Generates a deterministic, cryptographic idempotency hash key:
   * sha256(shopDomain + cartToken + eventTimestamp)
   */
  generateOutboxIdempotencyKey(shopDomain: string, cartToken: string, timestamp: number | string | Date): string {
    const ts = typeof timestamp === 'object' && timestamp instanceof Date ? timestamp.getTime() : timestamp;
    return crypto
      .createHash('sha256')
      .update(`${shopDomain}:${cartToken}:${ts}`)
      .digest('hex');
  }

  /**
   * Atomically writes a CartEvent and an OutboxEvent within the same transactional boundary.
   */
  async createCartWithOutbox(
    cartData: Omit<CartEvent, 'id' | 'createdAt' | 'updatedAt'>,
    customOutbox?: Partial<OutboxEvent>
  ): Promise<{ cart: CartEvent; outbox: OutboxEvent }> {
    const id = `cart_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date();

    const cart: CartEvent = {
      id,
      createdAt: now,
      updatedAt: now,
      ...cartData,
    };
    this.cartEvents.set(id, cart);

    const merchant = this.merchants.get(cart.merchantId);
    const shopDomain = merchant?.shopDomain || 'store.myshopify.com';
    const idempotencyKey = customOutbox?.idempotencyKey || this.generateOutboxIdempotencyKey(shopDomain, cart.cartToken, now.getTime());

    const outboxId = `outbox_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const outbox: OutboxEvent = {
      id: outboxId,
      aggregateType: 'CartEvent',
      aggregateId: cart.id,
      eventType: customOutbox?.eventType || 'CART_ABANDONED',
      payload: customOutbox?.payload || {
        cartToken: cart.cartToken,
        merchantId: cart.merchantId,
        totalPrice: cart.totalPrice,
        currency: cart.currency,
        abandonmentType: cart.abandonmentType,
      },
      idempotencyKey,
      status: 'PENDING',
      retryCount: 0,
      createdAt: now,
      processedAt: null,
      ...customOutbox,
    };
    this.outboxEvents.set(outboxId, outbox);

    return { cart, outbox };
  }

  async getPendingOutboxEvents(limit = 50): Promise<OutboxEvent[]> {
    const list = Array.from(this.outboxEvents.values())
      .filter((e) => e.status === 'PENDING' && e.retryCount < 5)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(0, limit);
    return list;
  }

  async markOutboxEventProcessing(id: string): Promise<OutboxEvent | null> {
    const event = this.outboxEvents.get(id);
    if (!event) return null;
    event.status = 'PROCESSING';
    this.outboxEvents.set(id, event);
    return event;
  }

  async markOutboxEventPublished(id: string): Promise<OutboxEvent | null> {
    const event = this.outboxEvents.get(id);
    if (!event) return null;
    event.status = 'PUBLISHED';
    event.processedAt = new Date();
    this.outboxEvents.set(id, event);
    return event;
  }

  async markOutboxEventFailed(id: string, _error?: string): Promise<OutboxEvent | null> {
    void _error;
    const event = this.outboxEvents.get(id);
    if (!event) return null;
    event.retryCount += 1;
    event.status = event.retryCount >= 5 ? 'FAILED' : 'PENDING';
    this.outboxEvents.set(id, event);
    return event;
  }

  // ==========================================
  // SECURITY INCIDENTS AUDIT TRAIL
  // ==========================================

  async logSecurityIncident(incident: SecurityIncident): Promise<SecurityIncident> {
    this.securityIncidents.set(incident.id, incident);
    return incident;
  }

  async listSecurityIncidents(merchantId?: string): Promise<SecurityIncident[]> {
    const list = Array.from(this.securityIncidents.values());
    if (merchantId) {
      return list.filter((s) => s.merchantId === merchantId);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export const db = new MemoryDatabase();
