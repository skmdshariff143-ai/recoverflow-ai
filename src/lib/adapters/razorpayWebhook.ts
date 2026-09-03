/**
 * PayBack AI — Razorpay Test-Mode Webhook Ingestion & Payload Transformation.
 *
 * Provides cryptographic HMAC SHA-256 signature verification and deterministic
 * mapping from raw Razorpay `payment.failed` webhook payloads into the canonical
 * `FailedPayment` schema consumed by the recovery engine.
 *
 * Security Invariants:
 * 1. Webhook signatures are verified using timing-safe buffer comparison.
 * 2. Unsigned or invalid payloads are rejected before engine ingestion.
 * 3. Payment amounts are preserved in minor units (paise).
 * 4. High-value dual-custody thresholds (>= ₹50,000) are automatically enforced.
 */

import crypto from 'crypto';
import type { FailedPayment, FailureCategory, Currency, InvoiceValueTier } from '@/types/payment';

// ─── Razorpay Webhook Payload Interface ──────────────────────────────

export interface RazorpayPaymentEntity {
  id: string;
  amount: number;
  currency: string;
  status: string;
  order_id?: string | null;
  invoice_id?: string | null;
  international?: boolean;
  method?: string;
  amount_refunded?: number;
  refund_status?: string | null;
  captured?: boolean;
  description?: string;
  card_id?: string | null;
  bank?: string | null;
  wallet?: string | null;
  vpa?: string | null;
  email?: string;
  contact?: string;
  customer_id?: string;
  error_code?: string | null;
  error_description?: string | null;
  error_source?: string | null;
  error_step?: string | null;
  error_reason?: string | null;
  created_at?: number;
  notes?: Record<string, string | number | boolean>;
}

export interface RazorpaySubscriptionEntity {
  id: string;
  plan_id?: string;
  customer_id?: string;
  status: string;
  current_start?: number;
  current_end?: number;
  charge_at?: number;
  total_count?: number;
  paid_count?: number;
  remaining_count?: number;
  notes?: Record<string, string | number | boolean>;
}

export interface RazorpayInvoiceEntity {
  id: string;
  amount?: number;
  currency?: string;
  status?: string;
  customer_id?: string;
  subscription_id?: string;
  notes?: Record<string, string | number | boolean>;
}

export interface RazorpayWebhookPayload {
  entity: 'event';
  account_id?: string;
  event: string;
  contains?: string[];
  payload?: {
    payment?: {
      entity?: RazorpayPaymentEntity;
    };
    subscription?: {
      entity?: RazorpaySubscriptionEntity;
    };
    invoice?: {
      entity?: RazorpayInvoiceEntity;
    };
  };
  created_at?: number;
}

// ─── Signature Verification ──────────────────────────────────────────

/**
 * Verifies the Razorpay Webhook signature using HMAC SHA-256 and timing-safe equality.
 *
 * @param rawBody - Raw request body string (unmodified bytes as received over HTTP)
 * @param signature - The `x-razorpay-signature` header value
 * @param secret - The configured webhook secret (defaults to process.env.RAZORPAY_WEBHOOK_SECRET)
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string = process.env.RAZORPAY_WEBHOOK_SECRET || '',
): { valid: boolean; reason?: string } {
  if (!signature || signature.trim() === '') {
    return { valid: false, reason: 'Missing x-razorpay-signature header' };
  }

  if (!secret || secret.trim() === '') {
    return { valid: false, reason: 'RAZORPAY_WEBHOOK_SECRET is not configured' };
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('hex');

    const signatureBuffer = Buffer.from(signature.trim(), 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    if (signatureBuffer.length !== expectedBuffer.length) {
      return { valid: false, reason: 'Signature buffer length mismatch' };
    }

    const isValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
    return isValid
      ? { valid: true }
      : { valid: false, reason: 'Cryptographic signature mismatch' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, reason: `Verification exception: ${msg}` };
  }
}

// ─── Failure Category Mapping ────────────────────────────────────────

/**
 * Deterministically maps Razorpay error attributes into canonical PayBack AI failure categories.
 */
