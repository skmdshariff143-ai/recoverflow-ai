/**
 * RecoverFlow AI — Zod Schemas for Runtime & Artifact Validation.
 */

import { z } from 'zod';
import { FAILURE_CATEGORIES, CURRENCIES, INVOICE_VALUE_TIERS } from './payment';

export const QuietHoursWindowSchema = z.object({
  start: z.number().int().min(0).max(23),
  end: z.number().int().min(0).max(23),
  timezone: z.string().min(1),
});

export const CustomerPaymentHistorySchema = z.object({
  on_time_payment_rate: z.number().min(0).max(1),
  broken_promise_count: z.number().int().min(0),
  tenure_months: z.number().int().min(1),
  total_transactions: z.number().int().min(0),
  past_recovery_successes: z.number().int().min(0),
  past_recovery_failures: z.number().int().min(0),
});

export const FailedPaymentSchema = z.object({
  payment_id: z.string().regex(/^pay_\d+$/),
  customer_id: z.string().regex(/^cust_\d+$/),
  amount: z.number().int().positive(),
  currency: z.enum(CURRENCIES),
  failure_category: z.enum(FAILURE_CATEGORIES),
  failure_timestamp: z.string().datetime(),
  attempt_count: z.number().int().min(0).max(3),
  opt_out: z.boolean(),
  quiet_hours_window: QuietHoursWindowSchema,
  invoice_value_tier: z.enum(INVOICE_VALUE_TIERS),
  raw_gateway_error: z.string().min(1),
  customer_payment_history: CustomerPaymentHistorySchema,
});

export const PotentialOutcomeAttemptSchema = z.object({
  recovered: z.boolean(),
  settledAmountPaise: z.number().int().min(0),
  disputed: z.boolean(),
  latencyMinutes: z.number().int().min(0),
  reason: z.string().min(1),
});

export const FrozenPotentialOutcomesSchema = z.object({
  payment_id: z.string().regex(/^pay_\d+$/),
  outcomes: z.object({
    retry: z.record(z.string(), PotentialOutcomeAttemptSchema),
    reminder: z.record(z.string(), PotentialOutcomeAttemptSchema),
    both: z.record(z.string(), PotentialOutcomeAttemptSchema),
    none: z.record(z.string(), PotentialOutcomeAttemptSchema),
  }),
});

export const ModelWeightsSchema = z.object({
  modelVersion: z.string().min(1),
  trainingDate: z.string().datetime(),
  algorithm: z.string().min(1),
  features: z.array(z.string()),
  weights: z.record(z.string(), z.number()),
  bias: z.number(),
  trainingMetrics: z.object({
    samplesCount: z.number().int().positive(),
    brierScore: z.number().min(0).max(1),
    logLoss: z.number().min(0),
    calibrationError: z.number().min(0).max(1),
    iterations: z.number().int().positive(),
  }),
});
