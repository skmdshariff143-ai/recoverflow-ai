/**
 * PayBack AI — Razorpay Webhook Ingestion Unit Tests.
 *
 * Validates HMAC SHA-256 signature verification, error taxonomy classification,
 * payload transformation into canonical `FailedPayment` schema, and security invariants.
 */

import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  verifyRazorpayWebhookSignature,
  classifyRazorpayFailureCategory,
  mapRazorpayWebhookToFailedPayment,
  HIGH_VALUE_THRESHOLD_PAISE,
  type RazorpayWebhookPayload,
  type RazorpayPaymentEntity,
} from '../razorpayWebhook';

describe('Razorpay Webhook Ingestion & Transformation', () => {
  const TEST_SECRET = 'rzp_whsec_test_secret_key_12345';

  describe('HMAC SHA-256 Signature Verification', () => {
    it('successfully validates authentic Razorpay webhook signature', () => {
      const rawBody = JSON.stringify({ event: 'payment.failed', id: 'pay_test_001' });
      const validSignature = crypto
        .createHmac('sha256', TEST_SECRET)
        .update(rawBody, 'utf8')
        .digest('hex');

      const result = verifyRazorpayWebhookSignature(rawBody, validSignature, TEST_SECRET);
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('rejects tampered payload content even with valid original signature', () => {
      const originalBody = JSON.stringify({ event: 'payment.failed', amount: 50000 });
      const tamperedBody = JSON.stringify({ event: 'payment.failed', amount: 5000000 });
      const signature = crypto
        .createHmac('sha256', TEST_SECRET)
        .update(originalBody, 'utf8')
        .digest('hex');

      const result = verifyRazorpayWebhookSignature(tamperedBody, signature, TEST_SECRET);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('mismatch');
    });

    it('rejects invalid or forged signatures', () => {
      const rawBody = JSON.stringify({ event: 'payment.failed' });
      const forgedSignature = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      const result = verifyRazorpayWebhookSignature(rawBody, forgedSignature, TEST_SECRET);
      expect(result.valid).toBe(false);
    });

    it('rejects missing or empty signature header', () => {
      const rawBody = JSON.stringify({ event: 'payment.failed' });
      expect(verifyRazorpayWebhookSignature(rawBody, null, TEST_SECRET).valid).toBe(false);
      expect(verifyRazorpayWebhookSignature(rawBody, '', TEST_SECRET).valid).toBe(false);
    });

    it('rejects verification when secret is missing', () => {
      const rawBody = JSON.stringify({ event: 'payment.failed' });
      expect(verifyRazorpayWebhookSignature(rawBody, 'some_sig', '').valid).toBe(false);
    });
  });

  describe('Failure Category Classification', () => {
    it('classifies insufficient funds errors accurately', () => {
      const entity: RazorpayPaymentEntity = {
        id: 'pay_001',
        amount: 250000,
        currency: 'INR',
        status: 'failed',
        error_code: 'BAD_REQUEST_ERROR',
        error_description: 'Payment was declined due to insufficient funds in customer account.',
        error_source: 'issuing_bank',
      };
      expect(classifyRazorpayFailureCategory(entity)).toBe('insufficient_funds');
    });

    it('classifies bank downtime and timeouts', () => {
      const entity: RazorpayPaymentEntity = {
        id: 'pay_002',
        amount: 150000,
        currency: 'INR',
        status: 'failed',
        error_code: 'GATEWAY_ERROR',
        error_description: 'Bank server is temporarily unavailable or experiencing downtime.',
        error_source: 'issuing_bank',
      };
      expect(classifyRazorpayFailureCategory(entity)).toBe('bank_downtime');
    });

    it('classifies authentication and 3DS OTP failures', () => {
      const entity: RazorpayPaymentEntity = {
        id: 'pay_003',
        amount: 300000,
        currency: 'INR',
        status: 'failed',
        error_code: 'BAD_REQUEST_ERROR',
        error_description: 'Customer failed 3D Secure OTP authentication.',
        error_source: 'customer',
      };
      expect(classifyRazorpayFailureCategory(entity)).toBe('auth_failure');
    });

    it('classifies expired card errors', () => {
      const entity: RazorpayPaymentEntity = {
        id: 'pay_004',
        amount: 120000,
        currency: 'INR',
        status: 'failed',
        error_code: 'BAD_REQUEST_ERROR',
        error_description: 'The card expiry date has passed.',
      };
      expect(classifyRazorpayFailureCategory(entity)).toBe('expired_card');
    });

    it('classifies customer cancellation and dropped journeys', () => {
      const entity: RazorpayPaymentEntity = {
        id: 'pay_005',
        amount: 80000,
        currency: 'INR',
        status: 'failed',
        error_code: 'BAD_REQUEST_ERROR',
        error_description: 'Payment cancelled by user on checkout.',
      };
      expect(classifyRazorpayFailureCategory(entity)).toBe('customer_cancellation');
    });
  });

  describe('Payload Transformation to FailedPayment Schema', () => {
    it('transforms real Razorpay test webhook payload into compliant FailedPayment', () => {
      const webhookPayload: RazorpayWebhookPayload = {
        entity: 'event',
        account_id: 'acc_test_123',
        event: 'payment.failed',
        created_at: 1700000000,
        payload: {
          payment: {
            entity: {
              id: 'pay_rzp_test_999888',
              amount: 450000,
              currency: 'INR',
              status: 'failed',
              customer_id: 'cust_acme_corp',
              email: 'finance@acme.example',
              contact: '+919876543210',
              error_code: 'GATEWAY_ERROR',
              error_description: 'Bank server is temporarily unavailable.',
              error_source: 'issuing_bank',
              created_at: 1700000000,
              notes: {
                opt_out: 'false',
                on_time_rate: 0.85,
              },
            },
          },
        },
      };

      const mapped = mapRazorpayWebhookToFailedPayment(webhookPayload);

      expect(mapped.payment_id).toBe('pay_rzp_test_999888');
      expect(mapped.customer_id).toBe('cust_acme_corp');
      expect(mapped.amount).toBe(450000);
      expect(mapped.currency).toBe('INR');
      expect(mapped.failure_category).toBe('bank_downtime');
      expect(mapped.invoice_value_tier).toBe('standard');
      expect(mapped.opt_out).toBe(false);
      expect(mapped.quiet_hours_window).toEqual({
        start: 21,
        end: 9,
        timezone: 'Asia/Kolkata',
      });
      expect(mapped.customer_payment_history.on_time_payment_rate).toBe(0.85);
    });

    it('flags high-value transactions (>= ₹50,000) for dual-custody approval', () => {
      const webhookPayload: RazorpayWebhookPayload = {
        entity: 'event',
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: 'pay_high_val_001',
              amount: HIGH_VALUE_THRESHOLD_PAISE + 100000, // ₹51,000
              currency: 'INR',
              status: 'failed',
              error_code: 'BAD_REQUEST_ERROR',
              error_description: 'Declined by bank',
            },
          },
        },
      };

      const mapped = mapRazorpayWebhookToFailedPayment(webhookPayload);
      expect(mapped.invoice_value_tier).toBe('high_value');
    });

    it('enforces DPDP opt-out if flagged in metadata notes', () => {
      const webhookPayload: RazorpayWebhookPayload = {
        entity: 'event',
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: 'pay_opted_out_001',
              amount: 200000,
              currency: 'INR',
              status: 'failed',
              notes: {
                dpdp_opt_out: 'true',
              },
            },
          },
        },
      };

      const mapped = mapRazorpayWebhookToFailedPayment(webhookPayload);
      expect(mapped.opt_out).toBe(true);
    });

    it('throws descriptive error if entity is missing in payload', () => {
      const emptyPayload = { entity: 'event', event: 'payment.failed' } as RazorpayWebhookPayload;
      expect(() => mapRazorpayWebhookToFailedPayment(emptyPayload)).toThrow(/missing payload\.payment\.entity/);
    });
  });
});