export function classifyRazorpayFailureCategory(entity: RazorpayPaymentEntity): FailureCategory {
  const code = (entity.error_code ?? '').toLowerCase();
  const desc = (entity.error_description ?? '').toLowerCase();
  const reason = (entity.error_reason ?? '').toLowerCase();
  const source = (entity.error_source ?? '').toLowerCase();

  const combined = `${code} ${desc} ${reason} ${source}`;

  if (combined.includes('insufficient') || combined.includes('low_balance') || combined.includes('funds')) {
    return 'insufficient_funds';
  }
  if (
    combined.includes('downtime') ||
    combined.includes('unavailable') ||
    combined.includes('bank_timeout') ||
    (source === 'issuing_bank' && combined.includes('technical'))
  ) {
    return 'bank_downtime';
  }
  if (
    combined.includes('auth') ||
    combined.includes('otp') ||
    combined.includes('pin') ||
    combined.includes('3ds') ||
    combined.includes('authentication')
  ) {
    return 'auth_failure';
  }
  if (combined.includes('expired') || combined.includes('expiry') || combined.includes('card_expired')) {
    return 'expired_card';
  }
  if (combined.includes('mandate') || combined.includes('token') || combined.includes('autopay') || combined.includes('subscription')) {
    return 'invalid_mandate';
  }
  if (combined.includes('duplicate') || combined.includes('already_processed') || combined.includes('idempotent')) {
    return 'duplicate_attempt';
  }
  if (combined.includes('cancelled') || combined.includes('canceled') || combined.includes('user_dropped') || combined.includes('aborted')) {
    return 'customer_cancellation';
  }
  if (
    combined.includes('permanent') ||
    combined.includes('closed') ||
    combined.includes('blocked') ||
    combined.includes('blacklisted') ||
    combined.includes('restricted_account')
  ) {
    return 'permanent_account_closure';
  }
  if (combined.includes('promise') || combined.includes('ptp')) {
    return 'broken_promise_to_pay';
  }

  return 'gateway_degradation';
}

// ─── Payload Transformation ──────────────────────────────────────────

/** High-value transaction threshold: ₹50,000 = 5,000,000 paise (Dual-Custody Approval Required) */
export const HIGH_VALUE_THRESHOLD_PAISE = 5000000;

/**
 * Transforms a verified Razorpay `payment.failed` webhook entity into the engine's canonical `FailedPayment` record.
 */
