/**
 * Unit tests for RecoverFlow AI Execution Adapters (Phase 5).
 */

import { describe, it, expect } from 'vitest';
import {
  DeterministicSimulatorAdapter,
  RazorpayTestModeAdapter,
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

  describe('RazorpayTestModeAdapter', () => {
    it('gracefully falls back when unconfigured without throwing unhandled exceptions', async () => {
      const adapter = new RazorpayTestModeAdapter('', '');
      expect(adapter.isConfigured()).toBe(false);

      const result = await adapter.execute(validRequest);
      expect(result.success).toBe(false);
      expect(result.adapterUsed).toBe('razorpay_test_mode');
      expect(result.status).toBe('failed');
      expect(result.rawResponseSummary).toContain('running in graceful fallback mode');
    });
  });
});
