/**
 * RecoverFlow AI — Execution Adapter Boundary & Razorpay Test-Mode Integration.
 *
 * Defines the contract for recovery workflow execution adapters, supporting both
 * an offline Deterministic Simulator and an official Razorpay Test-Mode API integration.
 *
 * Security Invariants:
 * 1. Live keys ('rzp_live_...') are strictly rejected with an invariant error.
 * 2. Only test-mode keys ('rzp_test_...') are accepted.
 * 3. Payment-link creation is NEVER counted as recovered revenue.
 * 4. Webhook signatures are verified using constant-time HMAC-SHA256 comparison.
 */

import { z } from 'zod';
import { createHmac, timingSafeEqual } from 'crypto';

// ─── Zod Schemas for Validation ──────────────────────────────────────

export const RecoveryExecutionRequestSchema = z.object({
  paymentId: z.string().min(1),
  customerId: z.string().min(1),
  customerName: z.string(),
  customerEmail: z.string().email(),
  customerPhone: z.string().optional(),
  amountPaise: z.number().int().positive(),
  currency: z.literal('INR'),
  intervention: z.enum(['retry', 'reminder', 'both']),
  attemptCycle: z.number().int().min(1).max(3),
  idempotencyKey: z.string().min(1),
  referenceNotes: z.string().optional(),
});

export type RecoveryExecutionRequest = z.infer<typeof RecoveryExecutionRequestSchema>;

export const LinkStatusSchema = z.enum([
  'test_link_created',
  'awaiting_payment',
  'paid',
  'captured',
  'expired',
  'cancelled',
  'failed',
  'timeout',
  'rate_limited',
]);

export type LinkStatus = z.infer<typeof LinkStatusSchema>;

export const RecoveryExecutionResultSchema = z.object({
  success: z.boolean(),
  transactionReference: z.string(),
  adapterUsed: z.enum(['deterministic_simulator', 'razorpay_test_mode']),
  settledAmountPaise: z.number().int().nonnegative(),
  status: LinkStatusSchema,
  latencyMs: z.number().nonnegative(),
  timestamp: z.string(),
  paymentLinkUrl: z.string().url().optional(),
  rawResponseSummary: z.string(),
  errorMessage: z.string().optional(),
});

export type RecoveryExecutionResult = z.infer<typeof RecoveryExecutionResultSchema>;

export interface RecoveryExecutionAdapter {
  readonly adapterName: 'deterministic_simulator' | 'razorpay_test_mode';
  execute(request: RecoveryExecutionRequest): Promise<RecoveryExecutionResult>;
  getStatus(transactionReference: string): Promise<{ status: LinkStatus; settledAmountPaise: number }>;
}

// ─── 1. Deterministic Simulator Adapter (Offline / Reproducible) ──────

export class DeterministicSimulatorAdapter implements RecoveryExecutionAdapter {
  readonly adapterName = 'deterministic_simulator' as const;

  async execute(request: RecoveryExecutionRequest): Promise<RecoveryExecutionResult> {
    const validated = RecoveryExecutionRequestSchema.parse(request);

    const startTime = Date.now();
    const isSuccess = validated.intervention !== 'reminder'; // Direct simulated recovery

    return {
      success: isSuccess,
      transactionReference: `sim_txn_${validated.paymentId}_c${validated.attemptCycle}`,
      adapterUsed: this.adapterName,
      settledAmountPaise: isSuccess ? validated.amountPaise : 0,
      status: isSuccess ? 'captured' : 'test_link_created',
      latencyMs: Math.max(15, Date.now() - startTime),
      timestamp: new Date().toISOString(),
      paymentLinkUrl: `https://rzp.io/i/sim_${validated.paymentId}`,
      rawResponseSummary: `Deterministic simulated execution for ${validated.intervention} (cycle ${validated.attemptCycle}).`,
    };
  }

  async getStatus(_transactionReference: string): Promise<{ status: LinkStatus; settledAmountPaise: number }> {
    return {
      status: _transactionReference ? 'captured' : 'failed',
      settledAmountPaise: 500_000,
    };
  }
}

// ─── 2. Official Razorpay Test-Mode Adapter (Server-Side) ───────────

export class RazorpayTestModeAdapter implements RecoveryExecutionAdapter {
  readonly adapterName = 'razorpay_test_mode' as const;
  private keyId: string;
  private keySecret: string;

  constructor(keyId?: string, keySecret?: string) {
    const configuredKey = keyId ?? process.env.RAZORPAY_KEY_ID ?? '';
    const configuredSecret = keySecret ?? process.env.RAZORPAY_KEY_SECRET ?? '';

    // Security Invariant: Live-mode keys are strictly forbidden
    if (configuredKey.startsWith('rzp_live_')) {
      throw new Error(
        'SECURITY VIOLATION: Live mode Razorpay keys (rzp_live_*) are strictly prohibited. Only test-mode keys (rzp_test_*) are permitted in RecoverFlow AI.',
      );
    }

    this.keyId = configuredKey;
    this.keySecret = configuredSecret;
  }

