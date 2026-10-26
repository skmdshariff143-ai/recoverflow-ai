import { db } from './database';
import { getRuntimeMode } from '@recoverflow/core';
import type { UserSession } from '@recoverflow/core';
import type { RecoveryCaseRecord } from '@recoverflow/core';
import { maskIdentifier, summarizeCases, type ConsoleCase, type ConsoleSnapshot } from '../console-types';
import { ApiError } from './access';

export async function serializeCase(record: RecoveryCaseRecord, merchantId: string): Promise<ConsoleCase> {
  const payment = await db.getPayment(record.paymentId, merchantId);
  if (!payment) throw new ApiError(503, 'A case is missing its payment record.');
  return { id: record.id, paymentId: payment.externalPaymentId, customer: maskIdentifier(record.customerId), status: record.status, amountMinor: String(payment.amountPaise), currency: payment.currency, expectedValueMinor: String(record.expectedValuePaise), probabilityBps: record.recoveryProbBps, attempts: record.attemptCount, maxAttempts: record.maxAttempts, createdAt: new Date(record.createdAt).toISOString(), updatedAt: new Date(record.updatedAt).toISOString() };
}

export async function consoleSnapshot(session: UserSession): Promise<ConsoleSnapshot> {
  const merchantId = session.activeMerchantId;
  const [merchant, result, messages, audit] = await Promise.all([
    db.getMerchant(merchantId), db.searchRecoveryCases({ merchantId, limit: 500 }),
    db.listMessageLogs(merchantId), db.listAuditEvents({ merchantId, limit: 100, order: 'desc' }),
  ]);
  if (!merchant) throw new ApiError(404, 'Merchant not found.');
  const mode = getRuntimeMode();
  const demo = mode === 'DEMO' || mode === 'TEST';
  const cases = await Promise.all(result.items.map((entry) => serializeCase(entry, merchantId)));
  // Explicit allowlist: never send merchant credentials or encrypted secrets to the browser.
  return {
    mode, source: demo ? 'DEMO' : 'OBSERVED', session, persistence: db.isDurable ? 'POSTGRESQL' : 'MEMORY',
    merchant: { id: merchant.id, name: merchant.storeName, domain: merchant.shopDomain || merchant.storeUrl, guidelines: merchant.brandToneGuidelines, discountCeiling: merchant.discountCeilingPercentage, minMargin: merchant.minMarginPercentage, formality: merchant.brandVoiceCasualVsFormal, urgency: merchant.brandVoiceUrgencyVsGentle },
    cases, totalCases: result.total, currencies: summarizeCases(cases),
    messages: messages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 100).map((m) => ({ id: m.id, channel: m.channel, direction: m.direction, status: m.deliveryStatus, content: m.content, createdAt: new Date(m.createdAt).toISOString() })),
    audit: audit.map((event) => ({ id: event.id, action: event.action, entityId: event.entityId, actor: event.userId || event.actorType, hash: event.currentHash, createdAt: new Date(event.createdAt).toISOString(), reason: typeof event.metadata?.reason === 'string' ? event.metadata.reason : '' })),
    integrations: [
      { name: 'Shopify', configured: !demo && Boolean(merchant.encryptedShopifyAccessToken), detail: 'Store connection credentials' },
      { name: 'WhatsApp', configured: !demo && Boolean(merchant.encryptedWhatsappToken && merchant.whatsappPhoneId), detail: 'Messaging credentials and phone ID' },
      { name: 'Email', configured: !demo && Boolean(merchant.encryptedResendApiKey), detail: 'Email provider credentials' },
      { name: 'Gemini', configured: !demo && Boolean(merchant.encryptedGeminiApiKey || process.env.GEMINI_API_KEY), detail: 'Optional advisory model credentials' },
    ], generatedAt: new Date().toISOString(),
  };
}