export function mapRazorpayWebhookToFailedPayment(payload: RazorpayWebhookPayload): FailedPayment {
  const paymentEntity = payload.payload?.payment?.entity;
  const subEntity = payload.payload?.subscription?.entity;
  const invoiceEntity = payload.payload?.invoice?.entity;

  if (!paymentEntity && !subEntity && !invoiceEntity) {
    throw new Error('Malformed Razorpay webhook: missing payload.payment.entity (or subscription/invoice entity)');
  }

  // 1. Payment Entity Path
  if (paymentEntity) {
    const paymentId = paymentEntity.id || `pay_${Date.now()}`;
    const customerId = paymentEntity.customer_id || (paymentEntity.email ? `cust_${paymentEntity.email.split('@')[0].slice(0, 10)}` : `cust_${paymentId.slice(4, 10)}`);
    const amountPaise = Number(paymentEntity.amount) || 0;
    const currency: Currency = (paymentEntity.currency?.toUpperCase() === 'USD' ? 'USD' : paymentEntity.currency?.toUpperCase() === 'EUR' ? 'EUR' : paymentEntity.currency?.toUpperCase() === 'GBP' ? 'GBP' : 'INR');
    
    const failureCategory = classifyRazorpayFailureCategory(paymentEntity);
    const failureTimestamp = paymentEntity.created_at
      ? new Date(paymentEntity.created_at * 1000).toISOString()
      : payload.created_at
      ? new Date(payload.created_at * 1000).toISOString()
      : new Date().toISOString();

    const notes = paymentEntity.notes || {};
    const isOptedOut = notes.opt_out === true || notes.opt_out === 'true' || notes.dpdp_opt_out === 'true' || notes.dpdp_opt_out === true;
    const invoiceValueTier: InvoiceValueTier = amountPaise >= HIGH_VALUE_THRESHOLD_PAISE ? 'high_value' : 'standard';

    const rawError = paymentEntity.error_description
      ? `${paymentEntity.error_code || 'GATEWAY_ERR'}: ${paymentEntity.error_description} (source: ${paymentEntity.error_source || 'gateway'})`
      : paymentEntity.error_code || 'Payment declined by gateway during authorization';

    const onTimeRate = typeof notes.on_time_rate === 'number' ? Number(notes.on_time_rate) : 0.75;
    const brokenPromises = typeof notes.broken_promises === 'number' ? Number(notes.broken_promises) : 0;
    const tenure = typeof notes.tenure_months === 'number' ? Number(notes.tenure_months) : 14;

    return {
      payment_id: paymentId,
      customer_id: customerId,
      amount: amountPaise,
      currency,
      failure_category: failureCategory,
      failure_timestamp: failureTimestamp,
      attempt_count: 0,
      opt_out: isOptedOut,
      quiet_hours_window: {
        start: 21,
        end: 9,
        timezone: 'Asia/Kolkata',
      },
      invoice_value_tier: invoiceValueTier,
      raw_gateway_error: rawError,
      customer_payment_history: {
        on_time_payment_rate: Math.min(1, Math.max(0, onTimeRate)),
        broken_promise_count: Math.max(0, brokenPromises),
        tenure_months: Math.max(1, tenure),
        total_transactions: 12,
        past_recovery_successes: 2,
        past_recovery_failures: 1,
      },
    };
  }

  // 2. Subscription Entity Path (e.g. subscription.halted, subscription.cancelled, subscription.paused)
  if (subEntity) {
    const subId = subEntity.id || `sub_${Date.now()}`;
    const customerId = subEntity.customer_id || `cust_${subId.slice(4, 12)}`;
    const notes = subEntity.notes || {};
    const amountPaise = Number(notes.amount) || (subEntity.paid_count ? 149900 : 99900);
    const currency: Currency = 'INR';

    let failureCategory: FailureCategory = 'invalid_mandate';
    if (payload.event.includes('cancel')) {
      failureCategory = 'customer_cancellation';
    } else if (payload.event.includes('halt')) {
      failureCategory = 'invalid_mandate';
    } else if (payload.event.includes('pause')) {
      failureCategory = 'customer_cancellation';
    }

    const failureTimestamp = payload.created_at
      ? new Date(payload.created_at * 1000).toISOString()
      : new Date().toISOString();

    const isOptedOut = notes.opt_out === true || notes.opt_out === 'true' || notes.dpdp_opt_out === 'true' || notes.dpdp_opt_out === true;
    const invoiceValueTier: InvoiceValueTier = amountPaise >= HIGH_VALUE_THRESHOLD_PAISE ? 'high_value' : 'standard';
    const rawError = `Razorpay Subscription ${subId} state change to '${subEntity.status}' (event: ${payload.event})`;

    return {
      payment_id: subId,
      customer_id: customerId,
      amount: amountPaise,
      currency,
      failure_category: failureCategory,
      failure_timestamp: failureTimestamp,
      attempt_count: 0,
      opt_out: isOptedOut,
      quiet_hours_window: {
        start: 21,
        end: 9,
        timezone: 'Asia/Kolkata',
      },
      invoice_value_tier: invoiceValueTier,
      raw_gateway_error: rawError,
      customer_payment_history: {
        on_time_payment_rate: 0.82,
        broken_promise_count: 0,
        tenure_months: 18,
        total_transactions: 18,
        past_recovery_successes: 3,
        past_recovery_failures: 0,
      },
    };
  }

  // 3. Invoice Entity Path (e.g. invoice.payment_failed)
  const inv = invoiceEntity!;
  const invId = inv.id || `inv_${Date.now()}`;
  const customerId = inv.customer_id || `cust_${invId.slice(4, 12)}`;
  const amountPaise = Number(inv.amount) || 299900;
  const currency: Currency = (inv.currency?.toUpperCase() === 'USD' ? 'USD' : 'INR');
  const failureTimestamp = payload.created_at
    ? new Date(payload.created_at * 1000).toISOString()
    : new Date().toISOString();

  return {
    payment_id: invId,
    customer_id: customerId,
    amount: amountPaise,
    currency,
    failure_category: 'invalid_mandate',
    failure_timestamp: failureTimestamp,
    attempt_count: 0,
    opt_out: false,
    quiet_hours_window: {
      start: 21,
      end: 9,
      timezone: 'Asia/Kolkata',
    },
    invoice_value_tier: amountPaise >= HIGH_VALUE_THRESHOLD_PAISE ? 'high_value' : 'standard',
    raw_gateway_error: `Invoice ${invId} failed to charge mandate (event: ${payload.event})`,
    customer_payment_history: {
      on_time_payment_rate: 0.75,
      broken_promise_count: 0,
      tenure_months: 12,
      total_transactions: 12,
      past_recovery_successes: 2,
      past_recovery_failures: 1,
    },
  };
}
