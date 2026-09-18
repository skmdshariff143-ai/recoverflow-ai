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
  CreateRecoveryCaseAndEnqueueParams,
  IngestRazorpayWebhookParams,
  SearchRecoveryCasesParams,
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
    // In-memory no-op
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
      id: `sess_${crypto.randomBytes(6).toString('hex')}`,
      userId: data.userId,
      tokenHash: data.tokenHash,
      organizationId: data.organizationId,
      activeMerchantId: data.activeMerchantId,
      role: data.role,
      isRevoked: false,
      expiresAt: data.expiresAt,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
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
    for (const session of this.sessions.values()) {
      if (session.id === sessionId) {
        session.isRevoked = true;
        session.revokedAt = new Date();
        session.revocationReason = reason;
        break;
      }
    }
  }

  async revokeAllUserSessions(userId: string, reason: string): Promise<number> {
    let count = 0;
    for (const session of this.sessions.values()) {
      if (session.userId === userId && !session.isRevoked) {
        session.isRevoked = true;
        session.revokedAt = new Date();
        session.revocationReason = reason;
        count++;
      }
    }
    return count;
  }

  async isSessionRevoked(tokenHash: string): Promise<boolean> {
    const s = this.sessions.get(tokenHash);
    if (!s) return false;
    const expiresAt = typeof s.expiresAt === 'string' ? new Date(s.expiresAt) : s.expiresAt;
    return s.isRevoked || expiresAt.getTime() < Date.now();
  }

  // ── Merchants ────────────────────────────────────────────────────────────

  async getMerchant(id: string, organizationId?: string): Promise<Merchant | null> {
    const m = this.merchants.get(id);
    if (!m) return null;
    if (organizationId && m.organizationId && m.organizationId !== organizationId) return null;
    return m;
  }

  async getMerchantById(id: string): Promise<Merchant | null> {
    return this.getMerchant(id);
  }

  async getMerchantByStoreUrl(storeUrl: string): Promise<Merchant | null> {
    const cleanUrl = storeUrl.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    for (const m of this.merchants.values()) {
      if (
        m.storeUrl?.toLowerCase().includes(cleanUrl) ||
        m.shopDomain?.toLowerCase() === cleanUrl
      ) {
        return m;
      }
    }
    return null;
  }

  async getMerchantByShopDomain(shopDomain: string): Promise<Merchant | null> {
    const clean = shopDomain.toLowerCase().trim();
    for (const m of this.merchants.values()) {
      if (m.shopDomain?.toLowerCase() === clean || m.storeUrl?.toLowerCase().includes(clean)) {
        return m;
      }
    }
    return null;
  }

  async listMerchants(organizationId?: string): Promise<Merchant[]> {
    const list = Array.from(this.merchants.values());
    if (organizationId) {
      return list.filter((m) => m.organizationId === organizationId);
    }
    return list;
  }

  async createOrUpdateMerchant(merchant: Merchant): Promise<Merchant> {
    return this.upsertMerchant(merchant);
  }

  async upsertMerchant(merchant: Merchant): Promise<Merchant> {
    this.merchants.set(merchant.id, { ...merchant });
    return merchant;
  }

  async updateMerchantTone(
    id: string,
    updates: Partial<Pick<Merchant, 'brandVoiceCasualVsFormal' | 'brandVoiceUrgencyVsGentle' | 'discountCeilingPercentage' | 'brandToneGuidelines'>>
  ): Promise<Merchant | null> {
    const m = this.merchants.get(id);
    if (!m) return null;
    const updated = { ...m, ...updates };
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

  async getCartByToken(token: string, merchantId?: string): Promise<CartEvent | null> {
    for (const cart of this.cartEvents.values()) {
      if (cart.cartToken === token) {
        if (merchantId && cart.merchantId !== merchantId) return null;
        return cart;
      }
    }
    return null;
  }

  async findCartByCustomerOrToken(identifier: string, merchantId?: string): Promise<CartEvent | null> {
    const clean = identifier.trim().toLowerCase();
    for (const cart of this.cartEvents.values()) {
      if (merchantId && cart.merchantId !== merchantId) continue;
      if (
        cart.cartToken.toLowerCase() === clean ||
        cart.customerEmail?.toLowerCase() === clean ||
        cart.customerPhone?.includes(clean)
      ) {
        return cart;
      }
    }
    return null;
  }

  async upsertCartEvent(cart: CartEvent): Promise<CartEvent> {
    const merchant = this.merchants.get(cart.merchantId);
    let processedCart = { ...cart };

    if (merchant?.dataTier === 'EPHEMERAL') {
      processedCart = {
        ...processedCart,
        customerEmail: hashPii(cart.customerEmail),
        customerPhone: hashPii(cart.customerPhone),
        customerName: '[ANONYMIZED_SHOPPER]',
      };
    }

    this.cartEvents.set(cart.id, processedCart);
    return processedCart;
  }

  async updateCartStatus(
    id: string,
    status: CartStatus,
    stage?: RecoveryStage,
    discountCode?: string | null
  ): Promise<CartEvent | null> {
    const cart = this.cartEvents.get(id);
    if (!cart) return null;
    const updated: CartEvent = {
      ...cart,
      status,
      ...(stage ? { recoveryStage: stage } : {}),
      ...(discountCode !== undefined ? { suggestedDiscountCode: discountCode || undefined } : {}),
      ...(status === 'RECOVERED' ? { recoveredAt: new Date().toISOString() } : {}),
      updatedAt: new Date().toISOString(),
    };
    this.cartEvents.set(id, updated);
    return updated;
  }

  async listCartEvents(merchantId?: string): Promise<CartEvent[]> {
    const list = Array.from(this.cartEvents.values());
    if (merchantId) return list.filter((c) => c.merchantId === merchantId);
    return list;
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
    const p: PaymentRecord = {
      id: `pay_${crypto.randomBytes(6).toString('hex')}`,
      merchantId: data.merchantId,
      externalPaymentId: data.externalPaymentId,
      amountPaise: Number(data.amountPaise),
      currency: data.currency,
      status: data.status || 'FAILED',
      gateway: data.gateway || 'RAZORPAY',
      customerId: data.customerId,
      orderReference: data.orderReference,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.payments.set(p.id, p);
    return p;
  }

  async getPayment(id: string, merchantId?: string): Promise<PaymentRecord | null> {
    const p = this.payments.get(id);
    if (!p) return null;
    if (merchantId && p.merchantId !== merchantId) return null;
    return p;
  }

  async getPaymentByExternalId(externalPaymentId: string, merchantId?: string): Promise<PaymentRecord | null> {
    for (const p of this.payments.values()) {
      if (p.externalPaymentId === externalPaymentId) {
        if (merchantId && p.merchantId !== merchantId) return null;
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
    const rc: RecoveryCaseRecord = {
      id: `rc_${crypto.randomBytes(6).toString('hex')}`,
      merchantId: data.merchantId,
      paymentId: data.paymentId,
      customerId: data.customerId,
      status: 'OPEN',
      attemptCount: 0,
      maxAttempts: 3,
      recoveryProbBps: data.recoveryProbBps || 0,
      expectedValuePaise: Number(data.expectedValuePaise || 0),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.recoveryCases.set(rc.id, rc);
    return rc;
  }

  async getRecoveryCase(id: string, merchantId?: string): Promise<RecoveryCaseRecord | null> {
    const rc = this.recoveryCases.get(id);
    if (!rc) return null;
    if (merchantId && rc.merchantId !== merchantId) return null;
    return rc;
  }

  async updateRecoveryCase(id: string, updates: Partial<RecoveryCaseRecord>, merchantId?: string): Promise<RecoveryCaseRecord | null> {
    const rc = this.recoveryCases.get(id);
    if (!rc) return null;
    if (merchantId && rc.merchantId !== merchantId) return null;
    const updated: RecoveryCaseRecord = {
      ...rc,
      ...updates,
      expectedValuePaise: updates.expectedValuePaise !== undefined ? Number(updates.expectedValuePaise) : rc.expectedValuePaise,
      updatedAt: new Date(),
    };
    this.recoveryCases.set(id, updated);
    return updated;
  }

  async listRecoveryCases(params: { merchantId: string; status?: string; limit?: number; offset?: number }): Promise<RecoveryCaseRecord[]> {
    let list = Array.from(this.recoveryCases.values()).filter((rc) => rc.merchantId === params.merchantId);
    if (params.status) {
      list = list.filter((rc) => rc.status === params.status);
    }
    const offset = params.offset || 0;
    const limit = params.limit || 50;
    return list.slice(offset, offset + limit);
  }

  async searchRecoveryCases(params: SearchRecoveryCasesParams): Promise<{ items: RecoveryCaseRecord[]; total: number }> {
    let list = Array.from(this.recoveryCases.values()).filter((rc) => rc.merchantId === params.merchantId);
    if (params.status) {
      list = list.filter((rc) => rc.status === params.status);
    }
    if (params.minExpectedValuePaise) {
      const min = Number(params.minExpectedValuePaise);
      list = list.filter((rc) => Number(rc.expectedValuePaise) >= min);
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      list = list.filter((rc) =>
        rc.id.toLowerCase().includes(q) ||
        rc.paymentId.toLowerCase().includes(q) ||
        rc.customerId?.toLowerCase().includes(q)
      );
    }
    const total = list.length;
    const offset = params.offset || 0;
    const limit = params.limit || 50;
    return {
      items: list.slice(offset, offset + limit),
      total,
    };
  }

  // ── Unit of Work Atomic Transactions ─────────────────────────────────────

  async createRecoveryCaseAndEnqueue(params: CreateRecoveryCaseAndEnqueueParams): Promise<{
    payment: PaymentRecord;
    recoveryCase: RecoveryCaseRecord;
    outbox: OutboxEventRecord;
  }> {
    const payment = await this.createPayment(params.payment);
    const recoveryCase = await this.createRecoveryCase({
      ...params.recoveryCase,
      merchantId: params.payment.merchantId,
      paymentId: payment.id,
    });
    const outbox = await this.createOutboxEvent({
      merchantId: params.payment.merchantId,
      aggregateType: 'RECOVERY_CASE',
      aggregateId: recoveryCase.id,
      eventType: params.outbox.eventType,
      payload: { ...params.outbox.payload, recoveryCaseId: recoveryCase.id, paymentId: payment.id },
      idempotencyKey: params.outbox.idempotencyKey,
    });
    return { payment, recoveryCase, outbox };
  }

  async ingestRazorpayWebhookTransaction(params: IngestRazorpayWebhookParams): Promise<{
    webhook: WebhookEventRecord;
    payment?: PaymentRecord;
    recoveryCase?: RecoveryCaseRecord;
    outbox?: OutboxEventRecord;
  }> {
    const webhook = await this.createWebhookEvent({
      ...params.webhookEvent,
      signatureValid: params.webhookEvent.signatureValid,
    });
    await this.markWebhookEventProcessed(webhook.id, 'PROCESSED');

    let payment: PaymentRecord | undefined;
    let recoveryCase: RecoveryCaseRecord | undefined;
    let outbox: OutboxEventRecord | undefined;

    if (params.payment) {
      payment = await this.createPayment(params.payment);
      if (params.recoveryCase) {
        recoveryCase = await this.createRecoveryCase({
          ...params.recoveryCase,
          merchantId: params.payment.merchantId,
          paymentId: payment.id,
        });
        if (params.outbox) {
          outbox = await this.createOutboxEvent({
            merchantId: params.payment.merchantId,
            aggregateType: 'RECOVERY_CASE',
            aggregateId: recoveryCase.id,
            eventType: params.outbox.eventType,
            payload: { ...params.outbox.payload, recoveryCaseId: recoveryCase.id, paymentId: payment.id },
            idempotencyKey: params.outbox.idempotencyKey,
          });
        }
      }
    }

    return { webhook, payment, recoveryCase, outbox };
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
      expectedValuePaise: Number(data.expectedValuePaise),
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
    const att: RecoveryAttemptRecord = {
      id: `att_${crypto.randomBytes(6).toString('hex')}`,
      recoveryCaseId: data.recoveryCaseId,
      attemptNumber: data.attemptNumber,
      channel: data.channel,
      status: data.status || 'PENDING',
      dispatchedAt: new Date(),
      providerResponse: data.providerResponse,
      createdAt: new Date(),
    };
    this.recoveryAttempts.set(att.id, att);
    return att;
  }

  async createRecoveryOutcome(data: {
    recoveryCaseId: string;
    isRecovered: boolean;
    recoveredAmountPaise: bigint | number;
    feeAmountPaise?: bigint | number;
    observedVia: string;
  }): Promise<RecoveryOutcomeRecord> {
    const out: RecoveryOutcomeRecord = {
      id: `out_${crypto.randomBytes(6).toString('hex')}`,
      recoveryCaseId: data.recoveryCaseId,
      isRecovered: data.isRecovered,
      recoveredAmountPaise: Number(data.recoveredAmountPaise),
      feeAmountPaise: Number(data.feeAmountPaise || 0),
      observedVia: data.observedVia,
      verifiedAt: new Date(),
      createdAt: new Date(),
    };
    this.recoveryOutcomes.set(out.id, out);
    return out;
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
    const evt: OutboxEventRecord = {
      id: `obx_${crypto.randomBytes(6).toString('hex')}`,
      merchantId: data.merchantId,
      aggregateType: data.aggregateType,
      aggregateId: data.aggregateId,
      eventType: data.eventType,
      payload: data.payload,
      idempotencyKey: data.idempotencyKey,
      status: 'PENDING',
      attemptCount: 0,
      retryCount: 0,
      maxAttempts: 5,
      availableAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      processedAt: null,
    };
    this.outboxEvents.set(evt.id, evt);
    return evt;
  }

  async getPendingOutboxEvents(batchSize = 20, merchantId?: string): Promise<OutboxEventRecord[]> {
    const now = Date.now();
    let list = Array.from(this.outboxEvents.values())
      .filter((e) => e.status === 'PENDING' && new Date(e.availableAt).getTime() <= now);
    if (merchantId) {
      list = list.filter((e) => e.merchantId === merchantId);
    }
    return list.slice(0, batchSize);
  }

  async claimOutboxEvents(workerId: string, batchSize = 20, lockTtlMs = 30000): Promise<OutboxEventRecord[]> {
    const now = Date.now();
    const expiredCutoff = now - lockTtlMs;
    const candidates = Array.from(this.outboxEvents.values())
      .filter((e) => {
        if (e.status === 'PENDING' && new Date(e.availableAt).getTime() <= now) return true;
        if (e.status === 'PROCESSING' && e.lockedAt && new Date(e.lockedAt).getTime() <= expiredCutoff) return true;
        return false;
      })
      .slice(0, batchSize);

    for (const c of candidates) {
      c.status = 'PROCESSING';
      c.lockedBy = workerId;
      c.lockedAt = new Date();
      c.attemptCount += 1;
      c.updatedAt = new Date();
    }
    return candidates;
  }

  async markOutboxEventProcessing(id: string, workerId?: string): Promise<void> {
    const evt = this.outboxEvents.get(id);
    if (!evt) return;
    evt.status = 'PROCESSING';
    evt.lockedAt = new Date();
    if (workerId) evt.lockedBy = workerId;
  }

  async markOutboxEventPublished(id: string, workerId?: string): Promise<boolean> {
    const evt = this.outboxEvents.get(id);
    if (!evt) return false;
    if (workerId && evt.lockedBy && evt.lockedBy !== workerId) return false;
    evt.status = 'PUBLISHED';
    evt.publishedAt = new Date();
    evt.processedAt = new Date();
    evt.lockedBy = null;
    evt.lockedAt = null;
    return true;
  }

  async markOutboxEventFailed(id: string, error: string, retryDelayMs = 5000, workerId?: string): Promise<boolean> {
    const evt = this.outboxEvents.get(id);
    if (!evt) return false;
    if (workerId && evt.lockedBy && evt.lockedBy !== workerId) return false;
    evt.retryCount = (evt.retryCount || 0) + 1;
    evt.attemptCount = (evt.attemptCount || 0) + 1;
    const shouldFail = (evt.attemptCount >= evt.maxAttempts) || (evt.retryCount >= evt.maxAttempts);
    evt.lastError = error;
    evt.lockedBy = null;
    evt.lockedAt = null;
    evt.status = shouldFail ? 'FAILED' : 'PENDING';
    evt.availableAt = shouldFail ? evt.availableAt : new Date(Date.now() + retryDelayMs);
    return true;
  }

  async extendOutboxLease(id: string, workerId: string, _extendMs = 30000): Promise<boolean> {
    const evt = this.outboxEvents.get(id);
    if (!evt) return false;
    if (evt.lockedBy !== workerId || evt.status !== 'PROCESSING') return false;
    evt.lockedAt = new Date();
    evt.updatedAt = new Date();
    return true;
  }

  // ── Idempotency Store ────────────────────────────────────────────────────

  async acquireIdempotencyKey(params: {
    key: string;
    merchantId: string;
    endpoint: string;
    requestHash?: string;
    ttlMs?: number;
  }): Promise<{ acquired: boolean; existingResponse?: { code: number; body: unknown }; isConflict?: boolean }> {
    const compositeKey = `${params.merchantId}:${params.endpoint}:${params.key}`;
    const existing = this.idempotencyKeys.get(compositeKey);
    const now = Date.now();
    const ttl = params.ttlMs || 24 * 60 * 60 * 1000;
    const expiresAt = new Date(now + ttl);

    if (existing) {
      const exp = new Date(existing.expiresAt).getTime();
      if (exp <= now) {
        existing.status = 'IN_PROGRESS';
        existing.lockedUntil = new Date(now + 30000);
        existing.requestHash = params.requestHash;
        existing.expiresAt = expiresAt;
        return { acquired: true };
      }

      if (params.requestHash && existing.requestHash && params.requestHash !== existing.requestHash) {
        return { acquired: false, isConflict: true };
      }

      if (existing.status === 'COMMITTED' && existing.responseCode !== null) {
        return {
          acquired: false,
          existingResponse: {
            code: existing.responseCode!,
            body: existing.responseBody,
          },
        };
      }

      if (existing.status === 'IN_PROGRESS' && existing.lockedUntil && new Date(existing.lockedUntil).getTime() > now) {
        return { acquired: false };
      }

      existing.status = 'IN_PROGRESS';
      existing.lockedUntil = new Date(now + 30000);
      existing.version += 1;
      return { acquired: true };
    }

    const rec: IdempotencyKeyRecord = {
      key: params.key,
      merchantId: params.merchantId,
      endpoint: params.endpoint,
      requestHash: params.requestHash,
      status: 'IN_PROGRESS',
      lockedUntil: new Date(now + 30000),
      version: 1,
      createdAt: new Date(),
      expiresAt,
    };
    this.idempotencyKeys.set(compositeKey, rec);
    return { acquired: true };
  }

  async commitIdempotencyKey(key: string, merchantId: string, responseCode: number, responseBody: unknown, endpoint = ''): Promise<void> {
    for (const [, rec] of this.idempotencyKeys.entries()) {
      if (rec.key === key && rec.merchantId === merchantId && (!endpoint || rec.endpoint === endpoint)) {
        rec.status = 'COMMITTED';
        rec.responseCode = responseCode;
        rec.responseBody = responseBody;
        rec.lockedUntil = null;
      }
    }
  }

  async releaseIdempotencyKey(key: string, merchantId: string, endpoint = ''): Promise<void> {
    for (const [compositeKey, rec] of this.idempotencyKeys.entries()) {
      if (rec.key === key && rec.merchantId === merchantId && (!endpoint || rec.endpoint === endpoint)) {
        this.idempotencyKeys.delete(compositeKey);
      }
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
    const evt: WebhookEventRecord = {
      id: `whk_${crypto.randomBytes(6).toString('hex')}`,
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
    this.webhookEvents.set(evt.id, evt);
    return evt;
  }

  async getWebhookEvent(provider: string, providerEventId: string): Promise<WebhookEventRecord | null> {
    for (const evt of this.webhookEvents.values()) {
      if (evt.provider === provider && (evt.providerEventId === providerEventId || evt.idempotencyKey === providerEventId)) {
        return evt;
      }
    }
    return null;
  }

  async markWebhookEventProcessed(id: string, status: 'PROCESSED' | 'FAILED', error?: string): Promise<void> {
    const evt = this.webhookEvents.get(id);
    if (!evt) return;
    evt.status = status;
    evt.processedAt = new Date();
    evt.errorMessage = error;
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
    const latest = await this.getLatestAuditEvent(data.merchantId || undefined);
    const previousHash = latest ? latest.currentHash : '0'.repeat(64);
    const currentHash = crypto
      .createHash('sha256')
      .update(`${previousHash}:${data.actorType}:${data.action}:${data.entityId}:${data.payloadHash}`)
      .digest('hex');

    const created: AuditEventRecord = {
      id: `aud_${crypto.randomBytes(6).toString('hex')}`,
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
    this.auditEvents.set(created.id, created);
    return created;
  }

  async getLatestAuditEvent(merchantId?: string): Promise<AuditEventRecord | null> {
    let latest: AuditEventRecord | null = null;
    for (const evt of this.auditEvents.values()) {
      if (merchantId && evt.merchantId !== merchantId) continue;
      if (!latest || new Date(evt.createdAt).getTime() > new Date(latest.createdAt).getTime()) {
        latest = evt;
      }
    }
    return latest;
  }

  async listAuditEvents(params: { merchantId?: string; entityType?: string; entityId?: string; limit?: number }): Promise<AuditEventRecord[]> {
    let list = Array.from(this.auditEvents.values());
    if (params.merchantId) list = list.filter((e) => e.merchantId === params.merchantId);
    if (params.entityType) list = list.filter((e) => e.entityType === params.entityType);
    if (params.entityId) list = list.filter((e) => e.entityId === params.entityId);
    return list.slice(0, params.limit || 100);
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

  // ── Messages, Suppressions & E-Commerce ──────────────────────────────────

  async logMessage(log: MessageLog): Promise<MessageLog> {
    this.messageLogs.set(log.id, { ...log });
    return log;
  }

  async listMessageLogs(merchantId?: string): Promise<MessageLog[]> {
    const list = Array.from(this.messageLogs.values());
    if (merchantId) return list.filter((l) => l.merchantId === merchantId);
    return list;
  }

  async addSuppression(entry: SuppressionEntry): Promise<SuppressionEntry> {
    this.suppressions.set(entry.identifier, { ...entry });
    return entry;
  }

  async isSuppressed(identifier: string, type: 'PHONE' | 'EMAIL'): Promise<boolean> {
    const s = this.suppressions.get(identifier);
    return !!(s && s.type === type);
  }

  async getSuppressionList(): Promise<SuppressionEntry[]> {
    return Array.from(this.suppressions.values());
  }

  async removeSuppression(identifier: string): Promise<boolean> {
    return this.suppressions.delete(identifier);
  }

  async upsertOrder(order: OrderRecord): Promise<OrderRecord> {
    this.orders.set(order.id, { ...order });
    return order;
  }

  async createOrUpdateOrder(order: OrderRecord): Promise<OrderRecord> {
    return this.upsertOrder(order);
  }

  async getOrder(id: string, merchantId?: string): Promise<OrderRecord | null> {
    const o = this.orders.get(id);
    if (!o) return null;
    if (merchantId && o.merchantId !== merchantId) return null;
    return o;
  }

  async getOrderByShopifyId(shopifyOrderId: string): Promise<OrderRecord | null> {
    for (const o of this.orders.values()) {
      if (o.shopifyOrderId === shopifyOrderId) return o;
    }
    return null;
  }

  async getOrderByOrderNumber(merchantId: string, orderNumber: string): Promise<OrderRecord | null> {
    for (const o of this.orders.values()) {
      if (o.merchantId === merchantId && o.orderNumber === orderNumber) return o;
    }
    return null;
  }

  async findOrdersByCustomer(merchantId: string, identifier: string): Promise<OrderRecord[]> {
    const clean = identifier.trim().toLowerCase();
    const list: OrderRecord[] = [];
    for (const o of this.orders.values()) {
      if (o.merchantId !== merchantId) continue;
      if (
        o.customerEmail?.toLowerCase() === clean ||
        o.customerPhone?.includes(clean) ||
        o.customerName?.toLowerCase().includes(clean)
      ) {
        list.push(o);
      }
    }
    return list;
  }

  async listOrders(merchantId?: string): Promise<OrderRecord[]> {
    const list = Array.from(this.orders.values());
    if (merchantId) return list.filter((o) => o.merchantId === merchantId);
    return list;
  }

    async listFulfillments(merchantId?: string): Promise<FulfillmentRecord[]> {
    const list = Array.from(this.fulfillments.values());
    if (merchantId) return list.filter((f) => f.merchantId === merchantId);
    return list;
  }

  async upsertFulfillment(fulfillment: FulfillmentRecord): Promise<FulfillmentRecord> {
    this.fulfillments.set(fulfillment.id, { ...fulfillment });
    return fulfillment;
  }

  async createOrUpdateFulfillment(fulfillment: FulfillmentRecord): Promise<FulfillmentRecord> {
    return this.upsertFulfillment(fulfillment);
  }

  async getFulfillment(id: string): Promise<FulfillmentRecord | null> {
    return this.fulfillments.get(id) || null;
  }

  async getFulfillmentByShopifyId(shopifyFulfillmentId: string): Promise<FulfillmentRecord | null> {
    for (const f of this.fulfillments.values()) {
      if (f.shopifyFulfillmentId === shopifyFulfillmentId) return f;
    }
    return null;
  }

  async getFulfillmentsByOrderId(orderId: string): Promise<FulfillmentRecord[]> {
    return Array.from(this.fulfillments.values()).filter((f) => f.orderId === orderId);
  }

  async findFulfillmentByTracking(merchantId: string, trackingNumber: string): Promise<FulfillmentRecord | null> {
    const orderIds = new Set(
      Array.from(this.orders.values())
        .filter((o) => o.merchantId === merchantId)
        .map((o) => o.id)
    );
    for (const f of this.fulfillments.values()) {
      if (orderIds.has(f.orderId) && f.trackingNumber === trackingNumber) {
        return f;
      }
    }
    return null;
  }

  async upsertReturn(ret: ReturnRecord): Promise<ReturnRecord> {
    this.returns.set(ret.id, { ...ret });
    return ret;
  }

  async createOrUpdateReturn(ret: ReturnRecord): Promise<ReturnRecord> {
    return this.upsertReturn(ret);
  }

  async getReturn(id: string): Promise<ReturnRecord | null> {
    return this.returns.get(id) || null;
  }

  async getReturnsByOrderId(orderId: string): Promise<ReturnRecord[]> {
    return Array.from(this.returns.values()).filter((r) => r.orderId === orderId);
  }

  async listReturns(merchantId?: string): Promise<ReturnRecord[]> {
    if (merchantId) {
      const orderIds = new Set(
        Array.from(this.orders.values())
          .filter((o) => o.merchantId === merchantId)
          .map((o) => o.id)
      );
      return Array.from(this.returns.values()).filter((r) => orderIds.has(r.orderId));
    }
    return Array.from(this.returns.values());
  }

  async logSecurityIncident(incident: SecurityIncident): Promise<SecurityIncident> {
    this.securityIncidents.set(incident.id, { ...incident });
    return incident;
  }

  async listSecurityIncidents(merchantId?: string): Promise<SecurityIncident[]> {
    const list = Array.from(this.securityIncidents.values());
    if (merchantId) return list.filter((i) => i.merchantId === merchantId);
    return list;
  }

  // ── Compatibility & Omni-Lifecycle Helpers ───────────────────────────────

  setAdminTakeover(cartId: string, durationMs = 15 * 60 * 1000): void {
    this.takeoverLocks.set(cartId, Date.now() + durationMs);
  }

  removeAdminTakeover(cartId: string): void {
    this.takeoverLocks.delete(cartId);
  }

  isAdminTakenOver(cartId: string): boolean {
    const expiry = this.takeoverLocks.get(cartId);
    if (!expiry) return false;
    if (Date.now() > expiry) {
      this.takeoverLocks.delete(cartId);
      return false;
    }
    return true;
  }

  isAdminTakeover(cartId: string): boolean {
    return this.isAdminTakenOver(cartId);
  }

  getAdminTakeoverRemainingMs(cartId: string): number {
    const expiry = this.takeoverLocks.get(cartId);
    if (!expiry) return 0;
    const remaining = expiry - Date.now();
    if (remaining <= 0) {
      this.takeoverLocks.delete(cartId);
      return 0;
    }
    return remaining;
  }

  generateOutboxIdempotencyKey(shopDomain: string, cartToken: string, timestamp: number | string | Date): string {
    const ts = timestamp instanceof Date ? timestamp.toISOString() : String(timestamp);
    return crypto.createHash('sha256').update(`${shopDomain}:${cartToken}:${ts}`).digest('hex');
  }

  async createCartWithOutbox(
    cartData: Omit<CartEvent, 'id' | 'createdAt' | 'updatedAt'>,
    customOutbox?: Partial<OutboxEventRecord>
  ): Promise<{ cart: CartEvent; outbox: OutboxEventRecord }> {
    const cart: CartEvent = {
      ...cartData,
      id: `cart_${crypto.randomBytes(6).toString('hex')}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.cartEvents.set(cart.id, cart);

    const idempotencyKey =
      customOutbox?.idempotencyKey ||
      this.generateOutboxIdempotencyKey(cartData.merchantId, cartData.cartToken, Date.now());

    const outbox: OutboxEventRecord = {
      id: `obx_${crypto.randomBytes(6).toString('hex')}`,
      merchantId: cartData.merchantId,
      aggregateType: 'CART',
      aggregateId: cart.id,
      eventType: customOutbox?.eventType || 'CART_ABANDONED',
      payload: customOutbox?.payload || { cartId: cart.id, cartToken: cart.cartToken },
      idempotencyKey,
      status: 'PENDING',
      attemptCount: 0,
      maxAttempts: 5,
      availableAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.outboxEvents.set(outbox.id, outbox);

    return { cart, outbox };
  }

  async pruneRecordsOlderThan(retentionDays = 90): Promise<{ prunedCarts: number; prunedLogs: number }> {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    let prunedCarts = 0;
    let prunedLogs = 0;

    for (const [id, cart] of this.cartEvents.entries()) {
      if (
        (cart.status === 'RECOVERED' || cart.status === 'EXPIRED') &&
        new Date(cart.createdAt).getTime() < cutoff
      ) {
        this.cartEvents.delete(id);
        prunedCarts++;
      }
    }

    for (const [id, log] of this.messageLogs.entries()) {
      if (log.sentAt && new Date(log.sentAt).getTime() < cutoff) {
        this.messageLogs.delete(id);
        prunedLogs++;
      }
    }

    return { prunedCarts, prunedLogs };
  }
}
