/**
 * RecoverFlow AI — In-Memory Database (Demo / Test Mode Adapter)
 *
 * Implements DatabasePort using fast in-memory Maps.
 * Strictly used in DEMO and TEST environments. Never used in SANDBOX or LIVE.
 */

import crypto from 'crypto';
import type {
  Merchant,
  CartEvent,
  MessageLog,
  SuppressionEntry,
  CartStatus,
  RecoveryStage,
  OrderRecord,
  FulfillmentRecord,
  ReturnRecord,
  SecurityIncident,
} from '../types';
import type { UserRole } from '../auth';
import type {
  DatabasePort,
  OrganizationRecord,
  UserRecord,
  MembershipRecord,
  SessionRecord,
  PaymentRecord,
  RecoveryCaseRecord,
  RecoveryDecisionRecord,
  RecoveryAttemptRecord,
  RecoveryOutcomeRecord,
  OutboxEventRecord,
  IdempotencyKeyRecord,
  WebhookEventRecord,
  AuditEventRecord,
} from './DatabasePort';
import { seedDemoDataset } from '../seed-data';

export function hashPii(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex').slice(0, 16);
}

export class MemoryDatabase implements DatabasePort {
  public readonly isDurable = false;
  public readonly providerName = 'MemoryDatabase (In-Process Demo/Test)';

  public organizations = new Map<string, OrganizationRecord>();
  public users = new Map<string, UserRecord>();
  public memberships = new Map<string, MembershipRecord>();
  public sessions = new Map<string, SessionRecord>();

  public merchants = new Map<string, Merchant>();
  public cartEvents = new Map<string, CartEvent>();
  public messageLogs = new Map<string, MessageLog>();
  public suppressions = new Map<string, SuppressionEntry>();
  public takeoverLocks = new Map<string, number>();

  public payments = new Map<string, PaymentRecord>();
  public recoveryCases = new Map<string, RecoveryCaseRecord>();
  public recoveryDecisions = new Map<string, RecoveryDecisionRecord>();
  public recoveryAttempts = new Map<string, RecoveryAttemptRecord>();
  public recoveryOutcomes = new Map<string, RecoveryOutcomeRecord>();

  public outboxEvents = new Map<string, OutboxEventRecord>();
  public idempotencyKeys = new Map<string, IdempotencyKeyRecord>();
  public webhookEvents = new Map<string, WebhookEventRecord>();
  public auditEvents = new Map<string, AuditEventRecord>();

  public securityIncidents = new Map<string, SecurityIncident>();
  public orders = new Map<string, OrderRecord>();
  public fulfillments = new Map<string, FulfillmentRecord>();
  public returns = new Map<string, ReturnRecord>();

  constructor() {
    this.seedDefaults();
  }

  public clear(): void {
    this.organizations.clear();
    this.users.clear();
    this.memberships.clear();
    this.sessions.clear();
    this.merchants.clear();
    this.cartEvents.clear();
    this.messageLogs.clear();
    this.suppressions.clear();
    this.takeoverLocks.clear();
    this.payments.clear();
    this.recoveryCases.clear();
    this.recoveryDecisions.clear();
    this.recoveryAttempts.clear();
    this.recoveryOutcomes.clear();
    this.outboxEvents.clear();
    this.idempotencyKeys.clear();
    this.webhookEvents.clear();
    this.auditEvents.clear();
    this.securityIncidents.clear();
    this.orders.clear();
    this.fulfillments.clear();
    this.returns.clear();
  }

  public seedDefaults(): void {
    seedDemoDataset(this as unknown as any, { clearExisting: false });
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async getHealth(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; latencyMs: number; details?: Record<string, unknown> }> {
    return {
      status: 'healthy',
      latencyMs: 0,
      details: {
        mode: 'IN_MEMORY',
        merchants: this.merchants.size,
        carts: this.cartEvents.size,
        outbox: this.outboxEvents.size,
      },
    };
  }

  async close(): Promise<void> {
    // No-op for in-memory
  }

  // ── Identity & Tenancy ───────────────────────────────────────────────────

  async getOrganization(id: string): Promise<OrganizationRecord | null> {
    return this.organizations.get(id) || null;
  }

  async getOrganizationBySlug(slug: string): Promise<OrganizationRecord | null> {
    for (const org of this.organizations.values()) {
      if (org.slug === slug) return org;
    }
    return null;
  }

  async createOrganization(data: { name: string; slug: string }): Promise<OrganizationRecord> {
    const org: OrganizationRecord = {
      id: `org_${crypto.randomBytes(6).toString('hex')}`,
      name: data.name,
      slug: data.slug,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.organizations.set(org.id, org);
    return org;
  }

  async getUser(id: string): Promise<UserRecord | null> {
    return this.users.get(id) || null;
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) return u;
    }
    return null;
  }

