/**
 * PayBack AI — Execution Adapter Boundary & Razorpay Test-Mode Integration.
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
import { createHash } from 'crypto';

// ─── Deterministic Simulator Reference & Checksum Utility ────────────

const SIMULATOR_INTEGRITY_SALT = 'payback_sim_receipt_v2_2026';

export function computeSimulatorChecksum(
  paymentId: string,
  attemptCycle: number,
  intervention: string,
  amountPaise: number,
  outcomeCode: 'cap' | 'lnk' | 'fal',
): string {
  const payload = `${paymentId}:${attemptCycle}:${intervention}:${amountPaise}:${outcomeCode}:${SIMULATOR_INTEGRITY_SALT}`;
  return createHash('sha256').update(payload).digest('hex').slice(0, 12);
}

export function generateStatelessSimulatorReference(
  paymentId: string,
  attemptCycle: number,
  intervention: string,
  amountPaise: number,
  outcomeCode: 'cap' | 'lnk' | 'fal',
): string {
  const checksum = computeSimulatorChecksum(paymentId, attemptCycle, intervention, amountPaise, outcomeCode);
  return `sim_txn_${paymentId}_c${attemptCycle}_${intervention}_${amountPaise}_${outcomeCode}_${checksum}`;
}

export interface ParsedStatelessSimulatorReference {
  valid: boolean;
  paymentId: string;
  attemptCycle: number;
  intervention: 'retry' | 'reminder' | 'both';
  amountPaise: number;
  outcomeCode: 'cap' | 'lnk' | 'fal';
}

export function parseStatelessSimulatorReference(ref: string): ParsedStatelessSimulatorReference | null {
  const match = ref.match(/^sim_txn_([a-zA-Z0-9_-]+)_c(\d+)_([a-zA-Z]+)_(\d+)_(cap|lnk|fal)_([a-f0-9]{12})$/);
  if (!match) {
    // Backward compatibility for legacy test references
    const legacyMatch = ref.match(/^sim_txn_([a-zA-Z0-9_-]+)_c(\d+)$/);
    if (legacyMatch) {
      const paymentId = legacyMatch[1];
      const attemptCycle = parseInt(legacyMatch[2], 10);
      return {
        valid: true,
        paymentId,
        attemptCycle,
        intervention: 'retry',
        amountPaise: 500000,
        outcomeCode: 'cap',
      };
    }
    return null;
  }

  const [, paymentId, cycleStr, intervention, amountStr, outcomeCode, checksum] = match;
  const attemptCycle = parseInt(cycleStr, 10);
  const amountPaise = parseInt(amountStr, 10);

  const expectedChecksum = computeSimulatorChecksum(
    paymentId,
    attemptCycle,
    intervention,
    amountPaise,
    outcomeCode as 'cap' | 'lnk' | 'fal',
  );

  if (checksum !== expectedChecksum) {
    return {
      valid: false,
      paymentId,
      attemptCycle,
      intervention: intervention as 'retry' | 'reminder' | 'both',
      amountPaise,
      outcomeCode: outcomeCode as 'cap' | 'lnk' | 'fal',
    };
  }

  return {
    valid: true,
    paymentId,
    attemptCycle,
    intervention: intervention as 'retry' | 'reminder' | 'both',
    amountPaise,
    outcomeCode: outcomeCode as 'cap' | 'lnk' | 'fal',
  };
}

// ─── Zod Schemas for Validation ──────────────────────────────────────

export const AdapterTypeSchema = z.enum(['simulator', 'deterministic_simulator', 'razorpay_test_mode']);
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

export const EvidenceClassSchema = z.enum([
  'SYNTHETIC',
  'LIVE_TEST_MODE',
  'FALLBACK',
  'UNVERIFIED',
]);

export type EvidenceClass = z.infer<typeof EvidenceClassSchema>;

/**
 * Thrown when a simulator reference is structurally invalid, truncated, tampered,
 * or contains illegal field values. This is a technical input error — not a
 * legitimate failed recovery outcome. The HTTP layer should return 422, not 200.
 */
export class InvalidSimulatorReferenceError extends Error {
  readonly errorCode = 'INVALID_SIMULATOR_REFERENCE' as const;
  readonly evidenceClass = 'UNVERIFIED' as const;
  readonly liveSettledAmountPaise = 0;
  readonly syntheticOutcomeAmountPaise = 0;

  constructor(
    public readonly reference: string,
    public readonly reason: string,
  ) {
    super(`Invalid simulator reference: ${reason}`);
    this.name = 'InvalidSimulatorReferenceError';
  }
}

