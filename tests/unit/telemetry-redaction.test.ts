import { describe, it, expect } from 'vitest';
import {
  maskEmail,
  maskPhone,
  redactTelemetrySession,
  type IntentSession,
} from '../../apps/web/src/app/api/v1/telemetry/intent/route';

describe('telemetry-redaction: PII Protection in Telemetry Views', () => {
  describe('maskEmail', () => {
    it('redacts middle characters of email address', () => {
      expect(maskEmail('alex.morgan@aurora.com')).toBe('a***n@aurora.com');
      expect(maskEmail('judge@buildathon.in')).toBe('j***e@buildathon.in');
    });

    it('handles short usernames safely', () => {
      expect(maskEmail('me@domain.com')).toBe('m***@domain.com');
      expect(maskEmail('a@b.com')).toBe('a***@b.com');
    });

    it('handles malformed email inputs safely', () => {
      expect(maskEmail('')).toBe('***');
      expect(maskEmail('notanemail')).toBe('***');
    });
  });

  describe('maskPhone', () => {
    it('masks middle digits while preserving prefix and suffix for debugging', () => {
      expect(maskPhone('+919876543210')).toBe('+91****10');
      expect(maskPhone('+14155551234')).toBe('+14****34');
    });

    it('handles short phone numbers safely', () => {
      expect(maskPhone('123')).toBe('****');
      expect(maskPhone('')).toBe('***');
    });
  });

  describe('redactTelemetrySession', () => {
    it('redacts email and phone in session linkedIdentity before serialization', () => {
      const rawSession: IntentSession = {
        cartToken: 'tok_cart_99182',
        shopDomain: 'aurora-apparel.myshopify.com',
        events: [
          { eventType: 'CHECKOUT_START', timestamp: 1710000000 },
          { eventType: 'DISCOUNT_APPLIED', timestamp: 1710000010 },
        ],
        linkedIdentity: {
          email: 'customer.secret@example.com',
          phone: '+919876500000',
        },
        preDropRisk: 'MED',
        lastSeenAt: 1710000015,
      };

      const redacted = redactTelemetrySession(rawSession);

      expect(redacted).not.toBeNull();
      expect(redacted?.cartToken).toBe('tok_cart_99182');
      expect(redacted?.linkedIdentity.email).toBe('c***t@example.com');
      expect(redacted?.linkedIdentity.phone).toBe('+91****00');
      // Plaintext must never leak
      expect(redacted?.linkedIdentity.email).not.toContain('customer.secret');
      expect(redacted?.linkedIdentity.phone).not.toContain('98765');
    });

    it('returns null when session is null or undefined', () => {
      expect(redactTelemetrySession(null)).toBeNull();
      expect(redactTelemetrySession(undefined)).toBeNull();
    });
  });
});
