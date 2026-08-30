/**
 * Unit tests for RecoverFlow AI Execution Adapters & Razorpay Test-Mode Integration.
 */

import { describe, it, expect } from 'vitest';
import {
  DeterministicSimulatorAdapter,
  RazorpayTestModeAdapter,
  verifyRazorpayWebhookSignature,
  type RecoveryExecutionRequest,
} from '../recoveryAdapter';

describe('Recovery Execution Adapters', () => {
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

  describe('DeterministicSimulatorAdapter', () => {
    const adapter = new DeterministicSimulatorAdapter();

    it('executes valid request and returns structured execution receipt', async () => {
      const result = await adapter.execute(validRequest);

      expect(result.success).toBe(true);
      expect(result.adapterUsed).toBe('deterministic_simulator');
      expect(result.settledAmountPaise).toBe(500_000);
      expect(result.status).toBe('captured');
      expect(result.transactionReference).toContain('sim_txn_');
      expect(result.paymentLinkUrl).toBeDefined();
    });

    it('rejects invalid inputs via Zod schema validation', async () => {
      const invalid = { ...validRequest, amountPaise: -500 };
      await expect(adapter.execute(invalid as unknown as RecoveryExecutionRequest)).rejects.toThrow();
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
      expect(result.settledAmountPaise).toBe(0); // Invariant: unrecovered money
      expect(result.status).toBe('failed');
      expect(result.rawResponseSummary).toContain('running in graceful fallback mode');
    });
  });

  describe('Razorpay Webhook Signature Verification', () => {
    const secret = 'whsec_test_secret_key_123';
    const rawPayload = JSON.stringify({
      entity: 'event',
      account_id: 'acc_test',
      event: 'payment.captured',
      contains: ['payment'],
      payload: {
        payment: {
          entity: {
            id: 'pay_test_settled_123',
            amount: 500000,
            status: 'captured',
          },
        },
      },
    });

    it('validates authentic webhook signatures correctly', () => {
      const crypto = require('crypto');
      const validSignature = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');

      const isValid = verifyRazorpayWebhookSignature(rawPayload, validSignature, secret);
      expect(isValid).toBe(true);
    });

    it('rejects tampered webhook payloads or incorrect signatures', () => {
      const crypto = require('crypto');
      const validSignature = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');

      const tamperedPayload = rawPayload.replace('500000', '999999');
      const isTamperedValid = verifyRazorpayWebhookSignature(tamperedPayload, validSignature, secret);
      expect(isTamperedValid).toBe(false);

      const isWrongSecretValid = verifyRazorpayWebhookSignature(rawPayload, validSignature, 'wrong_secret');
      expect(isWrongSecretValid).toBe(false);
    });
  });
});