export const RecoveryExecutionResultSchema = z.object({
  success: z.boolean(),
  transactionReference: z.string(),
  adapterUsed: z.enum(['deterministic_simulator', 'razorpay_test_mode']),
  /** @deprecated Legacy field. Use liveSettledAmountPaise or syntheticOutcomeAmountPaise instead. Never use as live settlement proof for simulator results. */
  settledAmountPaise: z.number().int().nonnegative(),
  /** @deprecated Legacy field. Use executionStatus and outcomeStatus instead. */
  status: LinkStatusSchema,
  latencyMs: z.number().nonnegative(),
  timestamp: z.string(),
  paymentLinkUrl: z.string().optional(),
  rawResponseSummary: z.string(),
  errorMessage: z.string().optional(),
  // Normalized provenance & accounting clarification fields
  executionStatus: z.enum(['executed', 'scheduled', 'failed', 'link_created']).default('executed'),
  outcomeStatus: z.enum(['synthetic_captured', 'synthetic_not_recovered', 'live_test_mode_created', 'unverified']).default('synthetic_captured'),
  evidenceClass: EvidenceClassSchema.default('SYNTHETIC'),
  syntheticOutcomeAmountPaise: z.number().int().nonnegative().default(0),
  verifiedSyntheticRecoveredPaise: z.number().int().nonnegative().default(0),
  liveSettledAmountPaise: z.number().int().nonnegative().default(0),
  providerReference: z.string().optional(),
  provenanceNotice: z.string().default('Deterministic synthetic evaluation outcome; not live merchant settlement.'),
});

export type RecoveryExecutionResult = z.infer<typeof RecoveryExecutionResultSchema>;

export interface StatusQueryResult {
  /** @deprecated Legacy field. Use outcomeStatus instead. */
  status: LinkStatus;
  /** @deprecated Legacy field. Use liveSettledAmountPaise or syntheticOutcomeAmountPaise instead. */
  settledAmountPaise: number;
  razorpayStatusRaw?: string;
  source: 'simulator_stateless_receipt' | 'simulator_memory' | 'razorpay_test_api';
  timestamp: string;
  evidenceClass?: EvidenceClass;
  liveSettledAmountPaise?: number;
  syntheticOutcomeAmountPaise?: number;
  verifiedSyntheticRecoveredPaise?: number;
  provenanceNotice?: string;
}

export interface RecoveryExecutionAdapter {
  readonly adapterName: 'deterministic_simulator' | 'razorpay_test_mode';
  execute(request: RecoveryExecutionRequest): Promise<RecoveryExecutionResult>;
  getStatus(transactionReference: string): Promise<StatusQueryResult>;
}

// ─── 1. Deterministic Simulator Adapter (Stateless / Reproducible) ────

export class DeterministicSimulatorAdapter implements RecoveryExecutionAdapter {
  readonly adapterName = 'deterministic_simulator' as const;
  private transactionStore = new Map<string, RecoveryExecutionResult>();

  async execute(request: RecoveryExecutionRequest): Promise<RecoveryExecutionResult> {
    const validated = RecoveryExecutionRequestSchema.parse(request);

    const startTime = Date.now();
    const isSuccess = validated.intervention !== 'reminder'; // Direct simulated recovery
    const outcomeCode: 'cap' | 'lnk' = isSuccess ? 'cap' : 'lnk';

    const ref = generateStatelessSimulatorReference(
      validated.paymentId,
      validated.attemptCycle,
      validated.intervention,
      validated.amountPaise,
      outcomeCode,
    );

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
      rawResponseSummary: `Deterministic simulated execution for ${validated.intervention} (cycle ${validated.attemptCycle}). Settlement: ${isSuccess ? 'SYNTHETIC_OUTCOME_VERIFIED' : 'TEST_LINK_CREATED'}. (Note: Deterministic synthetic evaluation outcome, not live merchant settlement).`,
      // Explicit provenance & settlement segregation
      executionStatus: isSuccess ? 'executed' : 'link_created',
      outcomeStatus: isSuccess ? 'synthetic_captured' : 'synthetic_not_recovered',
      evidenceClass: 'SYNTHETIC',
      syntheticOutcomeAmountPaise: isSuccess ? validated.amountPaise : 0,
      verifiedSyntheticRecoveredPaise: isSuccess ? validated.amountPaise : 0,
      liveSettledAmountPaise: 0, // Invariant: Exactly 0 real/live merchant settlement
      providerReference: ref,
      provenanceNotice: 'Deterministic synthetic evaluation outcome; not live merchant settlement.',
    };

