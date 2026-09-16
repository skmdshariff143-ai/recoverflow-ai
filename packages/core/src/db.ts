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
  OrderRecord,
  FulfillmentRecord,
  ReturnRecord,
} from './types';
import { seedDemoDataset } from './seed-data';

export function hashPii(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex').slice(0, 16);
}

export class MemoryDatabase {
  public merchants = new Map<string, Merchant>();
  public cartEvents = new Map<string, CartEvent>();
  public messageLogs = new Map<string, MessageLog>();
  public suppressions = new Map<string, SuppressionEntry>();
  public takeoverLocks = new Map<string, number>(); // cartId -> expiration timestamp
  public outboxEvents = new Map<string, OutboxEvent>();
  public securityIncidents = new Map<string, SecurityIncident>();
  public orders = new Map<string, OrderRecord>();
  public fulfillments = new Map<string, FulfillmentRecord>();
  public returns = new Map<string, ReturnRecord>();

  constructor() {
    this.seedDefaults();
  }

  public clear(): void {
    this.merchants.clear();
    this.cartEvents.clear();
    this.messageLogs.clear();
    this.suppressions.clear();
    this.takeoverLocks.clear();
    this.outboxEvents.clear();
    this.securityIncidents.clear();
    this.orders.clear();
    this.fulfillments.clear();
    this.returns.clear();
  }

