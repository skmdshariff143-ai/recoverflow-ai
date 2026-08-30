/**
 * Unit tests for RecoverFlow AI Execution Adapters & Idempotency Store.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DeterministicSimulatorAdapter,
  RazorpayTestModeAdapter,
  AdapterTypeSchema,
  type RecoveryExecutionRequest,
} from '../recoveryAdapter';
import { idempotencyStore } from '@/lib/server/idempotencyStore';

describe('Recovery Execution Adapters & Idempotency Store', () => {
  beforeEach(() => {
    idempotencyStore.clear();
  });

  const validRequest: RecoveryExecutionRequest = {
    paymentId: 'pay_test_001',
    customerId: 'cust_001',
    customerName: 'Test Merchant',
    customerEmail: 'finance@merchant.com',
    customerPhone: '+919876543210',
    amountPaise: 500_000,
    currency: 'INR',
    intervention: 'retry',
    attemptCycle: 1,
    idempotencyKey: 'idemp_pay_test_001_1',
    referenceNotes: 'Test retry execution',
  };

  describe('Adapter Boundary & Schema Validation', () => {
    it('validates known adapters and rejects unknown adapter identifiers', () => {
      expect(AdapterTypeSchema.safeParse('simulator').success).toBe(true);
      expect(AdapterTypeSchema.safeParse('razorpay_test_mode').success).toBe(true);
      expect(AdapterTypeSchema.safeParse('live_production_gateway').success).toBe(false);
      expect(AdapterTypeSchema.safeParse('stripe_adapter').success).toBe(false);
    });
  });

  describe('DeterministicSimulatorAdapter', () => {
    const adapter = new DeterministicSimulatorAdapter();

    it('executes valid request, records transaction, and does not generate fake external URLs', async () => {
      const result = await adapter.execute(validRequest);

      expect(result.success).toBe(true);
      expect(result.adapterUsed).toBe('deterministic_simulator');
      expect(result.transactionReference).toContain('sim_txn_');
      expect(result.paymentLinkUrl).toBeUndefined(); // Invariant: no fake URLs

      // Explicit Simulator Integrity Invariants:
      expect(result.evidenceClass).toBe('SYNTHETIC');
      expect(result.outcomeStatus).toBe('synthetic_captured');
      expect(result.outcomeStatus).not.toBe('captured'); // Cannot be presented as live captured
      expect(result.liveSettledAmountPaise).toBe(0); // Simulator live settled amount is strictly zero
      expect(result.syntheticOutcomeAmountPaise).toBe(500_000); // Synthetic value separately measurable
      expect(result.verifiedSyntheticRecoveredPaise).toBe(500_000);
      expect(result.provenanceNotice).toBe(
        'Deterministic synthetic evaluation outcome; not live merchant settlement.',
      );
    });

    it('enforces that reminder payment-link creation records zero live settlement and zero synthetic recovered', async () => {
      const reminderReq: RecoveryExecutionRequest = {
        ...validRequest,
        intervention: 'reminder',
        idempotencyKey: 'idemp_rem_test_001',
      };
      const result = await adapter.execute(reminderReq);

      expect(result.status).toBe('test_link_created');
      expect(result.settledAmountPaise).toBe(0);
      expect(result.liveSettledAmountPaise).toBe(0);
      expect(result.syntheticOutcomeAmountPaise).toBe(0);
      expect(result.verifiedSyntheticRecoveredPaise).toBe(0);
      expect(result.evidenceClass).toBe('SYNTHETIC');
    });

    it('getStatus retrieves the exact recorded transaction amount from memory and marks evidence as SYNTHETIC', async () => {
      const result = await adapter.execute(validRequest);
      const query = await adapter.getStatus(result.transactionReference);

      expect(query.status).toBe('captured');
      expect(query.source).toBe('simulator_memory');
      expect(query.evidenceClass).toBe('SYNTHETIC');
      expect(query.liveSettledAmountPaise).toBe(0);
      expect(query.syntheticOutcomeAmountPaise).toBe(500_000);
      expect(query.verifiedSyntheticRecoveredPaise).toBe(500_000);
    });

    it('getStatus returns failed with zero paise for unknown references', async () => {
      const query = await adapter.getStatus('unknown_ref_999');
      expect(query.status).toBe('failed');
      expect(query.settledAmountPaise).toBe(0);
      expect(query.liveSettledAmountPaise).toBe(0);
      expect(query.syntheticOutcomeAmountPaise).toBe(0);
      expect(query.verifiedSyntheticRecoveredPaise).toBe(0);
    });
  });

  describe('RazorpayTestModeAdapter Security & Behavior', () => {
    it('strictly throws security error if live-mode key is provided', () => {
      expect(() => {
        new RazorpayTestModeAdapter('rzp_live_secretkey123', 'somesecret');
      }).toThrow(/Live mode Razorpay keys/);
    });

    it('accepts valid test-mode key and reports configured status', () => {
      const adapter = new RazorpayTestModeAdapter('rzp_test_validkey123', 'somesecret');
      expect(adapter.isConfigured()).toBe(true);
      expect(adapter.adapterName).toBe('razorpay_test_mode');
    });

    it('gracefully falls back when unconfigured without throwing unhandled exceptions', async () => {
      const adapter = new RazorpayTestModeAdapter('', '');
      expect(adapter.isConfigured()).toBe(false);

      const result = await adapter.execute(validRequest);
      expect(result.success).toBe(false);
      expect(result.adapterUsed).toBe('razorpay_test_mode');
      expect(result.settledAmountPaise).toBe(0);
      expect(result.status).toBe('failed');
      expect(result.rawResponseSummary).toContain('Razorpay Test-Mode credentials not configured');
    });
  });

  describe('Server-Side Idempotency Store (Prototype Scope)', () => {
    it('records new executions and accurately replays matching idempotency keys', async () => {
      const adapter = new DeterministicSimulatorAdapter();
      const receipt = await adapter.execute(validRequest);

      // Check new key
      const initialCheck = idempotencyStore.check(validRequest.idempotencyKey, validRequest);
      expect(initialCheck.status).toBe('new');

      // Save in store
      idempotencyStore.save(validRequest.idempotencyKey, validRequest, receipt);

      // Replay with identical payload
      const replayCheck = idempotencyStore.check(validRequest.idempotencyKey, validRequest);
      expect(replayCheck.status).toBe('replay');
      if (replayCheck.status === 'replay') {
        expect(replayCheck.receipt.transactionReference).toBe(receipt.transactionReference);
      }
    });

    it('detects and flags conflicting payloads with the same idempotency key', async () => {
      const adapter = new DeterministicSimulatorAdapter();
      const receipt = await adapter.execute(validRequest);
      idempotencyStore.save(validRequest.idempotencyKey, validRequest, receipt);

      const conflictingRequest = { ...validRequest, amountPaise: 999_000 };
      const conflictCheck = idempotencyStore.check(validRequest.idempotencyKey, conflictingRequest);
      expect(conflictCheck.status).toBe('conflict');
    });
  });
});
