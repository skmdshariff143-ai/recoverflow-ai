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
 * 4. Simulator statuses are transaction-bound rather than hard-coded.
 */

import { z } from 'zod';

// ─── Zod Schemas for Validation ──────────────────────────────────────

export const AdapterTypeSchema = z.enum(['simulator', 'razorpay_test_mode']);
export type AdapterType = z.infer<typeof AdapterTypeSchema>;

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
  paymentLinkUrl: z.string().optional(),
  rawResponseSummary: z.string(),
  errorMessage: z.string().optional(),
});

export type RecoveryExecutionResult = z.infer<typeof RecoveryExecutionResultSchema>;

export interface StatusQueryResult {
  status: LinkStatus;
  settledAmountPaise: number;
  razorpayStatusRaw?: string;
  source: 'simulator_memory' | 'razorpay_test_api';
  timestamp: string;
}

export interface RecoveryExecutionAdapter {
  readonly adapterName: 'deterministic_simulator' | 'razorpay_test_mode';
  execute(request: RecoveryExecutionRequest): Promise<RecoveryExecutionResult>;
  getStatus(transactionReference: string): Promise<StatusQueryResult>;
}

// ─── 1. Deterministic Simulator Adapter (Offline / Reproducible) ──────

export class DeterministicSimulatorAdapter implements RecoveryExecutionAdapter {
  readonly adapterName = 'deterministic_simulator' as const;
  private transactionStore = new Map<string, RecoveryExecutionResult>();

  async execute(request: RecoveryExecutionRequest): Promise<RecoveryExecutionResult> {
    const validated = RecoveryExecutionRequestSchema.parse(request);

    const startTime = Date.now();
    const isSuccess = validated.intervention !== 'reminder'; // Direct simulated recovery

    const ref = `sim_txn_${validated.paymentId}_c${validated.attemptCycle}`;
    const result: RecoveryExecutionResult = {
      success: isSuccess,
      transactionReference: ref,
      adapterUsed: this.adapterName,
      settledAmountPaise: isSuccess ? validated.amountPaise : 0,
      status: isSuccess ? 'captured' : 'test_link_created',
      latencyMs: Math.max(15, Date.now() - startTime),
      timestamp: new Date().toISOString(),
      // Invariant: Zero fake external URLs. Use internal simulation identifier.
      paymentLinkUrl: undefined,
      rawResponseSummary: `Deterministic simulated execution for ${validated.intervention} (cycle ${validated.attemptCycle}). Settlement: ${isSuccess ? 'CAPTURED' : 'PENDING'}.`,
    };

    this.transactionStore.set(ref, result);
    return result;
  }

  async getStatus(transactionReference: string): Promise<StatusQueryResult> {
    const existing = this.transactionStore.get(transactionReference);
    if (!existing) {
      return {
        status: 'failed',
        settledAmountPaise: 0,
        source: 'simulator_memory',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      status: existing.status,
      settledAmountPaise: existing.settledAmountPaise,
      source: 'simulator_memory',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * For testing: seed a simulated transaction
   */
  seedTransaction(ref: string, result: RecoveryExecutionResult): void {
    this.transactionStore.set(ref, result);
  }
}

// Global shared simulator instance for server memory persistence across requests
export const globalSimulatorAdapter = new DeterministicSimulatorAdapter();

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
      return {
        success: false,
        transactionReference: `rzp_unconfigured_${validated.paymentId}`,
        adapterUsed: this.adapterName,
        settledAmountPaise: 0,
        status: 'failed',
        latencyMs: 5,
        timestamp: new Date().toISOString(),
        rawResponseSummary:
          'Razorpay Test-Mode credentials not configured in environment (RAZORPAY_KEY_ID must start with rzp_test_).',
        errorMessage: 'RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET missing',
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
        // Redact any sensitive information from error body
        const safeSummary = `Razorpay API HTTP ${res.status}: ${errorBody.slice(0, 100).replace(/[<>{}\\]/g, '')}`;
        return {
          success: false,
          transactionReference: `rzp_err_${validated.paymentId}`,
          adapterUsed: this.adapterName,
          settledAmountPaise: 0,
          status: 'failed',
          latencyMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          rawResponseSummary: safeSummary,
          errorMessage: `Payment link creation returned HTTP ${res.status}`,
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
        paymentLinkUrl: data.short_url,
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
        rawResponseSummary: `Network exception during Razorpay test call: ${errorMsg.slice(0, 100)}`,
        errorMessage: errorMsg,
      };
    }
  }

  async getStatus(transactionReference: string): Promise<StatusQueryResult> {
    if (!this.isConfigured()) {
      return {
        status: 'failed',
        settledAmountPaise: 0,
        source: 'razorpay_test_api',
        timestamp: new Date().toISOString(),
      };
    }

    const authHeader = `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`https://api.razorpay.com/v1/payment_links/${encodeURIComponent(transactionReference)}`, {
        method: 'GET',
        headers: {
          Authorization: authHeader,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        return {
          status: 'failed',
          settledAmountPaise: 0,
          razorpayStatusRaw: `HTTP_${res.status}`,
          source: 'razorpay_test_api',
          timestamp: new Date().toISOString(),
        };
      }

      const data = await res.json();
      const rawStatus: string = data.status ?? 'created';

      let mappedStatus: LinkStatus = 'test_link_created';
      let settledAmountPaise = 0;

      if (rawStatus === 'paid') {
        mappedStatus = 'paid';
        settledAmountPaise = data.amount_paid ?? data.amount ?? 0;
      } else if (rawStatus === 'partially_paid') {
        mappedStatus = 'awaiting_payment';
        settledAmountPaise = data.amount_paid ?? 0;
      } else if (rawStatus === 'created') {
        mappedStatus = 'test_link_created';
        settledAmountPaise = 0;
      } else if (rawStatus === 'cancelled') {
        mappedStatus = 'cancelled';
        settledAmountPaise = 0;
      } else if (rawStatus === 'expired') {
        mappedStatus = 'expired';
        settledAmountPaise = 0;
      } else {
        mappedStatus = 'failed';
        settledAmountPaise = 0;
      }

      return {
        status: mappedStatus,
        settledAmountPaise,
        razorpayStatusRaw: rawStatus,
        source: 'razorpay_test_api',
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        status: 'failed',
        settledAmountPaise: 0,
        razorpayStatusRaw: 'NETWORK_ERROR',
        source: 'razorpay_test_api',
        timestamp: new Date().toISOString(),
      };
    }
  }
}

/**
 * Factory to return the active execution adapter.
 */
export function getExecutionAdapter(requested?: string): RecoveryExecutionAdapter {
  if (requested === 'razorpay_test_mode') {
    const key = process.env.RAZORPAY_KEY_ID;
    const secret = process.env.RAZORPAY_KEY_SECRET;
    return new RazorpayTestModeAdapter(key, secret);
  }
  return globalSimulatorAdapter;
}