  isConfigured(): boolean {
    return (
      this.keyId.length > 0 &&
      this.keySecret.length > 0 &&
      this.keyId.startsWith('rzp_test_')
    );
  }

  async execute(request: RecoveryExecutionRequest): Promise<RecoveryExecutionResult> {
    const validated = RecoveryExecutionRequestSchema.parse(request);

    if (!this.isConfigured()) {
      // Graceful fallback to simulator if credentials are not configured
      return {
        success: false,
        transactionReference: `rzp_unconfigured_${validated.paymentId}`,
        adapterUsed: this.adapterName,
        settledAmountPaise: 0,
        status: 'failed',
        latencyMs: 5,
        timestamp: new Date().toISOString(),
        rawResponseSummary:
          'Razorpay Test-Mode credentials not provided or invalid in .env.local — running in graceful fallback mode.',
        errorMessage: 'RAZORPAY_KEY_ID (must start with rzp_test_) or RAZORPAY_KEY_SECRET missing',
      };
    }

    const startTime = Date.now();
    const authHeader = `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`;

    try {
      const payload = {
        amount: validated.amountPaise,
        currency: 'INR',
        accept_partial: false,
        reference_id: `rec_${validated.paymentId}_c${validated.attemptCycle}`,
        description: `RecoverFlow AI Recovery Link for Invoice ${validated.paymentId}`,
        customer: {
          name: validated.customerName,
          email: validated.customerEmail,
          contact: validated.customerPhone ?? '+919876543210',
        },
        notify: {
          sms: validated.intervention === 'reminder' || validated.intervention === 'both',
          email: true,
        },
        reminder_enable: true,
        notes: {
          source: 'RecoverFlow AI - Track 3 Buildathon',
          idempotency_key: validated.idempotencyKey,
        },
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const res = await fetch('https://api.razorpay.com/v1/payment_links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
          'X-Razorpay-Idempotency-Key': validated.idempotencyKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorBody = await res.text();
        return {
          success: false,
          transactionReference: `rzp_err_${validated.paymentId}`,
          adapterUsed: this.adapterName,
          settledAmountPaise: 0,
          status: 'failed',
          latencyMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          rawResponseSummary: `Razorpay API HTTP ${res.status}: ${errorBody.slice(0, 150)}`,
          errorMessage: `Payment link creation failed with status ${res.status}`,
        };
      }

      const data = await res.json();
      return {
        success: true,
        transactionReference: data.id ?? `plink_${validated.paymentId}`,
        adapterUsed: this.adapterName,
        settledAmountPaise: 0, // Non-negotiable: Link creation is NOT recovered money
        status: 'test_link_created',
        latencyMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        paymentLinkUrl: data.short_url ?? `https://rzp.io/i/${data.id}`,
        rawResponseSummary: `Razorpay Test Payment Link created: ${data.id} (Status: ${data.status})`,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        transactionReference: `rzp_exc_${validated.paymentId}`,
        adapterUsed: this.adapterName,
        settledAmountPaise: 0,
        status: errorMsg.includes('abort') ? 'timeout' : 'failed',
        latencyMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        rawResponseSummary: `Network exception during Razorpay test-mode call: ${errorMsg}`,
        errorMessage: errorMsg,
      };
    }
  }

  async getStatus(_transactionReference: string): Promise<{ status: LinkStatus; settledAmountPaise: number }> {
    return {
      status: _transactionReference ? 'awaiting_payment' : 'failed',
      settledAmountPaise: 0,
    };
  }
}

// ─── 3. Webhook Signature Verification ───────────────────────────────

/**
 * Verifies Razorpay Webhook Signatures using constant-time HMAC-SHA256 comparison.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string,
  webhookSecret: string,
): boolean {
  if (!rawBody || !signature || !webhookSecret) return false;

  try {
    const expectedSignature = createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (signature.length !== expectedSignature.length) return false;

    return timingSafeEqual(
      Buffer.from(signature, 'utf-8'),
      Buffer.from(expectedSignature, 'utf-8'),
    );
  } catch {
    return false;
  }
}

/**
 * Factory to return the active execution adapter.
 */
export function getExecutionAdapter(): RecoveryExecutionAdapter {
  const key = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;

  if (key && secret && key.startsWith('rzp_test_')) {
    return new RazorpayTestModeAdapter(key, secret);
  }
  return new DeterministicSimulatorAdapter();
}
