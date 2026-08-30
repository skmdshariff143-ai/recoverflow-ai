/**
 * RecoverFlow AI — Execution Adapter Boundary.
 *
 * Defines the contract for recovery workflow execution adapters, supporting both
 * an offline Deterministic Simulator and an official Razorpay Test-Mode API integration.
 */

import { z } from 'zod';

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

export const RecoveryExecutionResultSchema = z.object({
  success: z.boolean(),
  transactionReference: z.string(),
  adapterUsed: z.enum(['deterministic_simulator', 'razorpay_test_mode']),
  settledAmountPaise: z.number().int().nonnegative(),
  status: z.enum(['captured', 'payment_link_issued', 'failed', 'timeout', 'rate_limited']),
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
  getStatus(transactionReference: string): Promise<{ status: string; settledAmountPaise: number }>;
}

// ─── 1. Deterministic Simulator Adapter (Offline / Reproducible) ──────

export class DeterministicSimulatorAdapter implements RecoveryExecutionAdapter {
  readonly adapterName = 'deterministic_simulator' as const;

  async execute(request: RecoveryExecutionRequest): Promise<RecoveryExecutionResult> {
    const validated = RecoveryExecutionRequestSchema.parse(request);

    const startTime = Date.now();
    const isSuccess = validated.intervention !== 'reminder'; // Simulate direct clearance

    return {
      success: isSuccess,
      transactionReference: `sim_txn_${validated.paymentId}_${validated.attemptCycle}`,
      adapterUsed: this.adapterName,
      settledAmountPaise: isSuccess ? validated.amountPaise : 0,
      status: isSuccess ? 'captured' : 'payment_link_issued',
      latencyMs: Math.max(15, Date.now() - startTime),
      timestamp: new Date().toISOString(),
      paymentLinkUrl: `https://rzp.io/i/sim_${validated.paymentId}`,
      rawResponseSummary: `Deterministic simulated execution for ${validated.intervention} (cycle ${validated.attemptCycle}).`,
    };
  }

  async getStatus(_transactionReference: string): Promise<{ status: string; settledAmountPaise: number }> {
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
    this.keyId = keyId ?? process.env.RAZORPAY_KEY_ID ?? '';
    this.keySecret = keySecret ?? process.env.RAZORPAY_KEY_SECRET ?? '';
  }

  isConfigured(): boolean {
    return this.keyId.length > 0 && this.keySecret.length > 0;
  }

  async execute(request: RecoveryExecutionRequest): Promise<RecoveryExecutionResult> {
    const validated = RecoveryExecutionRequestSchema.parse(request);

    if (!this.isConfigured()) {
      // Graceful fallback to simulator if credentials are not configured in environment
      return {
        success: false,
        transactionReference: `rzp_unconfigured_${validated.paymentId}`,
        adapterUsed: this.adapterName,
        settledAmountPaise: 0,
        status: 'failed',
        latencyMs: 5,
        timestamp: new Date().toISOString(),
        rawResponseSummary: 'Razorpay Test-Mode credentials not provided in .env.local — running in graceful fallback mode.',
        errorMessage: 'RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET missing',
      };
    }

    const startTime = Date.now();

    // Create a Razorpay Standard Payment Link in Test Mode
    // API: POST https://api.razorpay.com/v1/payment_links
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
        settledAmountPaise: 0, // Payment link created, awaiting customer settlement
        status: 'payment_link_issued',
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

  async getStatus(_transactionReference: string): Promise<{ status: string; settledAmountPaise: number }> {
    return {
      status: _transactionReference ? 'payment_link_issued' : 'failed',
      settledAmountPaise: 0,
    };
  }
}

/**
 * Factory to return the active execution adapter.
 */
export function getExecutionAdapter(): RecoveryExecutionAdapter {
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    return new RazorpayTestModeAdapter();
  }
  return new DeterministicSimulatorAdapter();
}
