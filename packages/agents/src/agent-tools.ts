import { parseDecimalToMinorUnits } from '@recoverflow/core';
/**
 * RecoverFlow AI — Bounded Multi-Agent Typed Tool Interfaces.
 *
 * Implements strict, tenant-scoped, RBAC-authorized tool interfaces for AI agents
 * operating across merchant recovery, analytics, and customer communication workflows.
 */

import {
  db,
  requirePermission,
  assertTenantScoping,
  type UserSession,
  type CartEvent,
  type CartStatus,
  type AbandonmentType,
  type MessageChannel,
  type RecoveryAgentInput,
  type RecoveryAgentOutput,
} from '@recoverflow/core';
import { runRecoveryAgent, generateDeterministicRecoveryCopy } from './recovery-agent';

export interface RecoverySearchQuery {
  status?: string;
  search?: string;
  minExpectedValuePaise?: number | bigint;
  limit?: number;
  offset?: number;
}

export interface SanitizedRecoveryCaseItem {
  caseId: string;
  paymentId: string;
  merchantId: string;
  customerMasked?: string;
  status: string;
  expectedValueMinor: number;
  recoveryProbabilityBps: number;
  strategy: string;
  attemptCount: number;
  nextAction: string;
  createdAt: string | Date;
}

export interface SanitizedRecoveryCase {
  id: string;
  cartToken: string;
  merchantId: string;
  status: CartStatus;
  recoveryStage: string;
  dropOffReason?: AbandonmentType;
  currency: string;
  totalPrice: number;
  customerName?: string;
  customerPhoneMasked?: string;
  customerEmailMasked?: string;
  itemCount: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface MerchantMetricsResult {
  merchantId: string;
  totalCarts: number;
  recoveredCarts: number;
  openOrContactedCarts: number;
  recoveryRateBps: number; // Basis points (10000 = 100%)
  totalGrossRecoveredPaise: number;
  currency: string;
}

export interface ExperimentArmPerformance {
  armId: string;
  strategyName: string;
  impressions: number;
  conversions: number;
  conversionRateBps: number;
  liftOverBaselineBps: number;
}

export interface DraftCommunicationParams {
  caseId: string;
  channel?: MessageChannel;
  customGuidelines?: string;
  useDeterministicOnly?: boolean;
}

/**
 * Sanitizes CartEvent for secure AI agent context consumption (masking PII).
 */
function sanitizeCart(cart: CartEvent): SanitizedRecoveryCase {
  const phone = cart.customerPhone;
  const email = cart.customerEmail;
  return {
    id: cart.id,
    cartToken: cart.cartToken,
    merchantId: cart.merchantId,
    status: cart.status,
    recoveryStage: cart.recoveryStage,
    dropOffReason: cart.abandonmentType,
    currency: cart.currency,
    totalPrice: cart.totalPrice,
    customerName: cart.customerName,
    customerPhoneMasked: phone ? `${phone.slice(0, 3)}****${phone.slice(-3)}` : undefined,
    customerEmailMasked: email ? `${email.slice(0, 2)}***@${email.split('@')[1] || 'domain.com'}` : undefined,
    itemCount: cart.items?.length || 0,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
  };
}

/**
 * Tool: Retrieve a specific recovery case with tenant scoping and RBAC authorization.
 */
export async function getRecoveryCaseTool(
  caseId: string,
  session: UserSession,
): Promise<SanitizedRecoveryCase> {
  requirePermission(session, 'policy:view');

  const cart = await db.getCartEvent(caseId);
  if (!cart) {
    throw new Error(`NOT_FOUND: Recovery case '${caseId}' not found`);
  }

  assertTenantScoping(session, cart.merchantId);
  return sanitizeCart(cart);
}

/**
 * Tool: Search and filter recovery cases strictly bounded to the authenticated tenant using DB-level queries.
 */
export async function searchRecoveryCasesTool(
  query: RecoverySearchQuery,
  session: UserSession,
): Promise<{ total: number; limit: number; offset: number; cases: SanitizedRecoveryCaseItem[] }> {
  requirePermission(session, 'policy:view');

  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const offset = Math.max(0, query.offset || 0);

  // Execute database-level filtering, pagination, and sorting
  const result = await db.searchRecoveryCases({
    merchantId: session.activeMerchantId,
    status: query.status,
    search: query.search,
    minExpectedValuePaise: query.minExpectedValuePaise,
    limit,
    offset,
  });

  const sanitizedCases: SanitizedRecoveryCaseItem[] = result.items.map((rc) => {
    const custId = rc.customerId;
    const maskedCustomer = custId ? `${custId.slice(0, 3)}***${custId.slice(-2)}` : undefined;
    const expectedValueMinor = typeof rc.expectedValuePaise === 'bigint' ? Number(rc.expectedValuePaise) : Number(rc.expectedValuePaise || 0);
    const probBps = rc.recoveryProbBps || 0;

    const strategy = 'DYNAMIC_DISCOUNT_MAB';
    let nextAction = 'SCHEDULE_DISPATCH';
    if (rc.status === 'RECOVERED') {
      nextAction = 'ARCHIVE_SUCCESS';
    } else if (rc.status === 'STOPPED' || rc.attemptCount >= rc.maxAttempts) {
      nextAction = 'CLOSE_EXPIRED';
    } else if (rc.status === 'APPROVAL_REQUIRED') {
      nextAction = 'REQUEST_DUAL_APPROVAL';
    }

    return {
      caseId: rc.id,
      paymentId: rc.paymentId,
      merchantId: rc.merchantId,
      customerMasked: maskedCustomer,
      status: rc.status,
      expectedValueMinor,
      recoveryProbabilityBps: probBps,
      strategy,
      attemptCount: rc.attemptCount,
      nextAction,
      createdAt: rc.createdAt,
    };
  });

  return {
    total: result.total,
    limit,
    offset,
    cases: sanitizedCases,
  };
}

/**
 * Tool: Compute high-level recovery financial metrics for the active merchant.
 */
export async function getMerchantMetricsTool(
  session: UserSession,
): Promise<MerchantMetricsResult> {
  requirePermission(session, 'financials:view');

  const carts = await db.getCartEventsByMerchant(session.activeMerchantId);
  const totalCarts = carts.length;
  const recovered = carts.filter((c) => c.status === 'RECOVERED');
  const openOrContacted = carts.filter((c) => c.status === 'OPEN' || c.status === 'CONTACTED');

  const recoveredPaiseBigInt = recovered.reduce((acc, c) => {
    const minor = c.totalAmountMinor !== undefined ? BigInt(c.totalAmountMinor) : parseDecimalToMinorUnits(c.totalPrice || 0);
    return acc + minor;
  }, 0n);
  const recoveryRateBps = totalCarts > 0 ? Math.round((recovered.length / totalCarts) * 10000) : 0;

  return {
    merchantId: session.activeMerchantId,
    totalCarts,
    recoveredCarts: recovered.length,
    openOrContactedCarts: openOrContacted.length,
    recoveryRateBps,
    totalGrossRecoveredPaise: Number(recoveredPaiseBigInt),
    currency: carts[0]?.currency || 'INR',
  };
}

/**
 * Tool: Inspect multi-armed bandit (MAB) experimentation and lift metrics.
 * In DEMO: Returns fixture benchmark data (dataSource: 'DEMO').
 * In SANDBOX / LIVE: Queries genuine persisted experiment records (dataSource: 'OBSERVED').
 * Never fabricates observed numbers if none exist.
 */
export async function getExperimentPerformanceTool(
  session: UserSession,
): Promise<{ merchantId: string; dataSource: 'DEMO' | 'OBSERVED' | 'BENCHMARK'; arms: ExperimentArmPerformance[] }> {
  requirePermission(session, 'policy:view');

  const mode = process.env.RECOVERFLOW_RUNTIME_MODE || 'DEMO';

  if (mode === 'DEMO') {
    const demoArms: ExperimentArmPerformance[] = [
      {
        armId: 'arm_control_static',
        strategyName: 'Static Generic WhatsApp Reminder',
        impressions: 240,
        conversions: 42,
        conversionRateBps: 1750, // 17.5%
        liftOverBaselineBps: 0,
      },
      {
        armId: 'arm_dynamic_incentive_mab',
        strategyName: 'Thompson Sampling Multi-Armed Dynamic Recovery',
        impressions: 280,
        conversions: 78,
        conversionRateBps: 2785, // 27.85%
        liftOverBaselineBps: 1035, // +10.35% absolute lift
      },
      {
        armId: 'arm_high_touch_concierge',
        strategyName: 'AI Concierge VIP Assisted Checkout',
        impressions: 110,
        conversions: 41,
        conversionRateBps: 3727, // 37.27%
        liftOverBaselineBps: 1977, // +19.77% absolute lift
      },
    ];
    return {
      merchantId: session.activeMerchantId,
      dataSource: 'DEMO',
      arms: demoArms,
    };
  }

  // SANDBOX or LIVE: Query genuine database records
  const dbMetrics = await db.getExperimentMetrics(session.activeMerchantId);
  const arms: ExperimentArmPerformance[] = dbMetrics.map((m) => ({
    armId: m.armId,
    strategyName: m.strategyName,
    impressions: m.impressions,
    conversions: m.conversions,
    conversionRateBps: m.conversionRateBps,
    liftOverBaselineBps: m.liftOverBaselineBps,
  }));

  return {
    merchantId: session.activeMerchantId,
    dataSource: 'OBSERVED',
    arms,
  };
}

/**
 * Tool: Generate a compliant draft communication bounded by merchant policy.
 */
export async function draftCommunicationTool(
  params: DraftCommunicationParams,
  session: UserSession,
): Promise<RecoveryAgentOutput> {
  if (!session) {
    throw new Error('UNAUTHENTICATED: Session required to draft communications');
  }
  requirePermission(session, 'support:intervene');

  const cart = await db.getCartEvent(params.caseId);
  if (!cart) {
    throw new Error(`NOT_FOUND: Recovery case '${params.caseId}' not found`);
  }

  assertTenantScoping(session, cart.merchantId);

  const merchant = await db.getMerchant(cart.merchantId);
  const brandName = merchant?.storeName || 'RecoverFlow Store';
  const discountCeiling = merchant?.discountCeilingPercentage ?? 10;
  const casualVsFormal = merchant?.brandVoiceCasualVsFormal ?? 0.5;
  const urgencyVsGentle = merchant?.brandVoiceUrgencyVsGentle ?? 0.5;

  const agentInput: RecoveryAgentInput = {
    customerName: cart.customerName || 'Valued Customer',
    items: cart.items || [],
    totalValue: cart.totalPrice,
    currency: cart.currency,
    dropOffReason: cart.abandonmentType || 'CHECKOUT_STEP',
    checkoutUrl: cart.checkoutUrl || `https://${merchant?.storeUrl || 'store.com'}/checkout/${cart.cartToken}`,
    merchantTone: {
      brandName,
      casualVsFormal,
      urgencyVsGentle,
      discountCeilingPercentage: discountCeiling,
      guidelines: params.customGuidelines || merchant?.brandToneGuidelines || 'Be courteous and helpful.',
    },
  };

  if (params.useDeterministicOnly) {
    return generateDeterministicRecoveryCopy(agentInput);
  }

  return runRecoveryAgent(agentInput);
}
