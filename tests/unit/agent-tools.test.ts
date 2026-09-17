import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  DEMO_PERSONA_SESSIONS,
  type UserSession,
} from '@recoverflow/core';
import {
  getRecoveryCaseTool,
  searchRecoveryCasesTool,
  getMerchantMetricsTool,
  getExperimentPerformanceTool,
  draftCommunicationTool,
} from '@recoverflow/agents';

describe('RecoverFlow AI — Bounded Multi-Agent Typed Tool Interfaces', () => {
  beforeEach(() => {
    db.clear();
    db.seedDefaults();
  });

  const ownerSession = DEMO_PERSONA_SESSIONS.OWNER;
  const mgrSession = DEMO_PERSONA_SESSIONS.RECOVERY_MANAGER;
  const supportSession = DEMO_PERSONA_SESSIONS.SUPPORT_AGENT;
  const devSession = DEMO_PERSONA_SESSIONS.DEVELOPER;
  const viewerSession = DEMO_PERSONA_SESSIONS.VIEWER;

  it('getRecoveryCaseTool returns sanitized cart data for authorized session', async () => {
    const carts = await db.getCartEventsByMerchant('merchant_default_01');
    expect(carts.length).toBeGreaterThan(0);
    const targetCart = carts[0];

    const result = await getRecoveryCaseTool(targetCart.id, mgrSession);
    expect(result.id).toBe(targetCart.id);
    expect(result.merchantId).toBe('merchant_default_01');
    expect(result.totalPrice).toBe(targetCart.totalPrice);
    // PII should not leak in cleartext if masked
    if (targetCart.customerPhone) {
      expect(result.customerPhoneMasked).toContain('****');
    }
  });

  it('getRecoveryCaseTool blocks cross-tenant access attempts', async () => {
    const carts = await db.getCartEventsByMerchant('merchant_default_01');
    const targetCart = carts[0];

    const crossTenantSession: UserSession = {
      ...DEMO_PERSONA_SESSIONS.RECOVERY_MANAGER,
      activeMerchantId: 'merchant_OTHER_STORE',
    };

    await expect(getRecoveryCaseTool(targetCart.id, crossTenantSession)).rejects.toThrow(
      /FORBIDDEN_CROSS_MERCHANT/,
    );
  });

  it('searchRecoveryCasesTool returns scoped, paginated results', async () => {
    const result = await searchRecoveryCasesTool({ limit: 10, offset: 0 }, mgrSession);
    expect(result.total).toBeGreaterThan(0);
    expect(result.cases.length).toBeLessThanOrEqual(10);
    for (const c of result.cases) {
      expect(c.merchantId).toBe('merchant_default_01');
    }
  });

  it('getMerchantMetricsTool computes correct integer-paise metrics', async () => {
    const metrics = await getMerchantMetricsTool(ownerSession);
    expect(metrics.merchantId).toBe('merchant_default_01');
    expect(metrics.totalCarts).toBeGreaterThan(0);
    expect(typeof metrics.recoveryRateBps).toBe('number');
    expect(typeof metrics.totalGrossRecoveredPaise).toBe('number');
    expect(metrics.recoveryRateBps).toBeGreaterThanOrEqual(0);
    expect(metrics.recoveryRateBps).toBeLessThanOrEqual(10000);
  });

  it('getMerchantMetricsTool enforces financials:view permission', async () => {
    // DEVELOPER role lacks financials:view permission
    await expect(getMerchantMetricsTool(devSession)).rejects.toThrow(
      /FORBIDDEN_PERMISSION/,
    );
  });

  it('getExperimentPerformanceTool returns MAB arm statistics', async () => {
    const perf = await getExperimentPerformanceTool(mgrSession);
    expect(perf.merchantId).toBe('merchant_default_01');
    expect(perf.arms.length).toBeGreaterThanOrEqual(2);
    expect(perf.arms[0].armId).toBeDefined();
    expect(perf.arms[0].conversionRateBps).toBeDefined();
  });

  it('draftCommunicationTool generates bounded deterministic recovery draft', async () => {
    const carts = await db.getCartEventsByMerchant('merchant_default_01');
    const targetCart = carts[0];

    const draft = await draftCommunicationTool(
      {
        caseId: targetCart.id,
        useDeterministicOnly: true,
      },
      supportSession,
    );

    expect(draft.messageBody).toBeTruthy();
    expect(draft.callToActionUrl).toBeTruthy();
    expect(draft.urgencyLevel).toBeDefined();
    expect(draft.channel).toBe('WHATSAPP');
  });

  it('draftCommunicationTool rejects unauthorized roles without support permission', async () => {
    const carts = await db.getCartEventsByMerchant('merchant_default_01');
    const targetCart = carts[0];

    // VIEWER cannot draft communications
    await expect(
      draftCommunicationTool(
        { caseId: targetCart.id, useDeterministicOnly: true },
        viewerSession,
      ),
    ).rejects.toThrow(/FORBIDDEN_PERMISSION/);
  });
});