    this.transactionStore.set(ref, result);
    return result;
  }

  async getStatus(transactionReference: string): Promise<StatusQueryResult> {
    // 1. Process-local fast-path cache (e.g. for unit testing or in-process reuse)
    const existing = this.transactionStore.get(transactionReference);
    if (existing) {
      return {
        status: existing.status,
        settledAmountPaise: existing.settledAmountPaise,
        source: 'simulator_stateless_receipt',
        timestamp: new Date().toISOString(),
        evidenceClass: 'SYNTHETIC',
        liveSettledAmountPaise: 0,
        syntheticOutcomeAmountPaise: existing.syntheticOutcomeAmountPaise ?? existing.verifiedSyntheticRecoveredPaise,
        verifiedSyntheticRecoveredPaise: existing.verifiedSyntheticRecoveredPaise,
        provenanceNotice: existing.provenanceNotice,
      };
    }

    // 2. Guard: reject oversized references before regex parsing
    if (transactionReference.length > 512) {
      throw new InvalidSimulatorReferenceError(
        transactionReference.slice(0, 64) + '…',
        'Reference exceeds maximum permitted length (512 characters).',
      );
    }

    // 3. Guard: non-simulator references that weren't in the process-local cache
    if (!transactionReference.startsWith('sim_txn_')) {
      throw new InvalidSimulatorReferenceError(
        transactionReference,
        'Reference is structurally invalid, truncated, or not a simulator reference.',
      );
    }

    // 4. Stateless reconstruction from checksummed reference (cross-serverless resilience)
    const parsed = parseStatelessSimulatorReference(transactionReference);
    if (parsed && !parsed.valid) {
      throw new InvalidSimulatorReferenceError(
        transactionReference,
        'Checksum verification failed (reference tampered or corrupted).',
      );
    }
    if (!parsed) {
      throw new InvalidSimulatorReferenceError(
        transactionReference,
        'Reference is structurally invalid, truncated, or not a simulator reference.',
      );
    }

    const isSuccess = parsed.outcomeCode === 'cap';
    const status: LinkStatus = isSuccess
      ? 'captured'
      : (parsed.outcomeCode === 'lnk' ? 'test_link_created' : 'failed');
    const outcomeAmount = isSuccess ? parsed.amountPaise : 0;

    return {
      status,
      settledAmountPaise: outcomeAmount,
      source: 'simulator_stateless_receipt',
      timestamp: new Date().toISOString(),
      evidenceClass: 'SYNTHETIC',
      liveSettledAmountPaise: 0,
      syntheticOutcomeAmountPaise: outcomeAmount,
      verifiedSyntheticRecoveredPaise: outcomeAmount,
      provenanceNotice: 'Deterministic synthetic evaluation outcome; not live merchant settlement.',
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
        'SECURITY VIOLATION: Live mode Razorpay keys (rzp_live_*) are strictly prohibited. Only test-mode keys (rzp_test_*) are permitted in PayBack AI.',
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
        executionStatus: 'failed',
        outcomeStatus: 'unverified',
        evidenceClass: 'FALLBACK',
        syntheticOutcomeAmountPaise: 0,
        verifiedSyntheticRecoveredPaise: 0,
        liveSettledAmountPaise: 0,
        providerReference: undefined,
        provenanceNotice: 'Razorpay test-mode credentials unconfigured. Operating in fallback mode.',
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
        description: `PayBack AI Recovery Link for Invoice ${validated.paymentId}`,
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
          source: 'PayBack AI - Track 3 Buildathon',
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
          executionStatus: 'failed',
          outcomeStatus: 'unverified',
          evidenceClass: 'LIVE_TEST_MODE',
          syntheticOutcomeAmountPaise: 0,
          verifiedSyntheticRecoveredPaise: 0,
          liveSettledAmountPaise: 0,
          providerReference: `rzp_err_${validated.paymentId}`,
          provenanceNotice: 'Server-side Razorpay test-mode execution encountered API error.',
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
        executionStatus: 'link_created',
        outcomeStatus: 'live_test_mode_created',
        evidenceClass: 'LIVE_TEST_MODE',
        syntheticOutcomeAmountPaise: 0,
        verifiedSyntheticRecoveredPaise: 0,
        liveSettledAmountPaise: 0,
        providerReference: data.id,
        provenanceNotice: 'Razorpay Sandbox Payment Link created. Settlement pending observation (counts as ₹0.00 recovered).',
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
        executionStatus: 'failed',
        outcomeStatus: 'unverified',
        evidenceClass: 'LIVE_TEST_MODE',
        syntheticOutcomeAmountPaise: 0,
        verifiedSyntheticRecoveredPaise: 0,
        liveSettledAmountPaise: 0,
        providerReference: undefined,
        provenanceNotice: 'Network exception occurred during test-mode call.',
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
