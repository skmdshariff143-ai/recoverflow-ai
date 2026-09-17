/**
 * RecoverFlow AI — Prisma PostgreSQL Database Adapter (Production / Sandbox)
 *
 * Implements DatabasePort backed by PostgreSQL via Prisma ORM.
 * Guarantees transactional atomicity ($transaction), durable idempotency keys,
 * concurrent worker outbox claiming, persistent Merkle audit ledger, and session revocation.
 */

import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import type {
  Merchant,
  CartEvent,
  MessageLog,
  SuppressionEntry,
  CartStatus,
  RecoveryStage,
  AbandonmentType,
  MessageChannel,
  MessageDirection,
  DeliveryStatus,
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

export class PrismaDatabase implements DatabasePort {
  public readonly isDurable = true;
  public readonly providerName = 'PrismaDatabase (PostgreSQL Durable)';
  public readonly prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || new PrismaClient();
  }

  async ping(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async getHealth(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; latencyMs: number; details?: Record<string, unknown> }> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const latencyMs = Date.now() - start;
      return {
        status: latencyMs > 500 ? 'degraded' : 'healthy',
        latencyMs,
        details: { provider: 'postgresql', durable: true },
      };
    } catch (err: unknown) {
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        details: { error: err instanceof Error ? err.message : String(err) },
      };
    }
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }

  // ── Identity & Organizations ─────────────────────────────────────────────

  async getOrganization(id: string): Promise<OrganizationRecord | null> {
    return this.prisma.organization.findUnique({ where: { id } });
  }

  async getOrganizationBySlug(slug: string): Promise<OrganizationRecord | null> {
    return this.prisma.organization.findUnique({ where: { slug } });
  }

  async createOrganization(data: { name: string; slug: string }): Promise<OrganizationRecord> {
    return this.prisma.organization.create({
      data: { name: data.name, slug: data.slug },
    });
  }

  async getUser(id: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async createUser(data: { email: string; name?: string }): Promise<UserRecord> {
    return this.prisma.user.create({
      data: { email: data.email, name: data.name },
    });
  }

  async getMembership(userId: string, organizationId: string): Promise<MembershipRecord | null> {
    const mem = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    if (!mem) return null;
    return { ...mem, role: mem.role as UserRole };
  }

  async createMembership(data: { userId: string; organizationId: string; role: UserRole }): Promise<MembershipRecord> {
    const mem = await this.prisma.membership.create({
      data: {
        userId: data.userId,
        organizationId: data.organizationId,
        role: data.role as any,
      },
    });
    return { ...mem, role: mem.role as UserRole };
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
    const sess = await this.prisma.session.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        organizationId: data.organizationId,
        activeMerchantId: data.activeMerchantId,
        role: data.role as any,
        expiresAt: data.expiresAt,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
    return { ...sess, role: sess.role as UserRole };
  }

  async getSession(tokenHash: string): Promise<SessionRecord | null> {
    const sess = await this.prisma.session.findUnique({ where: { tokenHash } });
    if (!sess) return null;
    return { ...sess, role: sess.role as UserRole };
  }

  async revokeSession(sessionId: string, reason: string, revokedBy?: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.session.update({
        where: { id: sessionId },
        data: { isRevoked: true, revokedAt: new Date(), revocationReason: reason },
      }),
      this.prisma.sessionRevocation.create({
        data: { sessionId, reason, revokedBy },
      }),
    ]);
  }

  async revokeAllUserSessions(userId: string, reason: string, revokedBy?: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date(), revocationReason: reason },
    });
    await this.prisma.sessionRevocation.create({
      data: { userId, reason, revokedBy },
    });
    return result.count;
  }

  async isSessionRevoked(tokenHash: string): Promise<boolean> {
    const s = await this.prisma.session.findUnique({ where: { tokenHash } });
    if (!s) return false;
    return s.isRevoked || s.expiresAt.getTime() < Date.now();
  }

  // ── Merchants ────────────────────────────────────────────────────────────

  async getMerchant(id: string, organizationId?: string): Promise<Merchant | null> {
    const m = await this.prisma.merchant.findUnique({ where: { id } });
    if (!m) return null;
    if (organizationId && m.organizationId && m.organizationId !== organizationId) return null;
    return m as unknown as Merchant;
  }

  async getMerchantById(id: string): Promise<Merchant | null> {
    return this.getMerchant(id);
  }

  async getMerchantByStoreUrl(storeUrl: string): Promise<Merchant | null> {
    const cleanUrl = storeUrl.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    const m = await this.prisma.merchant.findFirst({
      where: {
        OR: [
          { storeUrl: { contains: cleanUrl, mode: 'insensitive' } },
          { shopDomain: { equals: cleanUrl, mode: 'insensitive' } },
        ],
      },
    });
    return m as unknown as Merchant | null;
  }

  async getMerchantByShopDomain(shopDomain: string): Promise<Merchant | null> {
    const clean = shopDomain.toLowerCase().trim();
    const m = await this.prisma.merchant.findFirst({
      where: {
        OR: [
          { shopDomain: { equals: clean, mode: 'insensitive' } },
          { storeUrl: { contains: clean, mode: 'insensitive' } },
        ],
      },
    });
    return m as unknown as Merchant | null;
  }

  async listMerchants(organizationId?: string): Promise<Merchant[]> {
    const list = await this.prisma.merchant.findMany({
      where: organizationId ? { organizationId } : undefined,
    });
    return list as unknown as Merchant[];
  }

  async createOrUpdateMerchant(merchant: Merchant): Promise<Merchant> {
    return this.upsertMerchant(merchant);
  }

  async upsertMerchant(merchant: Merchant): Promise<Merchant> {
    const upserted = await this.prisma.merchant.upsert({
      where: { id: merchant.id },
      create: {
        id: merchant.id,
        storeUrl: merchant.storeUrl,
        shopDomain: merchant.shopDomain,
        storeName: merchant.storeName,
        webhookSecret: merchant.webhookSecret,
        shopifyScopes: merchant.shopifyScopes || [],
        encryptedShopifyAccessToken: merchant.encryptedShopifyAccessToken,
        encryptedWhatsappToken: merchant.encryptedWhatsappToken,
        whatsappPhoneId: merchant.whatsappPhoneId,
        whatsappTemplateName: merchant.whatsappTemplateName,
        encryptedResendApiKey: merchant.encryptedResendApiKey,
        fromEmail: merchant.fromEmail,
        supportPhone: merchant.supportPhone,
        brandToneGuidelines: merchant.brandToneGuidelines,
        brandVoiceCasualVsFormal: merchant.brandVoiceCasualVsFormal,
        brandVoiceUrgencyVsGentle: merchant.brandVoiceUrgencyVsGentle,
        discountCeilingPercentage: merchant.discountCeilingPercentage,
        minMarginPercentage: merchant.minMarginPercentage,
        dataTier: merchant.dataTier || 'STANDARD',
      },
      update: {
        storeUrl: merchant.storeUrl,
        shopDomain: merchant.shopDomain,
        storeName: merchant.storeName,
        webhookSecret: merchant.webhookSecret,
        shopifyScopes: merchant.shopifyScopes || [],
        encryptedShopifyAccessToken: merchant.encryptedShopifyAccessToken,
        encryptedWhatsappToken: merchant.encryptedWhatsappToken,
        whatsappPhoneId: merchant.whatsappPhoneId,
        whatsappTemplateName: merchant.whatsappTemplateName,
        encryptedResendApiKey: merchant.encryptedResendApiKey,
        fromEmail: merchant.fromEmail,
        supportPhone: merchant.supportPhone,
        brandToneGuidelines: merchant.brandToneGuidelines,
        brandVoiceCasualVsFormal: merchant.brandVoiceCasualVsFormal,
        brandVoiceUrgencyVsGentle: merchant.brandVoiceUrgencyVsGentle,
        discountCeilingPercentage: merchant.discountCeilingPercentage,
        minMarginPercentage: merchant.minMarginPercentage,
        dataTier: merchant.dataTier || 'STANDARD',
      },
    });
    return upserted as unknown as Merchant;
  }

  async updateMerchantTone(
    id: string,
    updates: Partial<Pick<Merchant, 'brandVoiceCasualVsFormal' | 'brandVoiceUrgencyVsGentle' | 'discountCeilingPercentage' | 'brandToneGuidelines'>>
  ): Promise<Merchant | null> {
    const updated = await this.prisma.merchant.update({
      where: { id },
      data: updates,
    });
    return updated as unknown as Merchant | null;
  }

  // ── Cart & Checkout Events ───────────────────────────────────────────────

  async getCartById(id: string, merchantId?: string): Promise<CartEvent | null> {
    const cart = await this.prisma.cartEvent.findFirst({
      where: { id, ...(merchantId ? { merchantId } : {}) },
    });
    return cart as unknown as CartEvent | null;
  }

  async getCartEvent(id: string, merchantId?: string): Promise<CartEvent | null> {
    return this.getCartById(id, merchantId);
  }

  async getCartByToken(cartToken: string, merchantId?: string): Promise<CartEvent | null> {
    const cart = await this.prisma.cartEvent.findFirst({
      where: { cartToken, ...(merchantId ? { merchantId } : {}) },
    });
    return cart as unknown as CartEvent | null;
  }

  async findCartByCustomerOrToken(identifier: string, merchantId?: string): Promise<CartEvent | null> {
    const clean = identifier.trim();
    const cart = await this.prisma.cartEvent.findFirst({
      where: {
        ...(merchantId ? { merchantId } : {}),
        OR: [
          { cartToken: { equals: clean, mode: 'insensitive' } },
          { customerEmail: { equals: clean, mode: 'insensitive' } },
          { customerPhone: { contains: clean } },
        ],
      },
    });
    return cart as unknown as CartEvent | null;
  }

  async upsertCartEvent(cart: CartEvent): Promise<CartEvent> {
    const upserted = await this.prisma.cartEvent.upsert({
      where: { cartToken: cart.cartToken },
      create: {
        id: cart.id,
        cartToken: cart.cartToken,
        merchantId: cart.merchantId,
        customerPhone: cart.customerPhone,
        customerEmail: cart.customerEmail,
        customerName: cart.customerName,
        currency: cart.currency,
        totalPrice: cart.totalPrice,
        items: cart.items as any,
        status: cart.status as any,
        abandonmentType: cart.abandonmentType as any,
        recoveryStage: cart.recoveryStage as any,
        checkoutUrl: cart.checkoutUrl,
        suggestedDiscountCode: cart.suggestedDiscountCode,
      },
      update: {
        customerPhone: cart.customerPhone,
        customerEmail: cart.customerEmail,
        customerName: cart.customerName,
        currency: cart.currency,
        totalPrice: cart.totalPrice,
        items: cart.items as any,
        status: cart.status as any,
        abandonmentType: cart.abandonmentType as any,
        recoveryStage: cart.recoveryStage as any,
        checkoutUrl: cart.checkoutUrl,
        suggestedDiscountCode: cart.suggestedDiscountCode,
      },
    });
    return upserted as unknown as CartEvent;
  }

  async updateCartStatus(
    id: string,
    status: CartStatus,
    stage?: RecoveryStage,
    discountCode?: string | null
  ): Promise<CartEvent | null> {
    const updated = await this.prisma.cartEvent.update({
      where: { id },
      data: {
        status: status as any,
        ...(stage ? { recoveryStage: stage as any } : {}),
        ...(discountCode !== undefined ? { suggestedDiscountCode: discountCode } : {}),
        ...(status === 'RECOVERED' ? { recoveredAt: new Date() } : {}),
      },
    });
    return updated as unknown as CartEvent | null;
  }

  async listCartEvents(merchantId?: string): Promise<CartEvent[]> {
    const list = await this.prisma.cartEvent.findMany({
      where: merchantId ? { merchantId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return list as unknown as CartEvent[];
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
    const p = await this.prisma.payment.create({
      data: {
        merchantId: data.merchantId,
        externalPaymentId: data.externalPaymentId,
        amountPaise: BigInt(data.amountPaise),
        currency: data.currency,
        status: (data.status as any) || 'FAILED',
        gateway: data.gateway || 'RAZORPAY',
        customerId: data.customerId,
        orderReference: data.orderReference,
      },
    });
    return { ...p, amountPaise: Number(p.amountPaise) };
  }

  async getPayment(id: string, merchantId?: string): Promise<PaymentRecord | null> {
    const p = await this.prisma.payment.findFirst({
      where: { id, ...(merchantId ? { merchantId } : {}) },
    });
    if (!p) return null;
    return { ...p, amountPaise: Number(p.amountPaise) };
  }

  async getPaymentByExternalId(externalPaymentId: string, merchantId?: string): Promise<PaymentRecord | null> {
    const p = await this.prisma.payment.findFirst({
      where: { externalPaymentId, ...(merchantId ? { merchantId } : {}) },
    });
    if (!p) return null;
    return { ...p, amountPaise: Number(p.amountPaise) };
  }

  async createRecoveryCase(data: {
    merchantId: string;
    paymentId: string;
    customerId?: string;
    recoveryProbBps?: number;
    expectedValuePaise?: bigint | number;
  }): Promise<RecoveryCaseRecord> {
    const rc = await this.prisma.recoveryCase.create({
      data: {
        merchantId: data.merchantId,
        paymentId: data.paymentId,
        customerId: data.customerId,
        recoveryProbBps: data.recoveryProbBps || 0,
        expectedValuePaise: BigInt(data.expectedValuePaise || 0),
      },
    });
    return { ...rc, expectedValuePaise: Number(rc.expectedValuePaise) };
  }

  async getRecoveryCase(id: string, merchantId?: string): Promise<RecoveryCaseRecord | null> {
    const rc = await this.prisma.recoveryCase.findFirst({
      where: { id, ...(merchantId ? { merchantId } : {}) },
    });
    if (!rc) return null;
    return { ...rc, expectedValuePaise: Number(rc.expectedValuePaise) };
  }

  async updateRecoveryCase(id: string, updates: Partial<RecoveryCaseRecord>, merchantId?: string): Promise<RecoveryCaseRecord | null> {
    const data: Record<string, unknown> = { ...updates };
    if (updates.expectedValuePaise !== undefined) {
      data.expectedValuePaise = BigInt(updates.expectedValuePaise);
    }
    const rc = await this.prisma.recoveryCase.update({
      where: { id },
      data: data as any,
    });
    return { ...rc, expectedValuePaise: Number(rc.expectedValuePaise) };
  }

  async listRecoveryCases(params: { merchantId: string; status?: string; limit?: number; offset?: number }): Promise<RecoveryCaseRecord[]> {
    const list = await this.prisma.recoveryCase.findMany({
      where: {
        merchantId: params.merchantId,
        ...(params.status ? { status: params.status as any } : {}),
      },
      skip: params.offset || 0,
      take: params.limit || 50,
      orderBy: { createdAt: 'desc' },
    });
    return list.map((rc) => ({ ...rc, expectedValuePaise: Number(rc.expectedValuePaise) }));
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
    const dec = await this.prisma.recoveryDecision.create({
      data: {
        recoveryCaseId: data.recoveryCaseId,
        recommendedAction: data.recommendedAction,
        probRecoveryBps: data.probRecoveryBps,
        expectedValuePaise: BigInt(data.expectedValuePaise),
        featuresSnapshot: data.featuresSnapshot as any,
        aiAdvisoryAnalysis: data.aiAdvisoryAnalysis,
        isHaltedBySafety: data.isHaltedBySafety || false,
        safetyHaltReason: data.safetyHaltReason,
      },
    });
    return {
      ...dec,
      expectedValuePaise: Number(dec.expectedValuePaise),
      featuresSnapshot: dec.featuresSnapshot as Record<string, unknown>,
    };
  }

  async createRecoveryAttempt(data: {
    recoveryCaseId: string;
    attemptNumber: number;
    channel: string;
    status?: string;
    providerResponse?: Record<string, unknown>;
  }): Promise<RecoveryAttemptRecord> {
    const att = await this.prisma.recoveryAttempt.create({
      data: {
        recoveryCaseId: data.recoveryCaseId,
        attemptNumber: data.attemptNumber,
        channel: data.channel,
        status: data.status || 'PENDING',
        providerResponse: data.providerResponse as any,
      },
    });
    return {
      ...att,
      providerResponse: att.providerResponse as Record<string, unknown> | null,
    };
  }

  async createRecoveryOutcome(data: {
    recoveryCaseId: string;
    isRecovered: boolean;
    recoveredAmountPaise: bigint | number;
    feeAmountPaise?: bigint | number;
    observedVia: string;
  }): Promise<RecoveryOutcomeRecord> {
    const out = await this.prisma.recoveryOutcome.create({
      data: {
        recoveryCaseId: data.recoveryCaseId,
        isRecovered: data.isRecovered,
        recoveredAmountPaise: BigInt(data.recoveredAmountPaise),
        feeAmountPaise: BigInt(data.feeAmountPaise || 0),
        observedVia: data.observedVia,
      },
    });
    return {
      ...out,
      recoveredAmountPaise: Number(out.recoveredAmountPaise),
      feeAmountPaise: Number(out.feeAmountPaise),
    };
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
    const evt = await this.prisma.outboxEvent.create({
      data: {
        merchantId: data.merchantId,
        aggregateType: data.aggregateType,
        aggregateId: data.aggregateId,
        eventType: data.eventType,
        payload: data.payload as any,
        idempotencyKey: data.idempotencyKey,
        status: 'PENDING',
      },
    });
    return {
      ...evt,
      status: evt.status as any,
      payload: evt.payload as Record<string, unknown>,
    };
  }

  async getPendingOutboxEvents(batchSize = 20): Promise<OutboxEventRecord[]> {
    const events = await this.prisma.outboxEvent.findMany({
      where: {
        status: 'PENDING',
        availableAt: { lte: new Date() },
      },
      take: batchSize,
      orderBy: { createdAt: 'asc' },
    });
    return events.map((e) => ({
      ...e,
      status: e.status as any,
      payload: e.payload as Record<string, unknown>,
    }));
  }

  async claimOutboxEvents(workerId: string, batchSize = 20, lockTtlMs = 30000): Promise<OutboxEventRecord[]> {
    const now = new Date();
    const expiredCutoff = new Date(Date.now() - lockTtlMs);

    // Atomic claim via PostgreSQL query or transaction
    return this.prisma.$transaction(async (tx) => {
      const candidates = await tx.outboxEvent.findMany({
        where: {
          OR: [
            { status: 'PENDING', availableAt: { lte: now } },
            { status: 'PROCESSING', lockedAt: { lte: expiredCutoff } },
          ],
        },
        take: batchSize,
        orderBy: { createdAt: 'asc' },
      });

      if (candidates.length === 0) return [];

      const ids = candidates.map((c) => c.id);
      await tx.outboxEvent.updateMany({
        where: { id: { in: ids } },
        data: {
          status: 'PROCESSING',
          lockedAt: now,
          lockedBy: workerId,
          attemptCount: { increment: 1 },
          updatedAt: now,
        },
      });

      const updated = await tx.outboxEvent.findMany({
        where: { id: { in: ids } },
      });

      return updated.map((e) => ({
        ...e,
        status: e.status as any,
        payload: e.payload as Record<string, unknown>,
      }));
    });
  }

  async markOutboxEventProcessing(id: string, workerId?: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: 'PROCESSING',
        lockedAt: new Date(),
        ...(workerId ? { lockedBy: workerId } : {}),
      },
    });
  }

  async markOutboxEventPublished(id: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        lockedBy: null,
        lockedAt: null,
      },
    });
  }

  async markOutboxEventFailed(id: string, error: string, retryDelayMs = 5000): Promise<void> {
    const existing = await this.prisma.outboxEvent.findUnique({ where: { id } });
    if (!existing) return;

    const shouldDeadLetter = existing.attemptCount >= existing.maxAttempts;
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        lastError: error,
        lockedBy: null,
        lockedAt: null,
        status: shouldDeadLetter ? 'DEAD_LETTER' : 'PENDING',
        availableAt: shouldDeadLetter ? existing.availableAt : new Date(Date.now() + retryDelayMs),
      },
    });
  }

  // ── Idempotency Store ────────────────────────────────────────────────────

  async acquireIdempotencyKey(params: {
    key: string;
    merchantId: string;
    endpoint: string;
    requestHash?: string;
    ttlMs?: number;
  }): Promise<{ acquired: boolean; existingResponse?: { code: number; body: unknown }; isConflict?: boolean }> {
    const now = new Date();
    const ttl = params.ttlMs || 24 * 60 * 60 * 1000;
    const expiresAt = new Date(now.getTime() + ttl);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.idempotencyKey.findUnique({
        where: { key: params.key },
      });

      if (existing) {
        if (existing.expiresAt.getTime() <= now.getTime()) {
          // Expired, overwrite
          await tx.idempotencyKey.update({
            where: { key: params.key },
            data: {
              merchantId: params.merchantId,
              endpoint: params.endpoint,
              requestHash: params.requestHash,
              status: 'IN_PROGRESS',
              lockedUntil: new Date(now.getTime() + 30000),
              expiresAt,
            },
          });
          return { acquired: true };
        }

        if (params.requestHash && existing.requestHash && params.requestHash !== existing.requestHash) {
          return { acquired: false, isConflict: true };
        }

        if (existing.status === 'COMMITTED' && existing.responseCode !== null) {
          return {
            acquired: false,
            existingResponse: {
              code: existing.responseCode,
              body: existing.responseBody,
            },
          };
        }

        if (existing.status === 'IN_PROGRESS' && existing.lockedUntil && existing.lockedUntil.getTime() > now.getTime()) {
          return { acquired: false };
        }

        // Re-acquire lock
        await tx.idempotencyKey.update({
          where: { key: params.key },
          data: {
            status: 'IN_PROGRESS',
            lockedUntil: new Date(now.getTime() + 30000),
            version: { increment: 1 },
          },
        });
        return { acquired: true };
      }

      // Create new lock
      await tx.idempotencyKey.create({
        data: {
          key: params.key,
          merchantId: params.merchantId,
          endpoint: params.endpoint,
          requestHash: params.requestHash,
          status: 'IN_PROGRESS',
          lockedUntil: new Date(now.getTime() + 30000),
          expiresAt,
        },
      });
      return { acquired: true };
    });
  }

  async commitIdempotencyKey(key: string, merchantId: string, responseCode: number, responseBody: unknown): Promise<void> {
    await this.prisma.idempotencyKey.updateMany({
      where: { key, merchantId },
      data: {
        status: 'COMMITTED',
        responseCode,
        responseBody: responseBody as any,
        lockedUntil: null,
      },
    });
  }

  async releaseIdempotencyKey(key: string, merchantId: string): Promise<void> {
    await this.prisma.idempotencyKey.deleteMany({
      where: { key, merchantId, status: 'IN_PROGRESS' },
    });
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
    const evt = await this.prisma.webhookEvent.create({
      data: {
        merchantId: data.merchantId,
        provider: data.provider,
        source: data.source || data.provider,
        eventType: data.eventType,
        providerEventId: data.providerEventId,
        externalId: data.externalId,
        idempotencyKey: data.idempotencyKey,
        payloadHash: data.payloadHash,
        rawPayload: data.rawPayload as any,
        signatureValid: data.signatureValid ?? false,
        status: 'PENDING',
      },
    });
    return {
      ...evt,
      status: evt.status as any,
      rawPayload: evt.rawPayload as Record<string, unknown>,
    };
  }

  async getWebhookEvent(provider: string, providerEventId: string): Promise<WebhookEventRecord | null> {
    const evt = await this.prisma.webhookEvent.findFirst({
      where: {
        provider,
        OR: [{ providerEventId }, { idempotencyKey: providerEventId }],
      },
    });
    if (!evt) return null;
    return {
      ...evt,
      status: evt.status as any,
      rawPayload: evt.rawPayload as Record<string, unknown>,
    };
  }

  async markWebhookEventProcessed(id: string, status: 'PROCESSED' | 'FAILED', error?: string): Promise<void> {
    await this.prisma.webhookEvent.update({
      where: { id },
      data: {
        status,
        processedAt: new Date(),
        errorMessage: error,
      },
    });
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
    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.auditEvent.findFirst({
        where: data.merchantId ? { merchantId: data.merchantId } : undefined,
        orderBy: { createdAt: 'desc' },
      });

      const previousHash = latest ? latest.currentHash : '0'.repeat(64);
      const currentHash = crypto
        .createHash('sha256')
        .update(`${previousHash}:${data.actorType}:${data.action}:${data.entityId}:${data.payloadHash}`)
        .digest('hex');

      const created = await tx.auditEvent.create({
        data: {
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
          metadata: data.metadata as any,
        },
      });

      return {
        ...created,
        metadata: created.metadata as Record<string, unknown> | null,
      };
    });
  }

  async getLatestAuditEvent(merchantId?: string): Promise<AuditEventRecord | null> {
    const evt = await this.prisma.auditEvent.findFirst({
      where: merchantId ? { merchantId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    if (!evt) return null;
    return { ...evt, metadata: evt.metadata as Record<string, unknown> | null };
  }

  async listAuditEvents(params: { merchantId?: string; entityType?: string; entityId?: string; limit?: number }): Promise<AuditEventRecord[]> {
    const list = await this.prisma.auditEvent.findMany({
      where: {
        ...(params.merchantId ? { merchantId: params.merchantId } : {}),
        ...(params.entityType ? { entityType: params.entityType } : {}),
        ...(params.entityId ? { entityId: params.entityId } : {}),
      },
      take: params.limit || 100,
      orderBy: { createdAt: 'asc' },
    });
    return list.map((evt) => ({ ...evt, metadata: evt.metadata as Record<string, unknown> | null }));
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

  // ── Messages, Suppressions & Orders ──────────────────────────────────────

  async logMessage(log: MessageLog): Promise<MessageLog> {
    const created = await this.prisma.messageLog.create({
      data: {
        id: log.id,
        cartEventId: log.cartEventId,
        merchantId: log.merchantId,
        channel: log.channel as any,
        direction: log.direction as any,
        content: log.content,
        tokensUsed: log.tokensUsed,
        latencyMs: log.latencyMs,
        deliveryStatus: log.deliveryStatus as any,
        externalMessageId: log.externalMessageId,
      },
    });
    return created as unknown as MessageLog;
  }

  async listMessageLogs(merchantId?: string): Promise<MessageLog[]> {
    const list = await this.prisma.messageLog.findMany({
      where: merchantId ? { merchantId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return list as unknown as MessageLog[];
  }

  async addSuppression(entry: SuppressionEntry): Promise<SuppressionEntry> {
    await this.prisma.suppressionList.upsert({
      where: {
        merchantId_identifier: {
          merchantId: 'merchant_default_01',
          identifier: entry.identifier.toLowerCase().trim(),
        },
      },
      create: {
        merchantId: 'merchant_default_01',
        identifier: entry.identifier.toLowerCase().trim(),
        type: entry.type as any,
        reason: entry.reason || 'USER_UNSUBSCRIBE',
      },
      update: {
        type: entry.type as any,
        reason: entry.reason || 'USER_UNSUBSCRIBE',
      },
    });
    return entry;
  }

  async isSuppressed(identifier: string, type: 'PHONE' | 'EMAIL'): Promise<boolean> {
    const found = await this.prisma.suppressionList.findFirst({
      where: {
        identifier: identifier.toLowerCase().trim(),
        type: type as any,
      },
    });
    return !!found;
  }

  async getSuppressionList(): Promise<SuppressionEntry[]> {
    const list = await this.prisma.suppressionList.findMany();
    return list.map((s) => ({
      id: s.id,
      merchantId: s.merchantId,
      identifier: s.identifier,
      type: s.type as any,
      reason: s.reason as any,
      optedOutAt: s.optedOutAt,
    }));
  }

  async removeSuppression(identifier: string): Promise<boolean> {
    const res = await this.prisma.suppressionList.deleteMany({
      where: { identifier: identifier.toLowerCase().trim() },
    });
    return res.count > 0;
  }

  async upsertOrder(order: OrderRecord): Promise<OrderRecord> {
    const upserted = await this.prisma.order.upsert({
      where: { shopifyOrderId: order.shopifyOrderId },
      create: {
        id: order.id,
        merchantId: order.merchantId,
        shopifyOrderId: order.shopifyOrderId,
        orderNumber: order.orderNumber,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        customerName: order.customerName,
        currency: order.currency,
        totalPrice: order.totalPrice,
        items: order.items as any,
        financialStatus: order.financialStatus as any,
        fulfillmentStatus: order.fulfillmentStatus as any,
      },
      update: {
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        customerName: order.customerName,
        currency: order.currency,
        totalPrice: order.totalPrice,
        items: order.items as any,
        financialStatus: order.financialStatus as any,
        fulfillmentStatus: order.fulfillmentStatus as any,
      },
    });
    return upserted as unknown as OrderRecord;
  }

  async getOrder(id: string, merchantId?: string): Promise<OrderRecord | null> {
    const o = await this.prisma.order.findFirst({
      where: { id, ...(merchantId ? { merchantId } : {}) },
    });
    return o as unknown as OrderRecord | null;
  }

  async listOrders(merchantId?: string): Promise<OrderRecord[]> {
    const list = await this.prisma.order.findMany({
      where: merchantId ? { merchantId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return list as unknown as OrderRecord[];
  }

  async upsertFulfillment(fulfillment: FulfillmentRecord): Promise<FulfillmentRecord> {
    const upserted = await this.prisma.fulfillment.upsert({
      where: { shopifyFulfillmentId: fulfillment.shopifyFulfillmentId },
      create: {
        id: fulfillment.id,
        orderId: fulfillment.orderId,
        merchantId: fulfillment.merchantId,
        shopifyFulfillmentId: fulfillment.shopifyFulfillmentId,
        trackingCompany: fulfillment.trackingCompany,
        trackingNumber: fulfillment.trackingNumber,
        trackingUrl: fulfillment.trackingUrl,
        status: fulfillment.status as any,
        estimatedDeliveryAt: fulfillment.estimatedDeliveryAt ? new Date(fulfillment.estimatedDeliveryAt) : null,
      },
      update: {
        trackingCompany: fulfillment.trackingCompany,
        trackingNumber: fulfillment.trackingNumber,
        trackingUrl: fulfillment.trackingUrl,
        status: fulfillment.status as any,
        estimatedDeliveryAt: fulfillment.estimatedDeliveryAt ? new Date(fulfillment.estimatedDeliveryAt) : null,
      },
    });
    return upserted as unknown as FulfillmentRecord;
  }

  async listFulfillments(merchantId?: string): Promise<FulfillmentRecord[]> {
    const list = await this.prisma.fulfillment.findMany({
      where: merchantId ? { merchantId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return list as unknown as FulfillmentRecord[];
  }

  async upsertReturn(returnRecord: ReturnRecord): Promise<ReturnRecord> {
    const upserted = await this.prisma.return.upsert({
      where: { id: returnRecord.id },
      create: {
        id: returnRecord.id,
        orderId: returnRecord.orderId,
        merchantId: returnRecord.merchantId,
        shopifyReturnId: returnRecord.shopifyReturnId,
        reason: returnRecord.reason as any,
        status: returnRecord.status as any,
        refundAmount: returnRecord.refundAmount,
        currency: returnRecord.currency,
        notes: returnRecord.notes,
        returnTrackingNumber: returnRecord.returnTrackingNumber,
      },
      update: {
        reason: returnRecord.reason as any,
        status: returnRecord.status as any,
        refundAmount: returnRecord.refundAmount,
        currency: returnRecord.currency,
        notes: returnRecord.notes,
        returnTrackingNumber: returnRecord.returnTrackingNumber,
      },
    });
    return upserted as unknown as ReturnRecord;
  }

  async listReturns(merchantId?: string): Promise<ReturnRecord[]> {
    const list = await this.prisma.return.findMany({
      where: merchantId ? { merchantId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return list as unknown as ReturnRecord[];
  }

  async logSecurityIncident(incident: SecurityIncident): Promise<SecurityIncident> {
    const created = await this.prisma.securityIncident.create({
      data: {
        id: incident.id,
        cartToken: incident.cartToken,
        merchantId: incident.merchantId,
        attackType: incident.attackType,
        flaggedPatterns: incident.flaggedPatterns,
        rawInput: incident.rawInput,
        normalizedInput: incident.normalizedInput,
        riskScore: incident.riskScore,
      },
    });
    return created as unknown as SecurityIncident;
  }

  async listSecurityIncidents(merchantId?: string): Promise<SecurityIncident[]> {
    const list = await this.prisma.securityIncident.findMany({
      where: merchantId ? { merchantId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return list as unknown as SecurityIncident[];
  }

  async pruneRecordsOlderThan(retentionDays = 30): Promise<{ prunedCarts: number; prunedLogs: number }> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const [cartsRes, logsRes] = await this.prisma.$transaction([
      this.prisma.cartEvent.deleteMany({ where: { createdAt: { lt: cutoff } } }),
      this.prisma.messageLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    ]);
    return { prunedCarts: cartsRes.count, prunedLogs: logsRes.count };
  }

  // ── Compatibility & Omni-Lifecycle Helpers ─────────────────────────────────

  private takeoverLocks = new Map<string, number>();


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
    const cart = await this.upsertCartEvent({
      id: `cart_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...cartData,
    });

    const merchant = await this.getMerchant(cart.merchantId);
    const shopDomain = merchant?.shopDomain || merchant?.storeUrl || 'store.myshopify.com';
    const idempotencyKey = customOutbox?.idempotencyKey || this.generateOutboxIdempotencyKey(shopDomain, cart.cartToken, new Date());

    const outbox = await this.createOutboxEvent({
      merchantId: cart.merchantId,
      aggregateType: 'CartEvent',
      aggregateId: cart.id,
      eventType: customOutbox?.eventType || 'CART_ABANDONED',
      payload: (customOutbox?.payload as Record<string, unknown>) || {
        cartToken: cart.cartToken,
        merchantId: cart.merchantId,
        totalPrice: cart.totalPrice,
        currency: cart.currency,
        abandonmentType: cart.abandonmentType,
      },
      idempotencyKey,
    });

    return { cart, outbox };
  }

  async createOrUpdateOrder(order: OrderRecord): Promise<OrderRecord> {
    return this.upsertOrder(order);
  }

  async getOrderByShopifyId(shopifyOrderId: string): Promise<OrderRecord | null> {
    const orders = await this.listOrders();
    return orders.find((o) => o.shopifyOrderId === shopifyOrderId) || null;
  }

  async getOrderByOrderNumber(merchantId: string, orderNumber: string): Promise<OrderRecord | null> {
    const orders = await this.listOrders(merchantId);
    const normalized = orderNumber.replace(/^#/, '').trim().toLowerCase();
    return (
      orders.find(
        (o) =>
          o.merchantId === merchantId &&
          (o.orderNumber.replace(/^#/, '').trim().toLowerCase() === normalized || o.shopifyOrderId === orderNumber)
      ) || null
    );
  }

  async findOrdersByCustomer(merchantId: string, identifier: string): Promise<OrderRecord[]> {
    const orders = await this.listOrders(merchantId);
    const cleanId = identifier.trim().toLowerCase();
    return orders.filter(
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
    const fulfillments = await this.listFulfillments();
    return fulfillments.find((f) => f.id === id) || null;
  }

  async getFulfillmentByShopifyId(shopifyFulfillmentId: string): Promise<FulfillmentRecord | null> {
    const fulfillments = await this.listFulfillments();
    return fulfillments.find((f) => f.shopifyFulfillmentId === shopifyFulfillmentId) || null;
  }

  async getFulfillmentsByOrderId(orderId: string): Promise<FulfillmentRecord[]> {
    const fulfillments = await this.listFulfillments();
    return fulfillments.filter((f) => f.orderId === orderId);
  }

  async findFulfillmentByTracking(merchantId: string, trackingNumber: string): Promise<FulfillmentRecord | null> {
    const fulfillments = await this.listFulfillments(merchantId);
    const cleanTracking = trackingNumber.trim().toLowerCase();
    return (
      fulfillments.find(
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
    const returns = await this.listReturns();
    return returns.find((r) => r.id === id) || null;
  }

  async getReturnsByOrderId(orderId: string): Promise<ReturnRecord[]> {
    const returns = await this.listReturns();
    return returns.filter((r) => r.orderId === orderId);
  }

}
