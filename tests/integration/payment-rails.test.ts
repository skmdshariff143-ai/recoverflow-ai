import { describe, it, expect } from 'vitest';
import { 
  classifyPaymentFailure, 
  generateLocalizedPaymentRescue,
  type PaymentRescueParams 
} from '@recoverflow/core';

describe('Localized Payment Gateway Rescue Engine (UPI, Pix, Apple Pay)', () => {
  describe('Payment Failure Error Code Classification', () => {
    it('classifies gateway timeouts correctly', () => {
      expect(classifyPaymentFailure('CARD_NETWORK_TIMEOUT')).toBe('CARD_TIMEOUT');
      expect(classifyPaymentFailure('gateway_connection_timeout')).toBe('CARD_TIMEOUT');
    });

    it('classifies 3DS OTP and verification failures correctly', () => {
      expect(classifyPaymentFailure('3DS_AUTHENTICATION_FAIL')).toBe('3DS_AUTHENTICATION_FAIL');
      expect(classifyPaymentFailure('declined_secure_customer_otp')).toBe('3DS_AUTHENTICATION_FAIL');
    });

    it('classifies currency mismatch errors', () => {
      expect(classifyPaymentFailure('cross_border_currency_mismatch')).toBe('CURRENCY_MISMATCH');
      expect(classifyPaymentFailure('forex_settlement_blocked')).toBe('CURRENCY_MISMATCH');
    });

    it('classifies card declined / insufficient funds', () => {
      expect(classifyPaymentFailure('insufficient_funds_declined')).toBe('GATEWAY_REJECTED');
      expect(classifyPaymentFailure('card_rejected_by_issuer')).toBe('GATEWAY_REJECTED');
    });

    it('falls back to UNKNOWN_FAILURE for unexpected codes', () => {
      expect(classifyPaymentFailure(undefined)).toBe('UNKNOWN_FAILURE');
      expect(classifyPaymentFailure('something_weird_123')).toBe('UNKNOWN_FAILURE');
    });
  });

  describe('India UPI Instant Intent Deep-Linking', () => {
    it('generates valid UPI deep link and localized recovery message for India checkout', () => {
      const params: PaymentRescueParams = {
        errorCode: '3DS_AUTHENTICATION_FAIL',
        countryCode: 'IN',
        currency: 'INR',
        totalPrice: 4299.0,
        checkoutUrl: 'https://aurora-apparel.myshopify.com/checkouts/c_19283',
        merchantStoreName: 'Aurora Luxury Apparel',
        upiVpa: 'aurora.orders@hdfcbank',
        orderId: 'ord_india_9912',
      };

      const rescue = generateLocalizedPaymentRescue(params);

      expect(rescue.reason).toBe('3DS_AUTHENTICATION_FAIL');
      expect(rescue.recommendedRail).toBe('UPI_INDIA');
      expect(rescue.reEntryUrl).toContain('rescue_rail=upi');
      expect(rescue.nativeIntentString).toBeDefined();
      expect(rescue.nativeIntentString).toContain('upi://pay?pa=aurora.orders@hdfcbank');
      expect(rescue.nativeIntentString).toContain('am=4299.00');
      expect(rescue.nativeIntentString).toContain('cu=INR');
      expect(rescue.nativeIntentString).toContain('tr=ord_india_9912');
      expect(rescue.rescueCopy).toMatch(/Google Pay, PhonePe, or Paytm UPI/i);
    });
  });

  describe('Brazil Pix Dynamic EMVCo QR / Copy-Paste Key', () => {
    it('generates valid Pix copy-paste key and Portuguese rescue copy for Brazil checkout', () => {
      const params: PaymentRescueParams = {
        errorCode: 'card_declined',
        countryCode: 'BR',
        currency: 'BRL',
        totalPrice: 289.5,
        checkoutUrl: 'https://aurora-apparel.myshopify.com/checkouts/c_br_5512',
        merchantStoreName: 'Aurora Luxury Apparel',
        orderId: 'ord_brazil_882',
      };

      const rescue = generateLocalizedPaymentRescue(params);

      expect(rescue.reason).toBe('GATEWAY_REJECTED');
      expect(rescue.recommendedRail).toBe('PIX_BRAZIL');
      expect(rescue.reEntryUrl).toContain('rescue_rail=pix');
      expect(rescue.nativeIntentString).toBeDefined();
      expect(rescue.nativeIntentString).toMatch(/^00020126580014BR\.GOV\.BCB\.PIX/);
      expect(rescue.nativeIntentString).toContain('289.50');
      expect(rescue.rescueCopy).toMatch(/via Pix com aprovação imediata/i);
    });
  });

  describe('US / EU Apple Pay & Google Pay Express Permalinks', () => {
    it('generates accelerated 1-tap express checkout permalink for US / EU checkouts', () => {
      const params: PaymentRescueParams = {
        errorCode: 'network_error_timeout',
        countryCode: 'US',
        currency: 'USD',
        totalPrice: 195.0,
        checkoutUrl: 'https://aurora-apparel.myshopify.com/checkouts/c_us_3321',
        merchantStoreName: 'Aurora Luxury Apparel',
        orderId: 'ord_us_112',
      };

      const rescue = generateLocalizedPaymentRescue(params);

      expect(rescue.reason).toBe('CARD_TIMEOUT');
      expect(rescue.recommendedRail).toBe('APPLE_PAY_US_EU');
      expect(rescue.reEntryUrl).toContain('accelerated=apple_pay,google_pay');
      expect(rescue.rescueCopy).toMatch(/Apple Pay/i);
    });
  });
});
