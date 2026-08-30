/**
 * RecoverFlow AI — Core domain types.
 *
 * Framework-agnostic. Used across engine, hooks, and UI layers.
 */

// ─── Failure Categories ──────────────────────────────────────────────

export const FAILURE_CATEGORIES = [
  'insufficient_funds',
  'bank_downtime',
  'auth_failure',
  'expired_card',
  'invalid_mandate',
  'duplicate_attempt',
  'customer_cancellation',
  'gateway_degradation',
  'permanent_account_closure',
  'broken_promise_to_pay',
] as const;

export type FailureCategory = (typeof FAILURE_CATEGORIES)[number];

// ─── Enums & Constants ───────────────────────────────────────────────

export const INVOICE_VALUE_TIERS = ['standard', 'high_value'] as const;
export type InvoiceValueTier = (typeof INVOICE_VALUE_TIERS)[number];

export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'] as const;
export type Currency = (typeof CURRENCIES)[number];

// ─── Quiet-Hours Window ──────────────────────────────────────────────

/** Customer's preferred no-contact window. */
export interface QuietHoursWindow {
  /** Start hour in 24h format (0–23). */
  start: number;
  /** End hour in 24h format (0–23). */
  end: number;
  /** IANA timezone string, e.g. "Asia/Kolkata". */
  timezone: string;
}

// ─── Customer Payment History ────────────────────────────────────────

/**
 * Synthetic summary of a customer's past payment behaviour.
 * This is the key feature set consumed by the scoring model.
 */
export interface CustomerPaymentHistory {
  /** Fraction of past payments completed on time (0.0–1.0). */
  on_time_payment_rate: number;
  /** Count of past broken promise-to-pay events. */
  broken_promise_count: number;
  /** Customer tenure in months. */
  tenure_months: number;
  /** Total number of past transactions (successful + failed). */
  total_transactions: number;
  /** Number of past successful recoveries. */
  past_recovery_successes: number;
  /** Number of past failed recovery attempts. */
  past_recovery_failures: number;
}

// ─── Failed Payment Record ──────────────────────────────────────────

/**
 * A single failed-payment record — the primary input to the
 * scoring and recovery pipeline.
 */
export interface FailedPayment {
  /** Unique payment identifier, e.g. "pay_00001". */
  payment_id: string;
  /** Customer identifier, e.g. "cust_0042". */
  customer_id: string;
  /** Payment amount in minor units (paise/cents). */
  amount: number;
  /** Three-letter currency code. */
  currency: Currency;
  /** Canonical failure category. */
  failure_category: FailureCategory;
  /** ISO-8601 timestamp of the failure event. */
  failure_timestamp: string;
  /** Number of prior recovery attempts for this payment. */
  attempt_count: number;
  /** Whether the customer has opted out of recovery contacts. */
  opt_out: boolean;
  /** Customer's preferred quiet-hours window. */
  quiet_hours_window: QuietHoursWindow;
  /** Invoice value classification. */
  invoice_value_tier: InvoiceValueTier;
  /** Raw error string from the payment gateway. */
  raw_gateway_error: string;
  /** Synthetic customer payment behaviour history. */
  customer_payment_history: CustomerPaymentHistory;
}
