/**
 * RecoverFlow AI — Deterministic Judge Safety & Escalation Fixture.
 *
 * Distinct from the canonical 100-record batch and benchmark datasets.
 * Labeled: HAND-CURATED SAFETY FIXTURE.
 *
 * Specifically exercises and demonstrates every safety invariant:
 * 1. High-value human-in-the-loop approval gate (> ₹10,000 / 1,000,000 Paise)
 * 2. Customer opt-out hard stop (opt_out = true)
 * 3. Maximum retry attempts exhausted (prior_attempts = 3)
 * 4. Permanent failure escalation (permanent_account_closure)
 * 5. Provider timeout / transient degradation (gateway_degradation)
 * 6. Successful synthetic recovery with verified settlement
 * 7. Duplicate observation rejection (duplicate prevention)
 */

import type { FailedPayment } from '@/types';

export const JUDGE_SAFETY_SCENARIO_PAYMENTS: FailedPayment[] = [
  // 1. High-Value Enterprise Invoice (> ₹10,000) -> Requires Human Approval Gate
  {
    payment_id: 'pay_judge_hv_001',
    customer_id: 'cust_ent_acme_corp',
    amount: 3_500_000, // ₹35,000.00 (3,500,000 Paise)
    currency: 'INR',
    failure_category: 'bank_downtime',
    failure_timestamp: '2025-08-29T10:15:00.000Z',
    attempt_count: 1,
    opt_out: false,
    quiet_hours_window: { start: 21, end: 9, timezone: 'Asia/Kolkata' },
    invoice_value_tier: 'high_value',
    raw_gateway_error: 'HDFC_CORE_SETTLEMENT_SYSTEM_BUSY_503',
    customer_payment_history: {
      on_time_payment_rate: 0.96,
      broken_promise_count: 0,
      tenure_months: 24,
      total_transactions: 48,
      past_recovery_successes: 46,
      past_recovery_failures: 2,
    },
  },

  // 2. Customer Opt-Out Hard Stop -> Stopped Immediately by Safety Filter
  {
    payment_id: 'pay_judge_optout_002',
    customer_id: 'cust_retail_opted_out',
    amount: 450_000, // ₹4,500.00
    currency: 'INR',
    failure_category: 'customer_cancellation',
    failure_timestamp: '2025-08-29T10:18:00.000Z',
    attempt_count: 1,
    opt_out: true, // HARD STOP INVARIANT
    quiet_hours_window: { start: 21, end: 9, timezone: 'Asia/Kolkata' },
    invoice_value_tier: 'standard',
    raw_gateway_error: 'CUSTOMER_EXPLICIT_OPT_OUT_REVOCATION',
    customer_payment_history: {
      on_time_payment_rate: 0.83,
      broken_promise_count: 0,
      tenure_months: 8,
      total_transactions: 12,
      past_recovery_successes: 10,
      past_recovery_failures: 2,
    },
  },

  // 3. Max Attempts Exhausted -> Stopped Immediately (Attempt Limit = 3)
  {
    payment_id: 'pay_judge_maxattempt_003',
    customer_id: 'cust_sme_overlimit',
    amount: 820_000, // ₹8,200.00
    currency: 'INR',
    failure_category: 'insufficient_funds',
    failure_timestamp: '2025-08-29T10:20:00.000Z',
    attempt_count: 3, // HARD STOP INVARIANT: Already at attempt limit
    opt_out: false,
    quiet_hours_window: { start: 21, end: 9, timezone: 'Asia/Kolkata' },
    invoice_value_tier: 'standard',
    raw_gateway_error: 'DEBIT_FAILURE_NSF_RETRY_EXHAUSTED',
    customer_payment_history: {
      on_time_payment_rate: 0.50,
      broken_promise_count: 1,
      tenure_months: 4,
      total_transactions: 6,
      past_recovery_successes: 3,
      past_recovery_failures: 3,
    },
  },

  // 4. Permanent Account Closure -> Stopped & Escalated for Collections Review
  {
    payment_id: 'pay_judge_closed_004',
    customer_id: 'cust_defunct_corp',
    amount: 1_200_000, // ₹12,000.00
    currency: 'INR',
    failure_category: 'permanent_account_closure',
    failure_timestamp: '2025-08-29T10:22:00.000Z',
    attempt_count: 1,
    opt_out: false,
    quiet_hours_window: { start: 21, end: 9, timezone: 'Asia/Kolkata' },
    invoice_value_tier: 'high_value',
    raw_gateway_error: 'BENEFICIARY_BANK_ACCOUNT_FROZEN_OR_CLOSED',
    customer_payment_history: {
      on_time_payment_rate: 0.90,
      broken_promise_count: 0,
      tenure_months: 18,
      total_transactions: 20,
      past_recovery_successes: 18,
      past_recovery_failures: 2,
    },
  },

  // 5. Transient Gateway Timeout -> Scheduled for Intelligent Backoff Retry
  {
    payment_id: 'pay_judge_timeout_005',
    customer_id: 'cust_growth_saas',
    amount: 650_000, // ₹6,500.00
    currency: 'INR',
    failure_category: 'gateway_degradation',
    failure_timestamp: '2025-08-29T10:25:00.000Z',
    attempt_count: 1,
    opt_out: false,
    quiet_hours_window: { start: 21, end: 9, timezone: 'Asia/Kolkata' },
    invoice_value_tier: 'standard',
    raw_gateway_error: 'GATEWAY_RESPONSE_LATENCY_EXCEEDED_504_TIMEOUT',
    customer_payment_history: {
      on_time_payment_rate: 0.96,
      broken_promise_count: 0,
      tenure_months: 15,
      total_transactions: 30,
      past_recovery_successes: 29,
      past_recovery_failures: 1,
    },
  },

  // 6. High-Probability Recoverable Failure -> Synthetic Clearance Verified
  {
    payment_id: 'pay_judge_recov_006',
    customer_id: 'cust_prime_loyalty',
    amount: 780_000, // ₹7,800.00
    currency: 'INR',
    failure_category: 'bank_downtime',
    failure_timestamp: '2025-08-29T10:30:00.000Z',
    attempt_count: 1,
    opt_out: false,
    quiet_hours_window: { start: 21, end: 9, timezone: 'Asia/Kolkata' },
    invoice_value_tier: 'standard',
    raw_gateway_error: 'SWITCH_TEMPORARILY_UNAVAILABLE_SCHEDULED_WINDOW',
    customer_payment_history: {
      on_time_payment_rate: 0.98,
      broken_promise_count: 0,
      tenure_months: 36,
      total_transactions: 52,
      past_recovery_successes: 51,
      past_recovery_failures: 1,
    },
  },
];