  async createUser(data: { email: string; name?: string }): Promise<UserRecord> {
    const user: UserRecord = {
      id: `usr_${crypto.randomBytes(6).toString('hex')}`,
      email: data.email,
      name: data.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  async getMembership(userId: string, organizationId: string): Promise<MembershipRecord | null> {
    for (const m of this.memberships.values()) {
      if (m.userId === userId && m.organizationId === organizationId) return m;
    }
    return null;
  }

  async createMembership(data: { userId: string; organizationId: string; role: UserRole }): Promise<MembershipRecord> {
    const membership: MembershipRecord = {
      id: `mem_${crypto.randomBytes(6).toString('hex')}`,
      userId: data.userId,
      organizationId: data.organizationId,
      role: data.role,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.memberships.set(membership.id, membership);
    return membership;
  }

  // ── Sessions & Revocation ────────────────────────────────────────────────

  async createSession(data: {
    userId: string;
    tokenHash: string;
    organizationId: string;
    activeMerchantId: string;
    role: UserRole;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<SessionRecord> {
    const session: SessionRecord = {
      id: `sess_${crypto.randomBytes(8).toString('hex')}`,
      userId: data.userId,
      tokenHash: data.tokenHash,
      organizationId: data.organizationId,
      activeMerchantId: data.activeMerchantId,
      role: data.role,
      isRevoked: false,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      expiresAt: data.expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.sessions.set(session.tokenHash, session);
    return session;
  }

  async getSession(tokenHash: string): Promise<SessionRecord | null> {
    return this.sessions.get(tokenHash) || null;
  }

  async revokeSession(sessionId: string, reason: string): Promise<void> {
    for (const s of this.sessions.values()) {
      if (s.id === sessionId) {
        s.isRevoked = true;
        s.revokedAt = new Date();
        s.revocationReason = reason;
        s.updatedAt = new Date();
      }
    }
  }

  async revokeAllUserSessions(userId: string, reason: string): Promise<number> {
    let count = 0;
    for (const s of this.sessions.values()) {
      if (s.userId === userId && !s.isRevoked) {
        s.isRevoked = true;
        s.revokedAt = new Date();
        s.revocationReason = reason;
        s.updatedAt = new Date();
        count++;
      }
    }
    return count;
  }

  async isSessionRevoked(tokenHash: string): Promise<boolean> {
    const s = this.sessions.get(tokenHash);
    if (!s) return false;
    return s.isRevoked || new Date(s.expiresAt).getTime() < Date.now();
  }

  // ── Merchants ────────────────────────────────────────────────────────────

  async getMerchant(id: string, _orgId?: string): Promise<Merchant | null> {
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

  async listMerchants(_orgId?: string): Promise<Merchant[]> {
    return Array.from(this.merchants.values());
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

  // ── Cart & Checkout Events ───────────────────────────────────────────────

  async getCartById(id: string, merchantId?: string): Promise<CartEvent | null> {
    const cart = this.cartEvents.get(id);
    if (!cart) return null;
    if (merchantId && cart.merchantId !== merchantId) return null;
    return cart;
  }

  async getCartEvent(id: string, merchantId?: string): Promise<CartEvent | null> {
    return this.getCartById(id, merchantId);
  }

  async getCartByToken(cartToken: string, merchantId?: string): Promise<CartEvent | null> {
    for (const c of this.cartEvents.values()) {
      if (c.cartToken === cartToken && (!merchantId || c.merchantId === merchantId)) {
        return c;
      }
    }
    return null;
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

  async getCartEventsByMerchant(merchantId: string): Promise<CartEvent[]> {
    return this.listCartEvents(merchantId);
  }

  // ── Payments & Recovery Cases ────────────────────────────────────────────

  async createPayment(data: {
    merchantId: string;
    externalPaymentId: string;
    amountPaise: bigint | number;
    currency: string;
    status?: string;
    gateway?: string;
    customerId?: string;
    orderReference?: string;
  }): Promise<PaymentRecord> {
    const payment: PaymentRecord = {
      id: `pay_${crypto.randomBytes(6).toString('hex')}`,
      merchantId: data.merchantId,
      externalPaymentId: data.externalPaymentId,
      amountPaise: data.amountPaise,
      currency: data.currency,
      status: data.status || 'FAILED',
      gateway: data.gateway || 'RAZORPAY',
      customerId: data.customerId,
      orderReference: data.orderReference,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.payments.set(payment.id, payment);
    return payment;
  }

  async getPayment(id: string, merchantId?: string): Promise<PaymentRecord | null> {
    const p = this.payments.get(id);
    if (!p) return null;
    if (merchantId && p.merchantId !== merchantId) return null;
    return p;
  }

  async getPaymentByExternalId(externalPaymentId: string, merchantId?: string): Promise<PaymentRecord | null> {
    for (const p of this.payments.values()) {
      if (p.externalPaymentId === externalPaymentId && (!merchantId || p.merchantId === merchantId)) {
        return p;
      }
    }
    return null;
  }

  async createRecoveryCase(data: {
    merchantId: string;
    paymentId: string;
    customerId?: string;
    recoveryProbBps?: number;
    expectedValuePaise?: bigint | number;
  }): Promise<RecoveryCaseRecord> {
    const recCase: RecoveryCaseRecord = {
      id: `rc_${crypto.randomBytes(6).toString('hex')}`,
      merchantId: data.merchantId,
      paymentId: data.paymentId,
      customerId: data.customerId,
      status: 'DETECTED',
      attemptCount: 0,
      maxAttempts: 3,
      recoveryProbBps: data.recoveryProbBps || 0,
      expectedValuePaise: data.expectedValuePaise || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.recoveryCases.set(recCase.id, recCase);
    return recCase;
  }

  async getRecoveryCase(id: string, merchantId?: string): Promise<RecoveryCaseRecord | null> {
    const c = this.recoveryCases.get(id);
    if (!c) return null;
    if (merchantId && c.merchantId !== merchantId) return null;
    return c;
  }

  async updateRecoveryCase(id: string, updates: Partial<RecoveryCaseRecord>, merchantId?: string): Promise<RecoveryCaseRecord | null> {
    const c = this.recoveryCases.get(id);
    if (!c) return null;
    if (merchantId && c.merchantId !== merchantId) return null;
    const updated = { ...c, ...updates, updatedAt: new Date() };
    this.recoveryCases.set(id, updated);
    return updated;
  }

  async listRecoveryCases(params: { merchantId: string; status?: string; limit?: number; offset?: number }): Promise<RecoveryCaseRecord[]> {
    let list = Array.from(this.recoveryCases.values()).filter((c) => c.merchantId === params.merchantId);
    if (params.status) {
      list = list.filter((c) => c.status === params.status);
    }
    const offset = params.offset || 0;
    const limit = params.limit || 50;
    return list.slice(offset, offset + limit);
  }

  async createRecoveryDecision(data: {
    recoveryCaseId: string;
    recommendedAction: string;
    probRecoveryBps: number;
    expectedValuePaise: bigint | number;
    featuresSnapshot: Record<string, unknown>;
    aiAdvisoryAnalysis?: string;
    isHaltedBySafety?: boolean;
    safetyHaltReason?: string;
  }): Promise<RecoveryDecisionRecord> {
    const dec: RecoveryDecisionRecord = {
      id: `dec_${crypto.randomBytes(6).toString('hex')}`,
      recoveryCaseId: data.recoveryCaseId,
      recommendedAction: data.recommendedAction,
      probRecoveryBps: data.probRecoveryBps,
      expectedValuePaise: data.expectedValuePaise,
      featuresSnapshot: data.featuresSnapshot,
      aiAdvisoryAnalysis: data.aiAdvisoryAnalysis,
      isHaltedBySafety: data.isHaltedBySafety || false,
      safetyHaltReason: data.safetyHaltReason,
      requiresApproval: false,
      createdAt: new Date(),
    };
    this.recoveryDecisions.set(dec.id, dec);
    return dec;
  }

  async createRecoveryAttempt(data: {
    recoveryCaseId: string;
    attemptNumber: number;
    channel: string;
    status?: string;
    providerResponse?: Record<string, unknown>;
  }): Promise<RecoveryAttemptRecord> {
    const attempt: RecoveryAttemptRecord = {
      id: `att_${crypto.randomBytes(6).toString('hex')}`,
      recoveryCaseId: data.recoveryCaseId,
      attemptNumber: data.attemptNumber,
      channel: data.channel,
      dispatchedAt: new Date(),
      status: data.status || 'PENDING',
      providerResponse: data.providerResponse,
      createdAt: new Date(),
    };
    this.recoveryAttempts.set(attempt.id, attempt);
    return attempt;
  }

  async createRecoveryOutcome(data: {
    recoveryCaseId: string;
    isRecovered: boolean;
    recoveredAmountPaise: bigint | number;
    feeAmountPaise?: bigint | number;
    observedVia: string;
  }): Promise<RecoveryOutcomeRecord> {
    const outcome: RecoveryOutcomeRecord = {
      id: `out_${crypto.randomBytes(6).toString('hex')}`,
      recoveryCaseId: data.recoveryCaseId,
      isRecovered: data.isRecovered,
      recoveredAmountPaise: data.recoveredAmountPaise,
      feeAmountPaise: data.feeAmountPaise || 0,
      observedVia: data.observedVia,
      verifiedAt: new Date(),
      createdAt: new Date(),
    };
    this.recoveryOutcomes.set(outcome.id, outcome);
    return outcome;
  }

  // ── Transactional Outbox ─────────────────────────────────────────────────

  async createOutboxEvent(data: {
    merchantId?: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: Record<string, unknown>;
    idempotencyKey: string;
  }): Promise<OutboxEventRecord> {
    const event: OutboxEventRecord = {
      id: `evt_out_${crypto.randomBytes(8).toString('hex')}`,
      merchantId: data.merchantId,
      aggregateType: data.aggregateType,
      aggregateId: data.aggregateId,
      eventType: data.eventType,
      payload: data.payload,
      idempotencyKey: data.idempotencyKey,
      status: 'PENDING',
      attemptCount: 0,
      maxAttempts: 5,
      availableAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.outboxEvents.set(event.id, event);
    return event;
  }

  async getPendingOutboxEvents(batchSize = 50, merchantId?: string): Promise<OutboxEventRecord[]> {
    const now = Date.now();
    const pending = Array.from(this.outboxEvents.values())
      .filter((e) => {
        if (merchantId && e.merchantId !== merchantId) return false;
        return e.status === 'PENDING' && new Date(e.availableAt).getTime() <= now;
      })
      .slice(0, batchSize);
    return pending;
  }

  async claimOutboxEvents(workerId: string, batchSize = 20, lockTtlMs = 30000): Promise<OutboxEventRecord[]> {
    const now = Date.now();
    const claimed: OutboxEventRecord[] = [];

    for (const e of this.outboxEvents.values()) {
      if (claimed.length >= batchSize) break;
      const isAvailable = e.status === 'PENDING' && new Date(e.availableAt).getTime() <= now;
      const isExpiredLock = e.status === 'PROCESSING' && e.lockedAt && now - new Date(e.lockedAt).getTime() > lockTtlMs;

      if (isAvailable || isExpiredLock) {
        e.status = 'PROCESSING';
        e.lockedAt = new Date(now);
        e.lockedBy = workerId;
        e.attemptCount += 1;
        e.updatedAt = new Date(now);
        claimed.push({ ...e });
      }
    }
    return claimed;
  }

  async markOutboxEventProcessing(id: string, workerId?: string): Promise<void> {
    const e = this.outboxEvents.get(id);
    if (e) {
      e.status = 'PROCESSING';
      e.lockedAt = new Date();
      if (workerId) e.lockedBy = workerId;
      e.updatedAt = new Date();
    }
  }

  async markOutboxEventPublished(id: string): Promise<void> {
    const e = this.outboxEvents.get(id);
    if (e) {
      e.status = 'PUBLISHED';
      e.publishedAt = new Date();
      (e as any).processedAt = new Date();
      e.lockedBy = null;
      e.lockedAt = null;
      e.updatedAt = new Date();
    }
  }

  async markOutboxEventFailed(id: string, error?: string, retryDelayMs = 5000): Promise<void> {
    const e = this.outboxEvents.get(id);
    if (e) {
      e.attemptCount = (e.attemptCount || (e as any).retryCount || 0) + 1;
      (e as any).retryCount = e.attemptCount;
      e.lastError = error || 'Processing failed';
      e.lockedBy = null;
      e.lockedAt = null;
      if (e.attemptCount >= e.maxAttempts) {
        e.status = 'FAILED';
      } else {
        e.status = 'PENDING';
        e.availableAt = new Date(Date.now() + retryDelayMs);
      }
      e.updatedAt = new Date();
    }
  }

  // ── Idempotency Store ────────────────────────────────────────────────────

  async acquireIdempotencyKey(params: {
    key: string;
    merchantId: string;
    endpoint: string;
    requestHash?: string;
    ttlMs?: number;
  }): Promise<{ acquired: boolean; existingResponse?: { code: number; body: unknown }; isConflict?: boolean }> {
    const now = Date.now();
    const ttl = params.ttlMs || 24 * 60 * 60 * 1000;
    const existing = this.idempotencyKeys.get(params.key);

    if (existing) {
      // Check if expired
      if (new Date(existing.expiresAt).getTime() <= now) {
        this.idempotencyKeys.delete(params.key);
      } else {
        // Check hash conflict
        if (params.requestHash && existing.requestHash && params.requestHash !== existing.requestHash) {
          return { acquired: false, isConflict: true };
        }

        if (existing.status === 'COMMITTED' && existing.responseCode !== null && existing.responseCode !== undefined) {
          return {
            acquired: false,
            existingResponse: {
              code: existing.responseCode,
              body: existing.responseBody,
            },
          };
        }

        // Check if currently locked
        if (existing.status === 'IN_PROGRESS' && existing.lockedUntil && new Date(existing.lockedUntil).getTime() > now) {
          return { acquired: false };
        }
      }
    }

    // Acquire lock
    const record: IdempotencyKeyRecord = {
      key: params.key,
      merchantId: params.merchantId,
      endpoint: params.endpoint,
      requestHash: params.requestHash,
      status: 'IN_PROGRESS',
      lockedUntil: new Date(now + 30000), // 30s lock
      version: 1,
      createdAt: new Date(now),
      expiresAt: new Date(now + ttl),
    };
    this.idempotencyKeys.set(params.key, record);
    return { acquired: true };
  }

  async commitIdempotencyKey(key: string, merchantId: string, responseCode: number, responseBody: unknown): Promise<void> {
    const existing = this.idempotencyKeys.get(key);
    if (existing && existing.merchantId === merchantId) {
      existing.status = 'COMMITTED';
      existing.responseCode = responseCode;
      existing.responseBody = responseBody;
      existing.lockedUntil = null;
    }
  }

  async releaseIdempotencyKey(key: string, merchantId: string): Promise<void> {
    const existing = this.idempotencyKeys.get(key);
    if (existing && existing.merchantId === merchantId && existing.status === 'IN_PROGRESS') {
      this.idempotencyKeys.delete(key);
    }
  }

  // ── Webhooks ─────────────────────────────────────────────────────────────

  async createWebhookEvent(data: {
    merchantId?: string;
    provider: string;
    source?: string;
    eventType: string;
    providerEventId?: string;
    externalId?: string;
    idempotencyKey: string;
    payloadHash?: string;
    rawPayload: Record<string, unknown>;
    signatureValid?: boolean;
  }): Promise<WebhookEventRecord> {
    const event: WebhookEventRecord = {
      id: `wh_${crypto.randomBytes(8).toString('hex')}`,
      merchantId: data.merchantId,
      provider: data.provider,
      source: data.source || data.provider,
      eventType: data.eventType,
      providerEventId: data.providerEventId,
      externalId: data.externalId,
      idempotencyKey: data.idempotencyKey,
      payloadHash: data.payloadHash,
      rawPayload: data.rawPayload,
      signatureValid: data.signatureValid ?? false,
      status: 'PENDING',
      attemptCount: 0,
      receivedAt: new Date(),
    };
    this.webhookEvents.set(event.id, event);
    return event;
  }

  async getWebhookEvent(provider: string, providerEventId: string): Promise<WebhookEventRecord | null> {
    for (const e of this.webhookEvents.values()) {
      if (e.provider === provider && (e.providerEventId === providerEventId || e.idempotencyKey === providerEventId)) {
        return e;
      }
    }
    return null;
  }

  async markWebhookEventProcessed(id: string, status: 'PROCESSED' | 'FAILED', error?: string): Promise<void> {
    const e = this.webhookEvents.get(id);
    if (e) {
      e.status = status;
      e.processedAt = new Date();
      if (error) e.errorMessage = error;
    }
  }

  // ── Audit Ledger (Merkle Hash Chain) ─────────────────────────────────────

  async appendAuditEvent(data: {
    organizationId?: string;
    merchantId?: string;
    userId?: string;
    actorType: string;
    action: string;
    entityType: string;
    entityId: string;
    correlationId?: string;
    payloadHash: string;
    metadata?: Record<string, unknown>;
  }): Promise<AuditEventRecord> {
    const latest = await this.getLatestAuditEvent(data.merchantId);
    const previousHash = latest ? latest.currentHash : '0'.repeat(64);

    const currentHash = crypto
      .createHash('sha256')
      .update(`${previousHash}:${data.actorType}:${data.action}:${data.entityId}:${data.payloadHash}`)
      .digest('hex');

    const audit: AuditEventRecord = {
      id: `aud_${crypto.randomBytes(8).toString('hex')}`,
      organizationId: data.organizationId,
      merchantId: data.merchantId,
      userId: data.userId,
      actorType: data.actorType,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      correlationId: data.correlationId,
      previousHash,
      payloadHash: data.payloadHash,
      currentHash,
      metadata: data.metadata,
      createdAt: new Date(),
    };

    this.auditEvents.set(audit.id, audit);
    return audit;
  }

  async getLatestAuditEvent(merchantId?: string): Promise<AuditEventRecord | null> {
    const list = Array.from(this.auditEvents.values());
    const filtered = merchantId ? list.filter((a) => a.merchantId === merchantId) : list;
    if (filtered.length === 0) return null;
    return filtered[filtered.length - 1];
  }

  async listAuditEvents(params: { merchantId?: string; entityType?: string; entityId?: string; limit?: number }): Promise<AuditEventRecord[]> {
    let list = Array.from(this.auditEvents.values());
    if (params.merchantId) list = list.filter((a) => a.merchantId === params.merchantId);
    if (params.entityType) list = list.filter((a) => a.entityType === params.entityType);
    if (params.entityId) list = list.filter((a) => a.entityId === params.entityId);
    const limit = params.limit || 100;
    return list.slice(-limit);
  }

  async verifyAuditChain(merchantId?: string): Promise<{ valid: boolean; totalEvents: number; brokenAtId?: string }> {
    const events = await this.listAuditEvents({ merchantId, limit: 10000 });
    if (events.length === 0) return { valid: true, totalEvents: 0 };

    let expectedPrev = '0'.repeat(64);
    for (const e of events) {
      if (e.previousHash !== expectedPrev) {
        return { valid: false, totalEvents: events.length, brokenAtId: e.id };
      }
      const recalculated = crypto
        .createHash('sha256')
        .update(`${e.previousHash}:${e.actorType}:${e.action}:${e.entityId}:${e.payloadHash}`)
        .digest('hex');

      if (recalculated !== e.currentHash) {
        return { valid: false, totalEvents: events.length, brokenAtId: e.id };
      }
      expectedPrev = e.currentHash;
    }
    return { valid: true, totalEvents: events.length };
  }

  // ── Messages, Suppressions, Orders, Fulfillments, Returns ─────────────────

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

  async addSuppression(entry: SuppressionEntry): Promise<SuppressionEntry> {
    const key = `${entry.type}:${entry.identifier.toLowerCase().trim()}`;
    this.suppressions.set(key, entry);
    return entry;
  }

  async isSuppressed(identifier: string, type: 'PHONE' | 'EMAIL'): Promise<boolean> {
    const key = `${type}:${identifier.toLowerCase().trim()}`;
    return this.suppressions.has(key);
  }

  async getSuppressionList(): Promise<SuppressionEntry[]> {
    return Array.from(this.suppressions.values());
  }

  async removeSuppression(identifier: string): Promise<boolean> {
    const phoneKey = `PHONE:${identifier.toLowerCase().trim()}`;
    const emailKey = `EMAIL:${identifier.toLowerCase().trim()}`;
    const deletedPhone = this.suppressions.delete(phoneKey);
    const deletedEmail = this.suppressions.delete(emailKey);
    return deletedPhone || deletedEmail;
  }

  async upsertOrder(order: OrderRecord): Promise<OrderRecord> {
    this.orders.set(order.id, { ...order, updatedAt: new Date() });
    return order;
  }

  async getOrder(id: string, merchantId?: string): Promise<OrderRecord | null> {
    const o = this.orders.get(id);
    if (!o) return null;
    if (merchantId && o.merchantId !== merchantId) return null;
    return o;
  }

  async listOrders(merchantId?: string): Promise<OrderRecord[]> {
    const list = Array.from(this.orders.values());
    if (merchantId) {
      return list.filter((o) => o.merchantId === merchantId);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async upsertFulfillment(fulfillment: FulfillmentRecord): Promise<FulfillmentRecord> {
    this.fulfillments.set(fulfillment.id, { ...fulfillment, updatedAt: new Date() });
    return fulfillment;
  }

  async listFulfillments(merchantId?: string): Promise<FulfillmentRecord[]> {
    const list = Array.from(this.fulfillments.values());
    if (merchantId) {
      return list.filter((f) => f.merchantId === merchantId);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async upsertReturn(returnRecord: ReturnRecord): Promise<ReturnRecord> {
    this.returns.set(returnRecord.id, { ...returnRecord, updatedAt: new Date() });
    return returnRecord;
  }

  async listReturns(merchantId?: string): Promise<ReturnRecord[]> {
    const list = Array.from(this.returns.values());
    if (merchantId) {
      return list.filter((r) => r.merchantId === merchantId);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async logSecurityIncident(incident: SecurityIncident): Promise<SecurityIncident> {
    this.securityIncidents.set(incident.id, incident);
    return incident;
  }

  async listSecurityIncidents(merchantId?: string): Promise<SecurityIncident[]> {
    const list = Array.from(this.securityIncidents.values());
    if (merchantId) {
      return list.filter((i) => i.merchantId === merchantId);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

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

  // ── Compatibility & Omni-Lifecycle Helpers ─────────────────────────────────


  getAdminTakeoverRemainingMs(cartId: string): number {
    const expiresAt = this.takeoverLocks.get(cartId);
    if (!expiresAt) return 0;
    return Math.max(0, expiresAt - Date.now());
  }



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

  isAdminTakeover(cartId: string): boolean {
    return this.isAdminTakenOver(cartId);
  }

  generateOutboxIdempotencyKey(shopDomain: string, cartToken: string, timestamp: number | string | Date): string {
    const ts = typeof timestamp === 'object' && timestamp instanceof Date ? timestamp.getTime() : timestamp;
    return crypto
      .createHash('sha256')
      .update(`${shopDomain}:${cartToken}:${ts}`)
      .digest('hex');
  }

  async createCartWithOutbox(
    cartData: Omit<CartEvent, 'id' | 'createdAt' | 'updatedAt'>,
    customOutbox?: Partial<OutboxEventRecord>
  ): Promise<{ cart: CartEvent; outbox: OutboxEventRecord }> {
    const id = `cart_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date();

    const cart: CartEvent = {
      id,
      createdAt: now,
      updatedAt: now,
      ...cartData,
    };
    await this.upsertCartEvent(cart);

    const merchant = this.merchants.get(cart.merchantId);
    const shopDomain = merchant?.shopDomain || merchant?.storeUrl || 'store.myshopify.com';
    const idempotencyKey = customOutbox?.idempotencyKey || this.generateOutboxIdempotencyKey(shopDomain, cart.cartToken, now.getTime());

    const outboxId = `outbox_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const outbox: OutboxEventRecord = {
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
      attemptCount: 0,
      maxAttempts: 5,
      availableAt: now,
      lockedAt: null,
      lockedBy: null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
      ...customOutbox,
    };
    this.outboxEvents.set(outboxId, outbox);

    return { cart, outbox };
  }

  async createOrUpdateOrder(order: OrderRecord): Promise<OrderRecord> {
    return this.upsertOrder(order);
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
    return this.upsertFulfillment(fulfillment);
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

  async createOrUpdateReturn(ret: ReturnRecord): Promise<ReturnRecord> {
    return this.upsertReturn(ret);
  }

  async getReturn(id: string): Promise<ReturnRecord | null> {
    return this.returns.get(id) || null;
  }

  async getReturnsByOrderId(orderId: string): Promise<ReturnRecord[]> {
    const list = Array.from(this.returns.values());
    return list.filter((r) => r.orderId === orderId);
  }

}

export const InMemoryDatabase = MemoryDatabase;