  public seedDefaults(): void {
    seedDemoDataset(this, { clearExisting: false });
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

  async createOrUpdateMerchant(merchant: Merchant): Promise<Merchant> {
    return this.upsertMerchant(merchant);
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
  async getCartByToken(cartToken: string, merchantId?: string): Promise<CartEvent | null> {
    for (const c of this.cartEvents.values()) {
      if (c.cartToken === cartToken && (!merchantId || c.merchantId === merchantId)) {
        return c;
      }
    }
    return null;
  }

  async getCartById(id: string, merchantId?: string): Promise<CartEvent | null> {
    const cart = this.cartEvents.get(id);
    if (!cart) return null;
    if (merchantId && cart.merchantId !== merchantId) return null;
    return cart;
  }

  async findCartByCustomerOrToken(identifier: string, merchantId?: string): Promise<CartEvent | null> {
    const clean = identifier.toLowerCase().trim();
    for (const c of this.cartEvents.values()) {
      if (merchantId && c.merchantId !== merchantId) continue;
      if (c.cartToken.toLowerCase() === clean) return c;
      if (c.customerEmail && c.customerEmail.toLowerCase() === clean) return c;
      if (c.customerPhone && c.customerPhone.includes(clean)) return c;
    }
    return null;
  }

  async upsertCartEvent(cart: CartEvent): Promise<CartEvent> {
    const merchant = this.merchants.get(cart.merchantId);
    let finalCart = { ...cart };

    // Data Sovereignty: If merchant has EPHEMERAL data tier, hash PII before storing
    if (merchant && merchant.dataTier === 'EPHEMERAL') {
      finalCart = {
        ...finalCart,
        customerEmail: hashPii(finalCart.customerEmail),
        customerPhone: hashPii(finalCart.customerPhone),
        customerName: finalCart.customerName ? '[ANONYMIZED_SHOPPER]' : undefined,
      };
    }

    this.cartEvents.set(finalCart.id, finalCart);
    return finalCart;
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
      merchantId: cart.merchantId,
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

  async getPendingOutboxEvents(limit = 50, merchantId?: string): Promise<OutboxEvent[]> {
    const list = Array.from(this.outboxEvents.values())
      .filter((e) => {
        if (merchantId && e.merchantId !== merchantId) return false;
        return e.status === 'PENDING' && e.retryCount < 5;
      })
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

  // ==========================================
  // ORDERS & FULFILLMENTS (WISMO)
  // ==========================================

  async createOrUpdateOrder(order: OrderRecord): Promise<OrderRecord> {
    this.orders.set(order.id, order);
    return order;
  }

  async getOrder(id: string): Promise<OrderRecord | null> {
    return this.orders.get(id) || null;
  }

  async getOrderByShopifyId(shopifyOrderId: string): Promise<OrderRecord | null> {
    const list = Array.from(this.orders.values());
    return list.find((o) => o.shopifyOrderId === shopifyOrderId) || null;
  }

  async getOrderByOrderNumber(merchantId: string, orderNumber: string): Promise<OrderRecord | null> {
    const list = Array.from(this.orders.values());
    const normalized = orderNumber.replace(/^#/, '').trim().toLowerCase();
    return (
      list.find(
        (o) =>
          o.merchantId === merchantId &&
          (o.orderNumber.replace(/^#/, '').trim().toLowerCase() === normalized || o.shopifyOrderId === orderNumber)
      ) || null
    );
  }

  async findOrdersByCustomer(merchantId: string, identifier: string): Promise<OrderRecord[]> {
    const list = Array.from(this.orders.values());
    const cleanId = identifier.trim().toLowerCase();
    return list.filter(
      (o) =>
        o.merchantId === merchantId &&
        ((o.customerPhone && (o.customerPhone === identifier || o.customerPhone.includes(cleanId.slice(-10)))) ||
          (o.customerEmail && o.customerEmail.toLowerCase() === cleanId) ||
          o.orderNumber.toLowerCase() === cleanId ||
          o.shopifyOrderId === identifier)
    );
  }

  async createOrUpdateFulfillment(fulfillment: FulfillmentRecord): Promise<FulfillmentRecord> {
    this.fulfillments.set(fulfillment.id, fulfillment);
    return fulfillment;
  }

  async getFulfillment(id: string): Promise<FulfillmentRecord | null> {
    return this.fulfillments.get(id) || null;
  }

  async getFulfillmentByShopifyId(shopifyFulfillmentId: string): Promise<FulfillmentRecord | null> {
    const list = Array.from(this.fulfillments.values());
    return list.find((f) => f.shopifyFulfillmentId === shopifyFulfillmentId) || null;
  }

  async getFulfillmentsByOrderId(orderId: string): Promise<FulfillmentRecord[]> {
    const list = Array.from(this.fulfillments.values());
    return list.filter((f) => f.orderId === orderId);
  }

  async findFulfillmentByTracking(merchantId: string, trackingNumber: string): Promise<FulfillmentRecord | null> {
    const list = Array.from(this.fulfillments.values());
    const cleanTracking = trackingNumber.trim().toLowerCase();
    return (
      list.find(
        (f) =>
          f.merchantId === merchantId &&
          f.trackingNumber &&
          f.trackingNumber.trim().toLowerCase() === cleanTracking
      ) || null
    );
  }

  // ==========================================
  // RETURNS
  // ==========================================

  async createOrUpdateReturn(ret: ReturnRecord): Promise<ReturnRecord> {
    this.returns.set(ret.id, ret);
    return ret;
  }

  async getReturn(id: string): Promise<ReturnRecord | null> {
    return this.returns.get(id) || null;
  }

  async getReturnsByOrderId(orderId: string): Promise<ReturnRecord[]> {
    const list = Array.from(this.returns.values());
    return list.filter((r) => r.orderId === orderId);
  }

  async listReturns(merchantId?: string): Promise<ReturnRecord[]> {
    const list = Array.from(this.returns.values());
    if (merchantId) {
      return list.filter((r) => r.merchantId === merchantId);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // ==========================================
  // DATA SOVEREIGNTY: RETENTION PRUNING
  // ==========================================

  async pruneRecordsOlderThan(retentionDays = 30): Promise<{ prunedCarts: number; prunedLogs: number }> {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    let prunedCarts = 0;
    let prunedLogs = 0;

    for (const [id, cart] of this.cartEvents.entries()) {
      if (new Date(cart.createdAt).getTime() < cutoff) {
        this.cartEvents.delete(id);
        prunedCarts++;
      }
    }

    for (const [id, log] of this.messageLogs.entries()) {
      if (new Date(log.createdAt).getTime() < cutoff) {
        this.messageLogs.delete(id);
        prunedLogs++;
      }
    }

    return { prunedCarts, prunedLogs };
  }
}

export const db = new MemoryDatabase();
