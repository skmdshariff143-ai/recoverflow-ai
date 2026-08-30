/**
 * Unit tests for RecoverFlow AI Execution Adapters, Webhook Verification & Idempotency Store.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import {
  DeterministicSimulatorAdapter,
  RazorpayTestModeAdapter,
  verifyRazorpayWebhookSignature,
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
      expect(result.settledAmountPaise).toBe(500_000);
      expect(result.status).toBe('captured');
      expect(result.transactionReference).toContain('sim_txn_');
      expect(result.paymentLinkUrl).toBeUndefined(); // Invariant: no fake URLs
    });

    it('getStatus retrieves the exact recorded transaction amount from memory', async () => {
      const result = await adapter.execute(validRequest);
      const query = await adapter.getStatus(result.transactionReference);

      expect(query.status).toBe('captured');
      expect(query.settledAmountPaise).toBe(500_000);
      expect(query.source).toBe('simulator_memory');
    });

    it('getStatus returns failed for unknown references', async () => {
      const query = await adapter.getStatus('unknown_ref_999');
      expect(query.status).toBe('failed');
      expect(query.settledAmountPaise).toBe(0);
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

  describe('Razorpay Webhook Verification, Deduplication & Edge Cases', () => {
    const secret = 'whsec_test_secret_key_123';
    const validPaymentPayload = JSON.stringify({
      entity: 'event',
      account_id: 'acc_test_123',
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_test_settled_123',
            amount: 500000,
            currency: 'INR',
            status: 'captured',
          },
        },
      },
      event_id: 'evt_001_test',
    });

    it('validates authentic webhook signatures correctly', () => {
      const validSignature = crypto.createHmac('sha256', secret).update(validPaymentPayload).digest('hex');
      const isValid = verifyRazorpayWebhookSignature(validPaymentPayload, validSignature, secret);
      expect(isValid).toBe(true);
    });

    it('fails closed when signature or secret is empty', () => {
      expect(verifyRazorpayWebhookSignature(validPaymentPayload, '', secret)).toBe(false);
      expect(verifyRazorpayWebhookSignature(validPaymentPayload, 'some_sig', '')).toBe(false);
      expect(verifyRazorpayWebhookSignature('', 'some_sig', secret)).toBe(false);
    });

    it('rejects tampered webhook payloads or incorrect secrets', () => {
      const validSignature = crypto.createHmac('sha256', secret).update(validPaymentPayload).digest('hex');

      const tamperedPayload = validPaymentPayload.replace('500000', '999999');
      const isTamperedValid = verifyRazorpayWebhookSignature(tamperedPayload, validSignature, secret);
      expect(isTamperedValid).toBe(false);

      const isWrongSecretValid = verifyRazorpayWebhookSignature(validPaymentPayload, validSignature, 'wrong_secret');
      expect(isWrongSecretValid).toBe(false);
    });

    it('deduplicates processed webhook event IDs', () => {
      const isFirst = idempotencyStore.recordWebhookEvent('evt_wh_unique_001');
      expect(isFirst).toBe(true);

      const isDuplicate = idempotencyStore.recordWebhookEvent('evt_wh_unique_001');
      expect(isDuplicate).toBe(false);
    });
  });
});
