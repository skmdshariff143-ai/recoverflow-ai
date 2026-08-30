/**
 * Unit tests for PayBack AI Execution Adapters & Idempotency Store.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DeterministicSimulatorAdapter,
  RazorpayTestModeAdapter,
  AdapterTypeSchema,
  InvalidSimulatorReferenceError,
  generateStatelessSimulatorReference,
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
      expect(AdapterTypeSchema.safeParse('deterministic_simulator').success).toBe(true);
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

    it('getStatus retrieves the exact recorded transaction amount statelessly and marks evidence as SYNTHETIC', async () => {
      const result = await adapter.execute(validRequest);
      const query = await adapter.getStatus(result.transactionReference);

      expect(query.status).toBe('captured');
      expect(query.source).toBe('simulator_stateless_receipt');
      expect(query.evidenceClass).toBe('SYNTHETIC');
      expect(query.liveSettledAmountPaise).toBe(0);
      expect(query.syntheticOutcomeAmountPaise).toBe(500_000);
      expect(query.verifiedSyntheticRecoveredPaise).toBe(500_000);
    });

    it('statelessly reconstructs identical outcome from reference on a brand new adapter instance with empty memory', async () => {
      const result = await adapter.execute(validRequest);

      // Create a fresh isolated adapter instance with 0 memory
      const freshIsolatedAdapter = new DeterministicSimulatorAdapter();
      const query = await freshIsolatedAdapter.getStatus(result.transactionReference);

      expect(query.status).toBe('captured');
      expect(query.settledAmountPaise).toBe(500_000);
      expect(query.source).toBe('simulator_stateless_receipt');
      expect(query.evidenceClass).toBe('SYNTHETIC');
      expect(query.liveSettledAmountPaise).toBe(0);
      expect(query.syntheticOutcomeAmountPaise).toBe(500_000);
      expect(query.verifiedSyntheticRecoveredPaise).toBe(500_000);
      expect(query.provenanceNotice).toBe(
        'Deterministic synthetic evaluation outcome; not live merchant settlement.',
      );
    });

    it('throws InvalidSimulatorReferenceError (not a business outcome) for tampered checksum', async () => {
      const result = await adapter.execute(validRequest);

      // Tamper: alter amount, which breaks the checksum
      const tamperedRef = result.transactionReference.replace('500000', '99999999');
      const freshIsolatedAdapter = new DeterministicSimulatorAdapter();

      await expect(freshIsolatedAdapter.getStatus(tamperedRef)).rejects.toThrow(InvalidSimulatorReferenceError);
      await expect(freshIsolatedAdapter.getStatus(tamperedRef)).rejects.toMatchObject({
        errorCode: 'INVALID_SIMULATOR_REFERENCE',
        evidenceClass: 'UNVERIFIED',
        liveSettledAmountPaise: 0,
        syntheticOutcomeAmountPaise: 0,
      });
    });

    it('handles 25 concurrent parallel status requests for the same reference and returns identical results across all 25', async () => {
      const result = await adapter.execute(validRequest);
      const freshIsolatedAdapter = new DeterministicSimulatorAdapter();

      const queries = await Promise.all(
        Array.from({ length: 25 }, () => freshIsolatedAdapter.getStatus(result.transactionReference)),
      );

      expect(queries).toHaveLength(25);
      for (const q of queries) {
        expect(q.status).toBe('captured');
        expect(q.settledAmountPaise).toBe(500_000);
        expect(q.syntheticOutcomeAmountPaise).toBe(500_000);
        expect(q.liveSettledAmountPaise).toBe(0);
        expect(q.evidenceClass).toBe('SYNTHETIC');
      }
    });

    it('throws InvalidSimulatorReferenceError for unknown non-simulator references', async () => {
      await expect(adapter.getStatus('unknown_ref_999')).rejects.toThrow(InvalidSimulatorReferenceError);
      await expect(adapter.getStatus('unknown_ref_999')).rejects.toMatchObject({
        errorCode: 'INVALID_SIMULATOR_REFERENCE',
        evidenceClass: 'UNVERIFIED',
        liveSettledAmountPaise: 0,
        syntheticOutcomeAmountPaise: 0,
      });
    });
  });

  describe('Invalid Simulator Reference Handling (Technical Error, Not Business Outcome)', () => {
    const adapter = new DeterministicSimulatorAdapter();

    it('rejects modified checksum with InvalidSimulatorReferenceError', async () => {
      // Valid reference with last hex char changed
      const validRef = generateStatelessSimulatorReference('pay_chk_001', 1, 'retry', 500000, 'cap');
      const tampered = validRef.slice(0, -1) + (validRef.endsWith('0') ? '1' : '0');

      await expect(adapter.getStatus(tampered)).rejects.toThrow(InvalidSimulatorReferenceError);
      await expect(adapter.getStatus(tampered)).rejects.toMatchObject({
        errorCode: 'INVALID_SIMULATOR_REFERENCE',
        evidenceClass: 'UNVERIFIED',
        liveSettledAmountPaise: 0,
        syntheticOutcomeAmountPaise: 0,
      });
    });

    it('rejects truncated reference with InvalidSimulatorReferenceError', async () => {
      const validRef = generateStatelessSimulatorReference('pay_trunc_001', 1, 'retry', 500000, 'cap');
      const truncated = validRef.slice(0, Math.floor(validRef.length / 2));

      await expect(adapter.getStatus(truncated)).rejects.toThrow(InvalidSimulatorReferenceError);
      await expect(adapter.getStatus(truncated)).rejects.toMatchObject({
        errorCode: 'INVALID_SIMULATOR_REFERENCE',
        evidenceClass: 'UNVERIFIED',
      });
    });

    it('rejects reference with invalid (swapped) amount with InvalidSimulatorReferenceError', async () => {
      // Build a structurally valid reference but with the amount field altered (breaks checksum)
      const validRef = generateStatelessSimulatorReference('pay_amt_001', 1, 'retry', 500000, 'cap');
      const invalidAmountRef = validRef.replace('_500000_', '_999_');

      await expect(adapter.getStatus(invalidAmountRef)).rejects.toThrow(InvalidSimulatorReferenceError);
      await expect(adapter.getStatus(invalidAmountRef)).rejects.toMatchObject({
        errorCode: 'INVALID_SIMULATOR_REFERENCE',
        evidenceClass: 'UNVERIFIED',
        syntheticOutcomeAmountPaise: 0,
      });
    });

    it('rejects reference with negative amount encoding attempt', async () => {
      // Attempt to inject negative amount — regex anchors block this
      const negativeRef = 'sim_txn_pay_neg_001_c1_retry_-500000_cap_aabbccddeeff';

      await expect(adapter.getStatus(negativeRef)).rejects.toThrow(InvalidSimulatorReferenceError);
      await expect(adapter.getStatus(negativeRef)).rejects.toMatchObject({
        errorCode: 'INVALID_SIMULATOR_REFERENCE',
        evidenceClass: 'UNVERIFIED',
      });
    });

    it('rejects reference with unsupported outcome marker', async () => {
      // Outcome 'xyz' is not cap|lnk|fal so regex won't match
      const unsupportedRef = 'sim_txn_pay_out_001_c1_retry_500000_xyz_aabbccddeeff';

      await expect(adapter.getStatus(unsupportedRef)).rejects.toThrow(InvalidSimulatorReferenceError);
      await expect(adapter.getStatus(unsupportedRef)).rejects.toMatchObject({
        errorCode: 'INVALID_SIMULATOR_REFERENCE',
        evidenceClass: 'UNVERIFIED',
      });
    });

    it('rejects oversized reference (>512 chars) with InvalidSimulatorReferenceError', async () => {
      const oversizedRef = 'sim_txn_' + 'a'.repeat(600) + '_c1_retry_500000_cap_aabbccddeeff';

      await expect(adapter.getStatus(oversizedRef)).rejects.toThrow(InvalidSimulatorReferenceError);
      try {
        await adapter.getStatus(oversizedRef);
      } catch (e) {
        expect(e).toBeInstanceOf(InvalidSimulatorReferenceError);
        expect((e as InvalidSimulatorReferenceError).reason).toContain('maximum permitted length');
      }
    });

    it('rejects reference with encoded injection characters', async () => {
      const injectionRef = 'sim_txn_pay%3Cscript%3Ealert(1)%3C/script%3E_c1_retry_500000_cap_aabbccddeeff';

      await expect(adapter.getStatus(injectionRef)).rejects.toThrow(InvalidSimulatorReferenceError);
      await expect(adapter.getStatus(injectionRef)).rejects.toMatchObject({
        errorCode: 'INVALID_SIMULATOR_REFERENCE',
        evidenceClass: 'UNVERIFIED',
      });
    });

    it('returns a legitimate failed synthetic outcome (not an error) for a valid fal-outcome reference', async () => {
      // Generate a valid reference with outcomeCode 'fal' (genuine failed recovery)
      const failedRef = generateStatelessSimulatorReference('pay_legit_fail_001', 1, 'retry', 500000, 'fal');

      // This should NOT throw — it is a valid reference encoding a genuine failed outcome
      const result = await adapter.getStatus(failedRef);
      expect(result.status).toBe('failed');
      expect(result.evidenceClass).toBe('SYNTHETIC');
      expect(result.liveSettledAmountPaise).toBe(0);
      expect(result.syntheticOutcomeAmountPaise).toBe(0);
    });

    it('clearly distinguishes invalid reference (technical error) from valid failed outcome (business result)', async () => {
      // 1. Valid reference encoding a genuine "failed" recovery
      const validFailedRef = generateStatelessSimulatorReference('pay_dist_001', 1, 'retry', 500000, 'fal');
      const validResult = await adapter.getStatus(validFailedRef);
      expect(validResult.status).toBe('failed');
      expect(validResult.evidenceClass).toBe('SYNTHETIC'); // Business outcome — real evidence class
      expect(validResult.source).toBe('simulator_stateless_receipt');

      // 2. Invalid/tampered reference — must throw, not return a business outcome
      const tamperedRef = validFailedRef.slice(0, -1) + (validFailedRef.endsWith('0') ? '1' : '0');
      let threwError = false;
      try {
        await adapter.getStatus(tamperedRef);
      } catch (e) {
        threwError = true;
        expect(e).toBeInstanceOf(InvalidSimulatorReferenceError);
        expect((e as InvalidSimulatorReferenceError).evidenceClass).toBe('UNVERIFIED');
        expect((e as InvalidSimulatorReferenceError).errorCode).toBe('INVALID_SIMULATOR_REFERENCE');
      }
      expect(threwError).toBe(true); // Must throw, never silently return
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
