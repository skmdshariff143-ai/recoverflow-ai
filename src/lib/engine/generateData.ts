/**
 * PayBack AI — Synthetic Failed-Payment Data Generator.
 *
 * Produces ≥100 realistic failed-payment records evenly distributed
 * across 10 failure categories. Each record includes a synthetic
 * customer_payment_history that the scoring model will consume.
 *
 * Design:
 *  - Framework-agnostic: no React / Next.js imports.
 *  - Seeded PRNG (xoshiro128**) for deterministic reproducibility.
 *  - Even distribution: ceil(total/10) records per category.
 *  - Customer histories are varied to test scoring sensitivity:
 *    reliable payers, risky payers, new customers, etc.
 */

import {
  type FailedPayment,
  type FailureCategory,
  type Currency,
  type InvoiceValueTier,
  type QuietHoursWindow,
  type CustomerPaymentHistory,
  FAILURE_CATEGORIES,
  CURRENCIES,
} from '@/types';

// ─── Seeded PRNG (xoshiro128**) ─────────────────────────────────────

function createSeededRandom(seed: number): () => number {
  function splitmix32(s: number): number {
    s = (s + 0x9e3779b9) | 0;
    let t = s ^ (s >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    t = t ^ (t >>> 15);
    return t >>> 0;
  }

  let s0 = splitmix32(seed);
  let s1 = splitmix32(s0);
  let s2 = splitmix32(s1);
  let s3 = splitmix32(s2);

  return function xoshiro128ss(): number {
    const result = Math.imul(rotl(Math.imul(s1, 5), 7), 9);
    const t = s1 << 9;
    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = rotl(s3, 11);
    return (result >>> 0) / 4294967296;
  };
}

function rotl(x: number, k: number): number {
  return (x << k) | (x >>> (32 - k));
}

// ─── Gateway Error Templates ────────────────────────────────────────

const GATEWAY_ERRORS: Record<FailureCategory, string[]> = {
  insufficient_funds: [
    'E_INSF: Account balance insufficient for debit of requested amount',
    'DECLINE_INSUFFICIENT_FUNDS: Card issuer declined — low balance',
    'ERR_NSF: Non-sufficient funds in linked account',
  ],
  bank_downtime: [
    'E_BANK_TIMEOUT: Issuing bank did not respond within 30s',
    'BANK_UNAVAILABLE: Service window — bank maintenance in progress',
    'ERR_CONN_REFUSED: TCP connection to bank gateway refused',
  ],
  auth_failure: [
    'E_3DS_FAIL: 3D-Secure authentication was rejected by cardholder',
    'OTP_EXPIRED: One-time password expired before confirmation',
    'AUTH_DECLINED: Authentication challenge failed after 3 attempts',
  ],
  expired_card: [
    'E_CARD_EXPIRED: Card expiry date 03/2024 is in the past',
    'DECLINED_EXPIRED: Transaction declined — expired card on file',
    'ERR_EXP: Instrument validity period has lapsed',
  ],
  invalid_mandate: [
    'E_MANDATE_INVALID: e-NACH mandate ID mndt_8371 not found or revoked',
    'MANDATE_EXPIRED: Recurring mandate expired on 2024-01-15',
    'ERR_MANDATE: Mandate amount ceiling exceeded',
  ],
  duplicate_attempt: [
    'E_DUP_TXN: Duplicate transaction detected — idempotency key collision',
    'DUPLICATE_PAYMENT: Payment with same reference already processed',
    'ERR_REPEAT: Repeated submission within dedup window (5 min)',
  ],
  customer_cancellation: [
    'E_CUST_CANCEL: Customer initiated cancellation during checkout',
    'USER_ABORT: Payment flow abandoned by payer before completion',
    'CANCEL_REQUESTED: Customer requested cancellation via support',
  ],
  gateway_degradation: [
    'E_GW_DEGRADED: Gateway response time exceeded 10s SLA threshold',
    'PARTIAL_OUTAGE: Intermittent failures on gateway cluster gw-east-2',
    'ERR_RATE_LIMIT: Gateway rate limit hit — retry after 60s',
  ],
  permanent_account_closure: [
    'E_ACCT_CLOSED: Customer account permanently closed by issuer',
    'ACCOUNT_TERMINATED: Bank account closed — no recovery possible',
    'ERR_FROZEN: Account frozen by regulatory order — permanent',
  ],
  broken_promise_to_pay: [
    'E_PTP_BROKEN: Customer missed promised payment date 2024-06-01',
    'PROMISE_LAPSED: Promise-to-pay #PTP-4421 expired without payment',
    'ERR_PTP_FAIL: Third consecutive broken payment promise',
  ],
};

const TIMEZONES = [
  'Asia/Kolkata',
  'America/New_York',
  'Europe/London',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Europe/Berlin',
  'Australia/Sydney',
  'Asia/Singapore',
];

// ─── Public API ─────────────────────────────────────────────────────

export interface GenerateDataOptions {
  /** Total records to generate. Must be ≥ 10. Default: 100. */
  totalRecords?: number;
  /** Numeric seed for deterministic generation. Omit for random. */
  seed?: number;
}

/**
 * Generate synthetic failed-payment records with customer payment history.
 *
 * Even distribution across 10 failure categories. Deterministic when seeded.
 */
export function generateSyntheticPayments(
  options: GenerateDataOptions = {},
): FailedPayment[] {
  const { totalRecords = 100, seed } = options;

  if (totalRecords < 10) {
    throw new Error('totalRecords must be ≥ 10 (at least 1 per category)');
  }

  const rand =
    seed !== undefined ? createSeededRandom(seed) : () => Math.random();

  const records: FailedPayment[] = [];
  const perCategory = Math.ceil(totalRecords / FAILURE_CATEGORIES.length);
  let paymentCounter = 1;

  for (const category of FAILURE_CATEGORIES) {
    const count = Math.min(perCategory, totalRecords - records.length);
    for (let i = 0; i < count; i++) {
      records.push(buildRecord(category, paymentCounter, rand));
      paymentCounter++;
    }
  }

  // Shuffle to avoid ordered-by-category bias.
  fisherYatesShuffle(records, rand);

  return records;
}

// ─── Record Builder ─────────────────────────────────────────────────

function buildRecord(
  category: FailureCategory,
  index: number,
  rand: () => number,
): FailedPayment {
  const paymentId = `pay_${String(index).padStart(5, '0')}`;
  const customerId = `cust_${String(Math.floor(rand() * 500) + 1).padStart(4, '0')}`;

  const isHighValue = rand() < 0.15;
  const amount = isHighValue
    ? Math.floor(rand() * 4_500_000) + 500_000  // ₹5,000–₹50,000
    : Math.floor(rand() * 499_900) + 100;        // ₹1–₹5,000

  const currency: Currency = CURRENCIES[Math.floor(rand() * CURRENCIES.length)];

  // Failure timestamp: random time in past 30 days from a fixed reference.
  const referenceDate = new Date('2025-08-30T00:00:00Z');
  const offset = Math.floor(rand() * 30 * 24 * 60 * 60 * 1000);
  const failureTimestamp = new Date(referenceDate.getTime() - offset).toISOString();

  const attemptCount = Math.floor(rand() * 3);
  const optOut = rand() < 0.08;

  // Quiet hours.
  const quietStart = Math.floor(rand() * 24);
  const quietEnd = (quietStart + 6 + Math.floor(rand() * 4)) % 24;
  const timezone = TIMEZONES[Math.floor(rand() * TIMEZONES.length)];
  const quietHoursWindow: QuietHoursWindow = {
    start: quietStart,
    end: quietEnd,
    timezone,
  };

  const invoiceValueTier: InvoiceValueTier = isHighValue ? 'high_value' : 'standard';

  const errors = GATEWAY_ERRORS[category];
  const rawGatewayError = errors[Math.floor(rand() * errors.length)];

  // Customer payment history — varied profiles.
  const customerPaymentHistory = buildCustomerHistory(category, rand);

  return {
    payment_id: paymentId,
    customer_id: customerId,
    amount,
    currency,
    failure_category: category,
    failure_timestamp: failureTimestamp,
    attempt_count: attemptCount,
    opt_out: optOut,
    quiet_hours_window: quietHoursWindow,
    invoice_value_tier: invoiceValueTier,
    raw_gateway_error: rawGatewayError,
    customer_payment_history: customerPaymentHistory,
  };
}

/**
 * Build a synthetic customer payment history that correlates
 * with the failure category to create realistic scoring signals.
 *
 * E.g. broken_promise_to_pay customers tend to have lower on_time rates
 * and higher broken_promise_count. Bank downtime / gateway issues
 * tend to affect otherwise reliable customers.
 */
function buildCustomerHistory(
  category: FailureCategory,
  rand: () => number,
): CustomerPaymentHistory {
  // Base profile — "average customer."
  let onTimeBase = 0.5 + rand() * 0.4;        // 0.50–0.90
  let brokenPromiseBase = Math.floor(rand() * 3);
  const tenureMonths = Math.floor(rand() * 48) + 1; // 1–48 months
  const totalTransactions = Math.floor(rand() * 100) + 5;

  // Adjust per category to create meaningful scoring variance.
  switch (category) {
    case 'broken_promise_to_pay':
      onTimeBase = 0.2 + rand() * 0.3;        // 0.20–0.50 (low reliability)
      brokenPromiseBase = 2 + Math.floor(rand() * 5); // 2–6
      break;
    case 'customer_cancellation':
      onTimeBase = 0.3 + rand() * 0.35;       // mixed
      brokenPromiseBase = Math.floor(rand() * 4);
      break;
    case 'permanent_account_closure':
      onTimeBase = 0.4 + rand() * 0.3;
      break;
    case 'bank_downtime':
    case 'gateway_degradation':
      // Infrastructure failures — customer is usually reliable.
      onTimeBase = 0.7 + rand() * 0.25;       // 0.70–0.95
      brokenPromiseBase = Math.floor(rand() * 2);
      break;
    case 'insufficient_funds':
      onTimeBase = 0.4 + rand() * 0.35;
      brokenPromiseBase = Math.floor(rand() * 3);
      break;
    default:
      // auth_failure, expired_card, invalid_mandate, duplicate_attempt
      // — keep the base profile as-is.
      break;
  }

  // Clamp on-time rate.
  const onTimePaymentRate = Math.round(Math.min(1, Math.max(0, onTimeBase)) * 100) / 100;

  // Recovery history — derived from total transactions.
  const pastRecoverySuccesses = Math.floor(rand() * Math.ceil(totalTransactions * 0.2));
  const pastRecoveryFailures = Math.floor(rand() * Math.ceil(totalTransactions * 0.1));

  return {
    on_time_payment_rate: onTimePaymentRate,
    broken_promise_count: brokenPromiseBase,
    tenure_months: tenureMonths,
    total_transactions: totalTransactions,
    past_recovery_successes: pastRecoverySuccesses,
    past_recovery_failures: pastRecoveryFailures,
  };
}

// ─── Utilities ──────────────────────────────────────────────────────

function fisherYatesShuffle<T>(arr: T[], rand: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
