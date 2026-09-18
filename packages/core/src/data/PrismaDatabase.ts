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
  WebhookEventRecord,
  AuditEventRecord,
  CreateRecoveryCaseAndEnqueueParams,
  IngestRazorpayWebhookParams,
  SearchRecoveryCasesParams,
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
        organizationId: merchant.organizationId,
        storeName: merchant.storeName,
        storeUrl: merchant.storeUrl,
        shopDomain: merchant.shopDomain,
        webhookSecret: merchant.webhookSecret || 'whsec_default',
        brandVoiceCasualVsFormal: merchant.brandVoiceCasualVsFormal ?? 0.3,
        brandVoiceUrgencyVsGentle: merchant.brandVoiceUrgencyVsGentle ?? 0.4,
        discountCeilingPercentage: merchant.discountCeilingPercentage ?? 15.0,
        minMarginPercentage: merchant.minMarginPercentage ?? 20.0,
        brandToneGuidelines: merchant.brandToneGuidelines || 'Helpful, conversational, and direct.',
        whatsappTemplateName: merchant.whatsappTemplateName || 'recoverflow_cart_recovery',
        fromEmail: merchant.fromEmail || 'recovery@recoverflow.ai',
        supportPhone: merchant.supportPhone,
      },
      update: {
        storeName: merchant.storeName,
        storeUrl: merchant.storeUrl,
        shopDomain: merchant.shopDomain,
        brandVoiceCasualVsFormal: merchant.brandVoiceCasualVsFormal ?? 0.3,
        brandVoiceUrgencyVsGentle: merchant.brandVoiceUrgencyVsGentle ?? 0.4,
        discountCeilingPercentage: merchant.discountCeilingPercentage ?? 15.0,
        minMarginPercentage: merchant.minMarginPercentage ?? 20.0,
        brandToneGuidelines: merchant.brandToneGuidelines || 'Helpful, conversational, and direct.',
        whatsappTemplateName: merchant.whatsappTemplateName || 'recoverflow_cart_recovery',
        fromEmail: merchant.fromEmail || 'recovery@recoverflow.ai',
        supportPhone: merchant.supportPhone,
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
    const totalAmountMinor = cart.totalAmountMinor !== undefined ? BigInt(cart.totalAmountMinor) : BigInt(Math.round((cart.totalPrice || 0) * 100));
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
        totalAmountMinor,
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
        totalAmountMinor,
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

  async updateRecoveryCase(
    paramsOrId: any,
    legacyUpdates?: Partial<RecoveryCaseRecord>,
    legacyMerchantId?: string
  ): Promise<RecoveryCaseRecord | null> {
    const id = typeof paramsOrId === 'string' ? paramsOrId : paramsOrId.id;
    const updates = typeof paramsOrId === 'string' ? (legacyUpdates || {}) : paramsOrId.updates;
    const merchantId = typeof paramsOrId === 'string' ? legacyMerchantId : paramsOrId.merchantId;

    if (!merchantId) {
      throw new Error('TENANT_SCOPED_SECURITY_ERROR: merchantId is required for updateRecoveryCase');
    }

    const existing = await this.prisma.recoveryCase.findFirst({
      where: { id, merchantId },
    });
    if (!existing) return null;

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

  async adminGetRecoveryCaseById(id: string): Promise<RecoveryCaseRecord | null> {
    const rc = await this.prisma.recoveryCase.findUnique({ where: { id } });
    if (!rc) return null;
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

  async searchRecoveryCases(params: SearchRecoveryCasesParams): Promise<{ items: RecoveryCaseRecord[]; total: number }> {
    const where: Record<string, any> = {
      merchantId: params.merchantId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.minExpectedValuePaise ? { expectedValuePaise: { gte: BigInt(params.minExpectedValuePaise) } } : {}),
    };

    if (params.search) {
      where.OR = [
        { customerId: { contains: params.search, mode: 'insensitive' } },
        { paymentId: { contains: params.search, mode: 'insensitive' } },
        { id: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [total, list] = await Promise.all([
      this.prisma.recoveryCase.count({ where }),
      this.prisma.recoveryCase.findMany({
        where,
        skip: params.offset || 0,
        take: params.limit || 50,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      items: list.map((rc) => ({ ...rc, expectedValuePaise: Number(rc.expectedValuePaise) })),
      total,
    };
  }

  // ── Unit of Work Atomic Transactions ─────────────────────────────────────

  async createRecoveryCaseAndEnqueue(params: CreateRecoveryCaseAndEnqueueParams): Promise<{
    payment: PaymentRecord;
    recoveryCase: RecoveryCaseRecord;
    outbox: OutboxEventRecord;
  }> {
    return this.prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          merchantId: params.payment.merchantId,
          externalPaymentId: params.payment.externalPaymentId,
          amountPaise: BigInt(params.payment.amountPaise),
          currency: params.payment.currency,
          status: (params.payment.status as any) || 'FAILED',
          gateway: params.payment.gateway || 'RAZORPAY',
          customerId: params.payment.customerId,
          orderReference: params.payment.orderReference,
        },
      });

      const rc = await tx.recoveryCase.create({
        data: {
          merchantId: params.payment.merchantId,
          paymentId: p.id,
          customerId: params.recoveryCase.customerId || params.payment.customerId,
          recoveryProbBps: params.recoveryCase.recoveryProbBps || 0,
          expectedValuePaise: BigInt(params.recoveryCase.expectedValuePaise || 0),
        },
      });

      const out = await tx.outboxEvent.create({
        data: {
          merchantId: params.payment.merchantId,
          aggregateType: 'RECOVERY_CASE',
          aggregateId: rc.id,
          eventType: params.outbox.eventType,
          payload: { ...params.outbox.payload, recoveryCaseId: rc.id, paymentId: p.id } as any,
          idempotencyKey: params.outbox.idempotencyKey,
          status: 'PENDING',
        },
      });

      return {
        payment: { ...p, amountPaise: Number(p.amountPaise) },
        recoveryCase: { ...rc, expectedValuePaise: Number(rc.expectedValuePaise) },
        outbox: { ...out, status: out.status as any, payload: out.payload as Record<string, unknown> },
      };
    });
  }

  async ingestRazorpayWebhookTransaction(params: IngestRazorpayWebhookParams): Promise<{
    webhook: WebhookEventRecord;
    payment?: PaymentRecord;
    recoveryCase?: RecoveryCaseRecord;
    outbox?: OutboxEventRecord;
  }> {
    return this.prisma.$transaction(async (tx) => {
      // Replay & Conflict Safety Check
      if (params.webhookEvent.providerEventId && params.webhookEvent.merchantId) {
        const existing = await tx.webhookEvent.findFirst({
          where: {
            merchantId: params.webhookEvent.merchantId,
            provider: params.webhookEvent.provider,
            providerEventId: params.webhookEvent.providerEventId,
          },
        });

        if (existing) {
          if (existing.payloadHash && params.webhookEvent.payloadHash && existing.payloadHash === params.webhookEvent.payloadHash) {
            return {
              webhook: {
                ...existing,
                status: 'DUPLICATE' as any,
                rawPayload: existing.rawPayload as Record<string, unknown>,
              },
            };
          } else {
            await tx.securityIncident.create({
              data: {
                merchantId: params.webhookEvent.merchantId,
                attackType: 'WEBHOOK_PAYLOAD_TAMPERING',
                flaggedPatterns: ['PROVIDER_EVENT_ID_PAYLOAD_HASH_MISMATCH'],
                rawInput: JSON.stringify(params.webhookEvent.rawPayload),
                normalizedInput: `providerEventId: ${params.webhookEvent.providerEventId}`,
                riskScore: 1.0,
              },
            });
            const conflictError = new Error('INTEGRITY_CONFLICT: Webhook payload hash mismatch for provider event ID');
            (conflictError as any).statusCode = 409;
            throw conflictError;
          }
        }
      }

      const webhook = await tx.webhookEvent.create({
        data: {
          merchantId: params.webhookEvent.merchantId,
          provider: params.webhookEvent.provider,
          source: params.webhookEvent.source || params.webhookEvent.provider,
          eventType: params.webhookEvent.eventType,
          providerEventId: params.webhookEvent.providerEventId,
          externalId: params.webhookEvent.externalId,
          idempotencyKey: params.webhookEvent.idempotencyKey,
          payloadHash: params.webhookEvent.payloadHash,
          rawPayload: params.webhookEvent.rawPayload as any,
          signatureValid: params.webhookEvent.signatureValid,
          status: 'PROCESSED',
          processedAt: new Date(),
        },
      });

      let payment: PaymentRecord | undefined;
      let recoveryCase: RecoveryCaseRecord | undefined;
      let outbox: OutboxEventRecord | undefined;

      if (params.payment) {
        const p = await tx.payment.create({
          data: {
            merchantId: params.payment.merchantId,
            externalPaymentId: params.payment.externalPaymentId,
            amountPaise: BigInt(params.payment.amountPaise),
            currency: params.payment.currency,
            status: (params.payment.status as any) || 'FAILED',
            gateway: params.payment.gateway || 'RAZORPAY',
            customerId: params.payment.customerId,
            orderReference: params.payment.orderReference,
          },
        });
        payment = { ...p, amountPaise: Number(p.amountPaise) };

        if (params.recoveryCase) {
          const rc = await tx.recoveryCase.create({
            data: {
              merchantId: params.payment.merchantId,
              paymentId: p.id,
              customerId: params.recoveryCase.customerId || params.payment.customerId,
              recoveryProbBps: params.recoveryCase.recoveryProbBps || 0,
              expectedValuePaise: BigInt(params.recoveryCase.expectedValuePaise || 0),
            },
          });
          recoveryCase = { ...rc, expectedValuePaise: Number(rc.expectedValuePaise) };

          if (params.outbox) {
            const out = await tx.outboxEvent.create({
              data: {
                merchantId: params.payment.merchantId,
                aggregateType: 'RECOVERY_CASE',
                aggregateId: rc.id,
                eventType: params.outbox.eventType,
                payload: { ...params.outbox.payload, recoveryCaseId: rc.id, paymentId: p.id } as any,
                idempotencyKey: params.outbox.idempotencyKey,
                status: 'PENDING',
              },
            });
            outbox = { ...out, status: out.status as any, payload: out.payload as Record<string, unknown> };
          }
        }
      }

      return {
        webhook: { ...webhook, status: webhook.status as any, rawPayload: webhook.rawPayload as Record<string, unknown> },
        payment,
        recoveryCase,
        outbox,
      };
    });
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

  // ── Transactional Outbox (PostgreSQL FOR UPDATE SKIP LOCKED) ──────────────

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

  async getPendingOutboxEvents(batchSize = 20, merchantId?: string): Promise<OutboxEventRecord[]> {
    const events = await this.prisma.outboxEvent.findMany({
      where: {
        status: 'PENDING',
        availableAt: { lte: new Date() },
        ...(merchantId ? { merchantId } : {}),
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

    try {
      const updatedEvents: any[] = await this.prisma.$queryRaw`
        WITH candidates AS (
          SELECT id FROM "OutboxEvent"
          WHERE (status = 'PENDING' AND "availableAt" <= ${now})
             OR (status = 'PROCESSING' AND "lockedAt" <= ${expiredCutoff})
          ORDER BY "createdAt" ASC
          LIMIT ${batchSize}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE "OutboxEvent"
        SET status = 'PROCESSING',
            "lockedBy" = ${workerId},
            "lockedAt" = ${now},
            "attemptCount" = "attemptCount" + 1,
            "updatedAt" = ${now}
        WHERE id IN (SELECT id FROM candidates)
        RETURNING *;
      `;

      return updatedEvents.map((e) => ({
        id: e.id,
        merchantId: e.merchantId,
        aggregateType: e.aggregateType,
        aggregateId: e.aggregateId,
        eventType: e.eventType,
        payload: typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload,
        idempotencyKey: e.idempotencyKey,
        status: e.status,
        attemptCount: e.attemptCount,
        maxAttempts: e.maxAttempts,
        availableAt: e.availableAt,
        lockedAt: e.lockedAt,
        lockedBy: e.lockedBy,
        publishedAt: e.publishedAt,
        lastError: e.lastError,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      }));
    } catch {
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

        const updated = await tx.outboxEvent.findMany({ where: { id: { in: ids } } });
        return updated.map((e) => ({
          ...e,
          status: e.status as any,
          payload: e.payload as Record<string, unknown>,
        }));
      });
    }
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

  async markOutboxEventPublished(id: string, workerId?: string): Promise<boolean> {
    const res = await this.prisma.outboxEvent.updateMany({
      where: {
        id,
        status: 'PROCESSING',
        ...(workerId ? { lockedBy: workerId } : {}),
      },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        lockedBy: null,
        lockedAt: null,
      },
    });
    return res.count > 0;
  }

  async markOutboxEventFailed(id: string, error: string, retryDelayMs = 5000, workerId?: string): Promise<boolean> {
    const existing = await this.prisma.outboxEvent.findUnique({ where: { id } });
    if (!existing) return false;

    if (workerId && existing.lockedBy && existing.lockedBy !== workerId) {
      return false;
    }

    const shouldFail = (existing.attemptCount >= existing.maxAttempts) || ((existing.retryCount || 0) >= existing.maxAttempts);
    const res = await this.prisma.outboxEvent.updateMany({
      where: {
        id,
        ...(workerId ? { lockedBy: workerId } : {}),
      },
      data: {
        lastError: error,
        lockedBy: null,
        lockedAt: null,
        status: shouldFail ? 'FAILED' : 'PENDING',
        availableAt: shouldFail ? existing.availableAt : new Date(Date.now() + retryDelayMs),
      },
    });
    return res.count > 0;
  }

  async extendOutboxLease(id: string, workerId: string, _extendMs = 30000): Promise<boolean> {
    const res = await this.prisma.outboxEvent.updateMany({
      where: {
        id,
        lockedBy: workerId,
        status: 'PROCESSING',
      },
      data: {
        lockedAt: new Date(),
        updatedAt: new Date(),
      },
    });
    return res.count > 0;
  }

  // ── Idempotency Store (Multi-tenant scoped) ──────────────────────────────

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
      const existing = await tx.idempotencyKey.findFirst({
        where: {
          key: params.key,
          merchantId: params.merchantId,
          endpoint: params.endpoint,
        },
      });

      if (existing) {
        if (existing.expiresAt.getTime() <= now.getTime()) {
          await tx.idempotencyKey.updateMany({
            where: { merchantId: params.merchantId, endpoint: params.endpoint, key: params.key },
            data: {
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

        await tx.idempotencyKey.updateMany({
          where: { merchantId: params.merchantId, endpoint: params.endpoint, key: params.key },
          data: {
            status: 'IN_PROGRESS',
            lockedUntil: new Date(now.getTime() + 30000),
            version: { increment: 1 },
          },
        });
        return { acquired: true };
      }

      try {
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
      } catch (err: any) {
        if (err.code === 'P2002') {
          return { acquired: false };
        }
        throw err;
      }
    });
  }

  async commitIdempotencyKey(key: string, merchantId: string, responseCode: number, responseBody: unknown, endpoint?: string): Promise<void> {
    await this.prisma.idempotencyKey.updateMany({
      where: {
        key,
        merchantId,
        ...(endpoint ? { endpoint } : {}),
      },
      data: {
        status: 'COMMITTED',
        responseCode,
        responseBody: responseBody as any,
        lockedUntil: null,
      },
    });
  }

  async releaseIdempotencyKey(key: string, merchantId: string, endpoint?: string): Promise<void> {
    await this.prisma.idempotencyKey.deleteMany({
      where: {
        key,
        merchantId,
        ...(endpoint ? { endpoint } : {}),
        status: 'IN_PROGRESS',
      },
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

  // ── Audit Ledger (Merkle Hash Chain with Postgres Locking) ───────────────

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
      if (data.merchantId) {
        try {
          await tx.$executeRawUnsafe(
            `SELECT pg_advisory_xact_lock(hashtext('audit_' || $1))`,
            data.merchantId
          );
        } catch {
          // Advisory lock ignore on non-postgres
        }
      }

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

  // ── Messages, Suppressions & E-Commerce ──────────────────────────────────

  async logMessage(log: MessageLog): Promise<MessageLog> {
    const created = await this.prisma.messageLog.create({
      data: {
        id: log.id,
        cartEventId: log.cartEventId || log.cartId,
        merchantId: log.merchantId,
        channel: log.channel as any,
        direction: log.direction as any,
        content: log.content,
        deliveryStatus: (log.deliveryStatus || log.status || 'SENT') as any,
        createdAt: log.createdAt ? new Date(log.createdAt) : (log.sentAt ? new Date(log.sentAt) : new Date()),
      },
    });
    return {
      ...log,
      id: created.id,
      createdAt: created.createdAt,
      deliveryStatus: created.deliveryStatus as any,
    };
  }

  async listMessageLogs(merchantId?: string): Promise<MessageLog[]> {
    const list = await this.prisma.messageLog.findMany({
      where: merchantId ? { merchantId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return list.map((l) => ({
      id: l.id,
      cartEventId: l.cartEventId || undefined,
      cartId: l.cartEventId || undefined,
      merchantId: l.merchantId,
      channel: l.channel as any,
      direction: l.direction as any,
      content: l.content,
      deliveryStatus: l.deliveryStatus as any,
      status: l.deliveryStatus as any,
      createdAt: l.createdAt,
      sentAt: l.createdAt,
    }));
  }

  async addSuppression(entry: SuppressionEntry): Promise<SuppressionEntry> {
    const optDate = entry.optedOutAt ? new Date(entry.optedOutAt) : (entry.suppressedAt ? new Date(entry.suppressedAt) : new Date());
    await this.prisma.suppressionList.upsert({
      where: {
        merchantId_identifier: {
          merchantId: entry.merchantId || 'default',
          identifier: entry.identifier,
        },
      },
      create: {
        id: entry.id,
        merchantId: entry.merchantId || 'default',
        identifier: entry.identifier,
        type: entry.type as any,
        reason: entry.reason as any,
        optedOutAt: optDate,
      },
      update: {
        reason: entry.reason as any,
        optedOutAt: optDate,
      },
    });
    return entry;
  }

  async isSuppressed(identifier: string, type: 'PHONE' | 'EMAIL'): Promise<boolean> {
    const count = await this.prisma.suppressionList.count({
      where: { identifier, type: type as any },
    });
    return count > 0;
  }

  async getSuppressionList(): Promise<SuppressionEntry[]> {
    const list = await this.prisma.suppressionList.findMany({
      orderBy: { optedOutAt: 'desc' },
    });
    return list.map((s) => ({
      id: s.id,
      merchantId: s.merchantId,
      identifier: s.identifier,
      type: s.type as any,
      reason: s.reason as any,
      optedOutAt: s.optedOutAt,
      suppressedAt: s.optedOutAt.toISOString(),
    }));
  }

  async removeSuppression(identifier: string): Promise<boolean> {
    try {
      await this.prisma.suppressionList.deleteMany({
        where: { identifier },
      });
      return true;
    } catch {
      return false;
    }
  }

  async upsertOrder(order: OrderRecord): Promise<OrderRecord> {
    await this.prisma.order.upsert({
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
        financialStatus: order.financialStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        items: order.items as any,
      },
      update: {
        financialStatus: order.financialStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        items: order.items as any,
      },
    });
    return order;
  }

  async createOrUpdateOrder(order: OrderRecord): Promise<OrderRecord> {
    return this.upsertOrder(order);
  }

  async getOrder(id: string, merchantId?: string): Promise<OrderRecord | null> {
    const o = await this.prisma.order.findFirst({
      where: { id, ...(merchantId ? { merchantId } : {}) },
      include: { fulfillments: true, returns: true },
    });
    if (!o) return null;
    return {
      id: o.id,
      merchantId: o.merchantId,
      shopifyOrderId: o.shopifyOrderId,
      orderNumber: o.orderNumber,
      customerEmail: o.customerEmail || undefined,
      customerPhone: o.customerPhone || undefined,
      customerName: o.customerName || undefined,
      currency: o.currency,
      totalPrice: o.totalPrice,
      financialStatus: o.financialStatus,
      fulfillmentStatus: o.fulfillmentStatus,
      items: o.items as any,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    };
  }

  async getOrderByShopifyId(shopifyOrderId: string): Promise<OrderRecord | null> {
    const o = await this.prisma.order.findUnique({ where: { shopifyOrderId } });
    if (!o) return null;
    return {
      id: o.id,
      merchantId: o.merchantId,
      shopifyOrderId: o.shopifyOrderId,
      orderNumber: o.orderNumber,
      customerEmail: o.customerEmail || undefined,
      customerPhone: o.customerPhone || undefined,
      customerName: o.customerName || undefined,
      currency: o.currency,
      totalPrice: o.totalPrice,
      financialStatus: o.financialStatus,
      fulfillmentStatus: o.fulfillmentStatus,
      items: o.items as any,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    };
  }

  async getOrderByOrderNumber(merchantId: string, orderNumber: string): Promise<OrderRecord | null> {
    const o = await this.prisma.order.findFirst({
      where: { merchantId, orderNumber },
    });
    if (!o) return null;
    return {
      id: o.id,
      merchantId: o.merchantId,
      shopifyOrderId: o.shopifyOrderId,
      orderNumber: o.orderNumber,
      customerEmail: o.customerEmail || undefined,
      customerPhone: o.customerPhone || undefined,
      customerName: o.customerName || undefined,
      currency: o.currency,
      totalPrice: o.totalPrice,
      financialStatus: o.financialStatus,
      fulfillmentStatus: o.fulfillmentStatus,
      items: o.items as any,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    };
  }

  async findOrdersByCustomer(merchantId: string, identifier: string): Promise<OrderRecord[]> {
    const clean = identifier.trim();
    const list = await this.prisma.order.findMany({
      where: {
        merchantId,
        OR: [
          { customerEmail: { equals: clean, mode: 'insensitive' } },
          { customerPhone: { contains: clean } },
          { customerName: { contains: clean, mode: 'insensitive' } },
        ],
      },
    });
    return list.map((o) => ({
      id: o.id,
      merchantId: o.merchantId,
      shopifyOrderId: o.shopifyOrderId,
      orderNumber: o.orderNumber,
      customerEmail: o.customerEmail || undefined,
      customerPhone: o.customerPhone || undefined,
      customerName: o.customerName || undefined,
      currency: o.currency,
      totalPrice: o.totalPrice,
      financialStatus: o.financialStatus,
      fulfillmentStatus: o.fulfillmentStatus,
      items: o.items as any,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    }));
  }

  async listOrders(merchantId?: string): Promise<OrderRecord[]> {
    const list = await this.prisma.order.findMany({
      where: merchantId ? { merchantId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return list.map((o) => ({
      id: o.id,
      merchantId: o.merchantId,
      shopifyOrderId: o.shopifyOrderId,
      orderNumber: o.orderNumber,
      customerEmail: o.customerEmail || undefined,
      customerPhone: o.customerPhone || undefined,
      customerName: o.customerName || undefined,
      currency: o.currency,
      totalPrice: o.totalPrice,
      financialStatus: o.financialStatus,
      fulfillmentStatus: o.fulfillmentStatus,
      items: o.items as any,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    }));
  }

    async listFulfillments(merchantId?: string): Promise<FulfillmentRecord[]> {
    const list = await this.prisma.fulfillment.findMany({
      where: merchantId ? { merchantId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return list.map((f) => ({
      id: f.id,
      orderId: f.orderId,
      merchantId: f.merchantId,
      shopifyFulfillmentId: f.shopifyFulfillmentId,
      status: f.status as any,
      trackingCompany: f.trackingCompany || undefined,
      trackingNumber: f.trackingNumber || undefined,
      trackingUrl: f.trackingUrl || undefined,
      estimatedDeliveryAt: f.estimatedDeliveryAt,
      shippedAt: f.shippedAt,
      deliveredAt: f.deliveredAt,
      latestLocation: f.latestLocation,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }));
  }

  async upsertFulfillment(fulfillment: FulfillmentRecord): Promise<FulfillmentRecord> {
    await this.prisma.fulfillment.upsert({
      where: { shopifyFulfillmentId: fulfillment.shopifyFulfillmentId },
      create: {
        id: fulfillment.id,
        orderId: fulfillment.orderId,
        merchantId: fulfillment.merchantId,
        shopifyFulfillmentId: fulfillment.shopifyFulfillmentId,
        status: fulfillment.status,
        trackingCompany: fulfillment.trackingCompany,
        trackingNumber: fulfillment.trackingNumber,
        trackingUrl: fulfillment.trackingUrl,
        estimatedDeliveryAt: fulfillment.estimatedDeliveryAt ? new Date(fulfillment.estimatedDeliveryAt) : null,
        deliveredAt: fulfillment.deliveredAt ? new Date(fulfillment.deliveredAt) : null,
      },
      update: {
        status: fulfillment.status,
        trackingCompany: fulfillment.trackingCompany,
        trackingNumber: fulfillment.trackingNumber,
        trackingUrl: fulfillment.trackingUrl,
        estimatedDeliveryAt: fulfillment.estimatedDeliveryAt ? new Date(fulfillment.estimatedDeliveryAt) : null,
        deliveredAt: fulfillment.deliveredAt ? new Date(fulfillment.deliveredAt) : null,
      },
    });
    return fulfillment;
  }

  async createOrUpdateFulfillment(fulfillment: FulfillmentRecord): Promise<FulfillmentRecord> {
    return this.upsertFulfillment(fulfillment);
  }

  async getFulfillment(id: string): Promise<FulfillmentRecord | null> {
    const f = await this.prisma.fulfillment.findUnique({ where: { id } });
    if (!f) return null;
    return {
      id: f.id,
      orderId: f.orderId,
      merchantId: f.merchantId,
      shopifyFulfillmentId: f.shopifyFulfillmentId,
      status: f.status,
      trackingCompany: f.trackingCompany || undefined,
      trackingNumber: f.trackingNumber || undefined,
      trackingUrl: f.trackingUrl || undefined,
      estimatedDeliveryAt: f.estimatedDeliveryAt,
      shippedAt: f.shippedAt,
      deliveredAt: f.deliveredAt,
      latestLocation: f.latestLocation,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    };
  }

  async getFulfillmentByShopifyId(shopifyFulfillmentId: string): Promise<FulfillmentRecord | null> {
    const f = await this.prisma.fulfillment.findUnique({ where: { shopifyFulfillmentId } });
    if (!f) return null;
    return {
      id: f.id,
      orderId: f.orderId,
      merchantId: f.merchantId,
      shopifyFulfillmentId: f.shopifyFulfillmentId,
      status: f.status,
      trackingCompany: f.trackingCompany || undefined,
      trackingNumber: f.trackingNumber || undefined,
      trackingUrl: f.trackingUrl || undefined,
      estimatedDeliveryAt: f.estimatedDeliveryAt,
      shippedAt: f.shippedAt,
      deliveredAt: f.deliveredAt,
      latestLocation: f.latestLocation,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    };
  }

  async getFulfillmentsByOrderId(orderId: string): Promise<FulfillmentRecord[]> {
    const list = await this.prisma.fulfillment.findMany({ where: { orderId } });
    return list.map((f) => ({
      id: f.id,
      orderId: f.orderId,
      merchantId: f.merchantId,
      shopifyFulfillmentId: f.shopifyFulfillmentId,
      status: f.status,
      trackingCompany: f.trackingCompany || undefined,
      trackingNumber: f.trackingNumber || undefined,
      trackingUrl: f.trackingUrl || undefined,
      estimatedDeliveryAt: f.estimatedDeliveryAt,
      shippedAt: f.shippedAt,
      deliveredAt: f.deliveredAt,
      latestLocation: f.latestLocation,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }));
  }

  async findFulfillmentByTracking(merchantId: string, trackingNumber: string): Promise<FulfillmentRecord | null> {
    const f = await this.prisma.fulfillment.findFirst({
      where: {
        merchantId,
        trackingNumber,
      },
    });
    if (!f) return null;
    return {
      id: f.id,
      orderId: f.orderId,
      merchantId: f.merchantId,
      shopifyFulfillmentId: f.shopifyFulfillmentId,
      status: f.status,
      trackingCompany: f.trackingCompany || undefined,
      trackingNumber: f.trackingNumber || undefined,
      trackingUrl: f.trackingUrl || undefined,
      estimatedDeliveryAt: f.estimatedDeliveryAt,
      shippedAt: f.shippedAt,
      deliveredAt: f.deliveredAt,
      latestLocation: f.latestLocation,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    };
  }

  async upsertReturn(ret: ReturnRecord): Promise<ReturnRecord> {
    await this.prisma.return.upsert({
      where: { id: ret.id },
      create: {
        id: ret.id,
        orderId: ret.orderId,
        merchantId: ret.merchantId,
        shopifyReturnId: ret.shopifyReturnId,
        status: ret.status,
        reason: ret.reason,
        refundAmount: ret.refundAmount,
        currency: ret.currency || 'INR',
      },
      update: {
        status: ret.status,
        reason: ret.reason,
        refundAmount: ret.refundAmount,
      },
    });
    return ret;
  }

  async createOrUpdateReturn(ret: ReturnRecord): Promise<ReturnRecord> {
    return this.upsertReturn(ret);
  }

  async getReturn(id: string): Promise<ReturnRecord | null> {
    const r = await this.prisma.return.findUnique({ where: { id } });
    if (!r) return null;
    return {
      id: r.id,
      orderId: r.orderId,
      merchantId: r.merchantId,
      shopifyReturnId: r.shopifyReturnId || undefined,
      reason: r.reason,
      status: r.status,
      refundAmount: r.refundAmount || undefined,
      currency: r.currency,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async getReturnsByOrderId(orderId: string): Promise<ReturnRecord[]> {
    const list = await this.prisma.return.findMany({ where: { orderId } });
    return list.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      merchantId: r.merchantId,
      shopifyReturnId: r.shopifyReturnId || undefined,
      reason: r.reason,
      status: r.status,
      refundAmount: r.refundAmount || undefined,
      currency: r.currency,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async listReturns(merchantId?: string): Promise<ReturnRecord[]> {
    const list = await this.prisma.return.findMany({
      where: merchantId ? { merchantId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return list.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      merchantId: r.merchantId,
      shopifyReturnId: r.shopifyReturnId || undefined,
      reason: r.reason,
      status: r.status,
      refundAmount: r.refundAmount || undefined,
      currency: r.currency,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async logSecurityIncident(incident: SecurityIncident): Promise<SecurityIncident> {
    await this.prisma.securityIncident.create({
      data: {
        id: incident.id,
        merchantId: incident.merchantId,
        attackType: incident.attackType,
        flaggedPatterns: incident.flaggedPatterns,
        rawInput: incident.rawInput,
        normalizedInput: incident.normalizedInput,
        riskScore: incident.riskScore,
        createdAt: new Date(incident.createdAt),
      },
    });
    return incident;
  }

  async listSecurityIncidents(merchantId?: string): Promise<SecurityIncident[]> {
    const list = await this.prisma.securityIncident.findMany({
      where: merchantId ? { merchantId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return list.map((i) => ({
      id: i.id,
      merchantId: i.merchantId || undefined,
      attackType: i.attackType,
      flaggedPatterns: i.flaggedPatterns,
      rawInput: i.rawInput,
      normalizedInput: i.normalizedInput,
      riskScore: i.riskScore,
      createdAt: i.createdAt,
    }));
  }

  // ── Compatibility & Omni-Lifecycle Helpers ───────────────────────────────

  private _takeoverLocks = new Map<string, number>();

  setAdminTakeover(cartId: string, durationMs = 15 * 60 * 1000): void {
    this._takeoverLocks.set(cartId, Date.now() + durationMs);
  }

  removeAdminTakeover(cartId: string): void {
    this._takeoverLocks.delete(cartId);
  }

  isAdminTakenOver(cartId: string): boolean {
    const expiry = this._takeoverLocks.get(cartId);
    if (!expiry) return false;
    if (Date.now() > expiry) {
      this._takeoverLocks.delete(cartId);
      return false;
    }
    return true;
  }

  isAdminTakeover(cartId: string): boolean {
    return this.isAdminTakenOver(cartId);
  }

  getAdminTakeoverRemainingMs(cartId: string): number {
    const expiry = this._takeoverLocks.get(cartId);
    if (!expiry) return 0;
    const remaining = expiry - Date.now();
    if (remaining <= 0) {
      this._takeoverLocks.delete(cartId);
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
    return this.prisma.$transaction(async (tx) => {
      const cart = await tx.cartEvent.create({
        data: {
          cartToken: cartData.cartToken,
          merchantId: cartData.merchantId,
          customerPhone: cartData.customerPhone,
          customerEmail: cartData.customerEmail,
          customerName: cartData.customerName,
          currency: cartData.currency,
          totalPrice: cartData.totalPrice,
          totalAmountMinor: cartData.totalAmountMinor !== undefined ? BigInt(cartData.totalAmountMinor) : BigInt(Math.round((cartData.totalPrice || 0) * 100)),
          items: cartData.items as any,
          status: cartData.status as any,
          abandonmentType: cartData.abandonmentType as any,
          recoveryStage: cartData.recoveryStage as any,
          checkoutUrl: cartData.checkoutUrl,
          suggestedDiscountCode: cartData.suggestedDiscountCode,
        },
      });

      const idempotencyKey =
        customOutbox?.idempotencyKey ||
        this.generateOutboxIdempotencyKey(cartData.merchantId, cartData.cartToken, Date.now());

      const outbox = await tx.outboxEvent.create({
        data: {
          merchantId: cartData.merchantId,
          aggregateType: 'CART',
          aggregateId: cart.id,
          eventType: customOutbox?.eventType || 'CART_ABANDONED',
          payload: (customOutbox?.payload || { cartId: cart.id, cartToken: cart.cartToken }) as any,
          idempotencyKey,
          status: 'PENDING',
        },
      });

      return {
        cart: cart as unknown as CartEvent,
        outbox: {
          ...outbox,
          status: outbox.status as any,
          payload: outbox.payload as Record<string, unknown>,
        },
      };
    });
  }

  async pruneRecordsOlderThan(retentionDays = 90): Promise<{ prunedCarts: number; prunedLogs: number }> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const [c, l] = await Promise.all([
      this.prisma.cartEvent.deleteMany({
        where: { createdAt: { lt: cutoff }, status: { in: ['RECOVERED', 'EXPIRED'] } },
      }),
      this.prisma.messageLog.deleteMany({
        where: { createdAt: { lt: cutoff } },
      }),
    ]);
    return { prunedCarts: c.count, prunedLogs: l.count };
  }

  // ── Experiment Persistence & Metrics ────────────────────────────────────

  async recordExperimentAssignment(params: {
    experimentId: string;
    merchantId: string;
    subjectKey: string;
    variantId: string;
  }): Promise<void> {
    await this.prisma.experimentAssignment.upsert({
      where: {
        experimentId_subjectKey: {
          experimentId: params.experimentId,
          subjectKey: params.subjectKey,
        },
      },
      create: {
        experimentId: params.experimentId,
        merchantId: params.merchantId,
        subjectKey: params.subjectKey,
        variantId: params.variantId,
      },
      update: {}, // Sticky assignment: do not overwrite existing assignment
    });
  }

  async recordExperimentExposure(params: {
    experimentId: string;
    merchantId: string;
    subjectKey: string;
    variantId: string;
    context?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.experimentExposure.create({
      data: {
        experimentId: params.experimentId,
        merchantId: params.merchantId,
        subjectKey: params.subjectKey,
        variantId: params.variantId,
        context: (params.context as any) || undefined,
      },
    });
  }

  async recordExperimentOutcome(params: {
    experimentId: string;
    merchantId: string;
    subjectKey: string;
    variantId: string;
    isConverted: boolean;
    grossRecoveredPaise: bigint | number;
    netMarginPaise: bigint | number;
  }): Promise<void> {
    await this.prisma.experimentOutcome.create({
      data: {
        experimentId: params.experimentId,
        merchantId: params.merchantId,
        subjectKey: params.subjectKey,
        variantId: params.variantId,
        isConverted: params.isConverted,
        grossRecoveredPaise: BigInt(params.grossRecoveredPaise),
        netMarginPaise: BigInt(params.netMarginPaise),
      },
    });
  }

  async getExperimentMetrics(
    merchantId: string,
    experimentId?: string
  ): Promise<Array<{
    armId: string;
    strategyName: string;
    impressions: number;
    conversions: number;
    conversionRateBps: number;
    grossRecoveredPaise: number;
    netContributionPaise: number;
    liftOverBaselineBps: number;
  }>> {
    const experiments = await this.prisma.experiment.findMany({
      where: {
        merchantId,
        ...(experimentId ? { id: experimentId } : { status: 'ACTIVE' }),
      },
      include: {
        variants: {
          include: {
            exposures: true,
            outcomes: true,
          },
        },
      },
    });

    if (experiments.length === 0) {
      return [];
    }

    const exp = experiments[0];
    const controlVariant = exp.variants.find((v) => v.isControl) || exp.variants[0];
    const controlExposures = controlVariant ? controlVariant.exposures.length : 0;
    const controlConversions = controlVariant ? controlVariant.outcomes.filter((o) => o.isConverted).length : 0;
    const baselineRateBps = controlExposures > 0 ? Math.round((controlConversions / controlExposures) * 10000) : 0;

    return exp.variants.map((variant) => {
      const impressions = variant.exposures.length;
      const conversions = variant.outcomes.filter((o) => o.isConverted).length;
      const conversionRateBps = impressions > 0 ? Math.round((conversions / impressions) * 10000) : 0;
      const liftOverBaselineBps = conversionRateBps - baselineRateBps;

      const grossRecoveredPaise = variant.outcomes.reduce((sum, o) => sum + Number(o.grossRecoveredPaise), 0);
      const netContributionPaise = variant.outcomes.reduce((sum, o) => sum + Number(o.netMarginPaise), 0);

      return {
        armId: variant.key,
        strategyName: variant.name,
        impressions,
        conversions,
        conversionRateBps,
        grossRecoveredPaise,
        netContributionPaise,
        liftOverBaselineBps,
      };
    });
  }

}
