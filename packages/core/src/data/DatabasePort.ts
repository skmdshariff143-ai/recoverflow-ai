/**
 * RecoverFlow AI — Unified Database Port (Data Access Layer Abstraction)
 *
 * Exposes pure domain and application data operations.
 * Implemented by PrismaDatabase (PostgreSQL production) and MemoryDatabase (Demo/Test).
 * Application code and AI agents interact exclusively through this port.
 */

import type {
  Merchant,
  OutboxStatus,
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

// ── Identity & Tenancy Types ─────────────────────────────────────────────

export interface OrganizationRecord {
  id: string;
  name: string;
  slug: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface UserRecord {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface MembershipRecord {
  id: string;
  userId: string;
  organizationId: string;
  role: UserRole;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  organizationId: string;
  activeMerchantId: string;
  role: UserRole;
  isRevoked: boolean;
  revokedAt?: Date | string | null;
  revocationReason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  expiresAt: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ── Payment & Recovery Types ─────────────────────────────────────────────

export interface PaymentRecord {
  id: string;
  merchantId: string;
  customerId?: string | null;
  externalPaymentId: string;
  orderReference?: string | null;
  amountPaise: bigint | number;
  currency: string;
  status: string;
  gateway: string;
  paymentMethod?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface RecoveryCaseRecord {
  id: string;
  merchantId: string;
  paymentId: string;
  customerId?: string | null;
  status: string;
  attemptCount: number;
  retryCount?: number;
  processedAt?: Date | string | null;
  maxAttempts: number;
  recoveryProbBps: number;
  expectedValuePaise: bigint | number;
  nextAttemptScheduledAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface RecoveryDecisionRecord {
  id: string;
  recoveryCaseId: string;
  policyId?: string | null;
  recommendedAction: string;
  probRecoveryBps: number;
  expectedValuePaise: bigint | number;
  featuresSnapshot: Record<string, unknown>;
  aiAdvisoryAnalysis?: string | null;
  isHaltedBySafety: boolean;
  safetyHaltReason?: string | null;
  requiresApproval: boolean;
  createdAt: Date | string;
}

export interface RecoveryAttemptRecord {
  id: string;
  recoveryCaseId: string;
  attemptNumber: number;
  channel: string;
  dispatchedAt: Date | string;
  providerResponse?: Record<string, unknown> | null;
  status: string;
  externalMsgId?: string | null;
  createdAt: Date | string;
}

export interface RecoveryOutcomeRecord {
  id: string;
  recoveryCaseId: string;
  isRecovered: boolean;
  recoveredAmountPaise: bigint | number;
  feeAmountPaise: bigint | number;
  observedVia: string;
  verifiedAt: Date | string;
  createdAt: Date | string;
}

// ── Outbox, Idempotency & Webhook Types ───────────────────────────────────

export interface OutboxEventRecord {
  id: string;
  merchantId?: string | null;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  status: OutboxStatus;
  attemptCount: number;
  retryCount?: number;
  processedAt?: Date | string | null;
  maxAttempts: number;
  availableAt: Date | string;
  lockedAt?: Date | string | null;
  lockedBy?: string | null;
  publishedAt?: Date | string | null;
  lastError?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export type IdempotencyStatus = 'NEW' | 'IN_PROGRESS' | 'COMMITTED' | 'CONFLICT' | 'FAILED';

export interface IdempotencyKeyRecord {
  id?: string;
  key: string;
  merchantId: string;
  endpoint: string;
  requestHash?: string | null;
  status: IdempotencyStatus;
  responseCode?: number | null;
  responseBody?: unknown | null;
  lockedUntil?: Date | string | null;
  version: number;
  createdAt: Date | string;
  expiresAt: Date | string;
}

export interface WebhookEventRecord {
  id: string;
  merchantId?: string | null;
  provider: string;
  source: string;
  eventType: string;
  providerEventId?: string | null;
  externalId?: string | null;
  idempotencyKey: string;
  payloadHash?: string | null;
  rawPayload: Record<string, unknown>;
  signatureValid: boolean;
  status: 'PENDING' | 'PROCESSED' | 'DUPLICATE' | 'FAILED';
  attemptCount: number;
  lastError?: string | null;
  errorMessage?: string | null;
  receivedAt: Date | string;
  processedAt?: Date | string | null;
}

export interface AuditEventRecord {
  id: string;
  organizationId?: string | null;
  merchantId?: string | null;
  userId?: string | null;
  actorType: string;
  action: string;
  entityType: string;
  entityId: string;
  correlationId?: string | null;
  previousHash: string;
  payloadHash: string;
  currentHash: string;
  metadata?: Record<string, unknown> | null;
  createdAt: Date | string;
}

// ── Composite Transaction Inputs ─────────────────────────────────────────

export interface CreateRecoveryCaseAndEnqueueParams {
  payment: {
    merchantId: string;
    externalPaymentId: string;
    amountPaise: bigint | number;
    currency: string;
    status?: string;
    gateway?: string;
    customerId?: string;
    orderReference?: string;
  };
  recoveryCase: {
    customerId?: string;
    recoveryProbBps?: number;
    expectedValuePaise?: bigint | number;
  };
  outbox: {
    eventType: string;
    payload: Record<string, unknown>;
    idempotencyKey: string;
  };
}

export interface IngestRazorpayWebhookParams {
  webhookEvent: {
    merchantId?: string;
    provider: string;
    source?: string;
    eventType: string;
    providerEventId?: string;
    externalId?: string;
    idempotencyKey: string;
    payloadHash?: string;
    rawPayload: Record<string, unknown>;
    signatureValid: boolean;
  };
  payment?: {
    merchantId: string;
    externalPaymentId: string;
    amountPaise: bigint | number;
    currency: string;
    status?: string;
    gateway?: string;
    customerId?: string;
    orderReference?: string;
  };
  recoveryCase?: {
    customerId?: string;
    recoveryProbBps?: number;
    expectedValuePaise?: bigint | number;
  };
  outbox?: {
    eventType: string;
    payload: Record<string, unknown>;
    idempotencyKey: string;
  };
}

export interface SearchRecoveryCasesParams {
  merchantId: string;
  status?: string;
  minExpectedValuePaise?: number | bigint;
  search?: string;
  limit?: number;
  offset?: number;
}

// ── Database Port Interface ──────────────────────────────────────────────

export interface DatabasePort {
  clear?(): void;
  seedDefaults?(): void;
  createOrUpdateMerchant(merchant: Merchant): Promise<Merchant>;
  getAdminTakeoverRemainingMs?(cartId: string): number;

  // Compatibility & Omni-Lifecycle Helpers
  setAdminTakeover(cartId: string, durationMs?: number): void;
  removeAdminTakeover(cartId: string): void;
  isAdminTakenOver(cartId: string): boolean;
  isAdminTakeover(cartId: string): boolean;
  generateOutboxIdempotencyKey(shopDomain: string, cartToken: string, timestamp: number | string | Date): string;
  createCartWithOutbox(
    cartData: Omit<CartEvent, 'id' | 'createdAt' | 'updatedAt'>,
    customOutbox?: Partial<OutboxEventRecord>
  ): Promise<{ cart: CartEvent; outbox: OutboxEventRecord }>;
  createOrUpdateOrder(order: OrderRecord): Promise<OrderRecord>;
  getOrderByShopifyId(shopifyOrderId: string): Promise<OrderRecord | null>;
  getOrderByOrderNumber(merchantId: string, orderNumber: string): Promise<OrderRecord | null>;
  findOrdersByCustomer(merchantId: string, identifier: string): Promise<OrderRecord[]>;
  createOrUpdateFulfillment(fulfillment: FulfillmentRecord): Promise<FulfillmentRecord>;
  getFulfillment(id: string): Promise<FulfillmentRecord | null>;
  getFulfillmentByShopifyId(shopifyFulfillmentId: string): Promise<FulfillmentRecord | null>;
  getFulfillmentsByOrderId(orderId: string): Promise<FulfillmentRecord[]>;
  findFulfillmentByTracking(merchantId: string, trackingNumber: string): Promise<FulfillmentRecord | null>;
  createOrUpdateReturn(ret: ReturnRecord): Promise<ReturnRecord>;
  getReturn(id: string): Promise<ReturnRecord | null>;
  getReturnsByOrderId(orderId: string): Promise<ReturnRecord[]>;

  readonly isDurable: boolean;
  readonly providerName: string;

  // Lifecycle & Health
  ping(): Promise<boolean>;
  getHealth(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; latencyMs: number; details?: Record<string, unknown> }>;
  close(): Promise<void>;

  // Identity & Organizations
  getOrganization(id: string): Promise<OrganizationRecord | null>;
  getOrganizationBySlug(slug: string): Promise<OrganizationRecord | null>;
  createOrganization(data: { name: string; slug: string }): Promise<OrganizationRecord>;
  getUser(id: string): Promise<UserRecord | null>;
  getUserByEmail(email: string): Promise<UserRecord | null>;
  createUser(data: { email: string; name?: string }): Promise<UserRecord>;
  getMembership(userId: string, organizationId: string): Promise<MembershipRecord | null>;
  createMembership(data: { userId: string; organizationId: string; role: UserRole }): Promise<MembershipRecord>;

  // Sessions & Revocation
  createSession(data: {
    userId: string;
    tokenHash: string;
    organizationId: string;
    activeMerchantId: string;
    role: UserRole;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<SessionRecord>;
  getSession(tokenHash: string): Promise<SessionRecord | null>;
  revokeSession(sessionId: string, reason: string, revokedBy?: string): Promise<void>;
  revokeAllUserSessions(userId: string, reason: string, revokedBy?: string): Promise<number>;
  isSessionRevoked(tokenHash: string): Promise<boolean>;

  // Merchants
  getMerchant(id: string, organizationId?: string): Promise<Merchant | null>;
  getMerchantById(id: string): Promise<Merchant | null>;
  getMerchantByStoreUrl(storeUrl: string): Promise<Merchant | null>;
  getMerchantByShopDomain(shopDomain: string): Promise<Merchant | null>;
  listMerchants(organizationId?: string): Promise<Merchant[]>;
  upsertMerchant(merchant: Merchant): Promise<Merchant>;
  updateMerchantTone(
    id: string,
    updates: Partial<Pick<Merchant, 'brandVoiceCasualVsFormal' | 'brandVoiceUrgencyVsGentle' | 'discountCeilingPercentage' | 'brandToneGuidelines'>>
  ): Promise<Merchant | null>;

  // Cart & Checkout Events
  getCartById(id: string, merchantId?: string): Promise<CartEvent | null>;
  getCartEvent(id: string, merchantId?: string): Promise<CartEvent | null>;
  getCartByToken(token: string, merchantId?: string): Promise<CartEvent | null>;
  findCartByCustomerOrToken(identifier: string, merchantId?: string): Promise<CartEvent | null>;
  upsertCartEvent(cart: CartEvent): Promise<CartEvent>;
  updateCartStatus(id: string, status: CartStatus, stage?: RecoveryStage, discountCode?: string | null): Promise<CartEvent | null>;
  listCartEvents(merchantId?: string): Promise<CartEvent[]>;
  getCartEventsByMerchant(merchantId: string): Promise<CartEvent[]>;

  // Payments & Recovery Cases
  createPayment(data: {
    merchantId: string;
    externalPaymentId: string;
    amountPaise: bigint | number;
    currency: string;
    status?: string;
    gateway?: string;
    customerId?: string;
    orderReference?: string;
  }): Promise<PaymentRecord>;
  getPayment(id: string, merchantId?: string): Promise<PaymentRecord | null>;
  getPaymentByExternalId(externalPaymentId: string, merchantId?: string): Promise<PaymentRecord | null>;

  createRecoveryCase(data: {
    merchantId: string;
    paymentId: string;
    customerId?: string;
    recoveryProbBps?: number;
    expectedValuePaise?: bigint | number;
  }): Promise<RecoveryCaseRecord>;
  getRecoveryCase(id: string, merchantId?: string): Promise<RecoveryCaseRecord | null>;
  updateRecoveryCase(id: string, updates: Partial<RecoveryCaseRecord>, merchantId?: string): Promise<RecoveryCaseRecord | null>;
  listRecoveryCases(params: { merchantId: string; status?: string; limit?: number; offset?: number }): Promise<RecoveryCaseRecord[]>;
  searchRecoveryCases(params: SearchRecoveryCasesParams): Promise<{ items: RecoveryCaseRecord[]; total: number }>;

  // Unit-of-Work Atomic Transaction Methods
  createRecoveryCaseAndEnqueue(params: CreateRecoveryCaseAndEnqueueParams): Promise<{
    payment: PaymentRecord;
    recoveryCase: RecoveryCaseRecord;
    outbox: OutboxEventRecord;
  }>;
  ingestRazorpayWebhookTransaction(params: IngestRazorpayWebhookParams): Promise<{
    webhook: WebhookEventRecord;
    payment?: PaymentRecord;
    recoveryCase?: RecoveryCaseRecord;
    outbox?: OutboxEventRecord;
  }>;

  createRecoveryDecision(data: {
    recoveryCaseId: string;
    recommendedAction: string;
    probRecoveryBps: number;
    expectedValuePaise: bigint | number;
    featuresSnapshot: Record<string, unknown>;
    aiAdvisoryAnalysis?: string;
    isHaltedBySafety?: boolean;
    safetyHaltReason?: string;
  }): Promise<RecoveryDecisionRecord>;
  createRecoveryAttempt(data: {
    recoveryCaseId: string;
    attemptNumber: number;
    channel: string;
    status?: string;
    providerResponse?: Record<string, unknown>;
  }): Promise<RecoveryAttemptRecord>;
  createRecoveryOutcome(data: {
    recoveryCaseId: string;
    isRecovered: boolean;
    recoveredAmountPaise: bigint | number;
    feeAmountPaise?: bigint | number;
    observedVia: string;
  }): Promise<RecoveryOutcomeRecord>;

  // Transactional Outbox (PostgreSQL $transaction & claim semantics)
  createOutboxEvent(data: {
    merchantId?: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: Record<string, unknown>;
    idempotencyKey: string;
  }): Promise<OutboxEventRecord>;
  getPendingOutboxEvents(batchSize: number, merchantId?: string): Promise<OutboxEventRecord[]>;
  claimOutboxEvents(workerId: string, batchSize?: number, lockTtlMs?: number): Promise<OutboxEventRecord[]>;
  markOutboxEventProcessing(id: string, workerId?: string): Promise<void>;
  markOutboxEventPublished(id: string, workerId?: string): Promise<boolean>;
  markOutboxEventFailed(id: string, error: string, retryDelayMs?: number, workerId?: string): Promise<boolean>;
  extendOutboxLease(id: string, workerId: string, extendMs?: number): Promise<boolean>;

  // Idempotency Store
  acquireIdempotencyKey(params: {
    key: string;
    merchantId: string;
    endpoint: string;
    requestHash?: string;
    ttlMs?: number;
  }): Promise<{ acquired: boolean; existingResponse?: { code: number; body: unknown }; isConflict?: boolean }>;
  commitIdempotencyKey(key: string, merchantId: string, responseCode: number, responseBody: unknown, endpoint?: string): Promise<void>;
  releaseIdempotencyKey(key: string, merchantId: string, endpoint?: string): Promise<void>;

  // Webhook Events
  createWebhookEvent(data: {
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
  }): Promise<WebhookEventRecord>;
  getWebhookEvent(provider: string, providerEventId: string): Promise<WebhookEventRecord | null>;
  markWebhookEventProcessed(id: string, status: 'PROCESSED' | 'FAILED', error?: string): Promise<void>;

  // Audit Ledger (Merkle Hash Chain)
  appendAuditEvent(data: {
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
  }): Promise<AuditEventRecord>;
  getLatestAuditEvent(merchantId?: string): Promise<AuditEventRecord | null>;
  listAuditEvents(params: { merchantId?: string; entityType?: string; entityId?: string; limit?: number }): Promise<AuditEventRecord[]>;
  verifyAuditChain(merchantId?: string): Promise<{ valid: boolean; totalEvents: number; brokenAtId?: string }>;

  // Messages, Suppressions & E-Commerce
  logMessage(log: MessageLog): Promise<MessageLog>;
  listMessageLogs(merchantId?: string): Promise<MessageLog[]>;
  addSuppression(entry: SuppressionEntry): Promise<SuppressionEntry>;
  isSuppressed(identifier: string, type: 'PHONE' | 'EMAIL'): Promise<boolean>;
  getSuppressionList(): Promise<SuppressionEntry[]>;
  removeSuppression(identifier: string): Promise<boolean>;
  upsertOrder(order: OrderRecord): Promise<OrderRecord>;
  getOrder(id: string, merchantId?: string): Promise<OrderRecord | null>;
  listOrders(merchantId?: string): Promise<OrderRecord[]>;
  upsertFulfillment(fulfillment: FulfillmentRecord): Promise<FulfillmentRecord>;
  listFulfillments(merchantId?: string): Promise<FulfillmentRecord[]>;
  upsertReturn(returnRecord: ReturnRecord): Promise<ReturnRecord>;
  listReturns(merchantId?: string): Promise<ReturnRecord[]>;
  logSecurityIncident(incident: SecurityIncident): Promise<SecurityIncident>;
  listSecurityIncidents(merchantId?: string): Promise<SecurityIncident[]>;

  // Retention
  pruneRecordsOlderThan(retentionDays?: number): Promise<{ prunedCarts: number; prunedLogs: number }>;
}
