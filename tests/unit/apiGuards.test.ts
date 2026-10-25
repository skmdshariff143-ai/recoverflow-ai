import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  checkRateLimit,
  enforceRateLimit,
  requireAdminToken,
  enforceRouteAuth,
  MemoryRateLimitStore,
  setRateLimitStore,
} from '../../apps/web/src/lib/apiGuards';

describe('apiGuards: Pluggable Rate Limiter & Token Auth', () => {
  beforeEach(() => {
    setRateLimitStore(new MemoryRateLimitStore());
  });

  describe('Rate Limiter Store & Windows', () => {
    it('allows requests within window and decrements remaining count', async () => {
      const id = 'client_test_1';
      const r1 = await checkRateLimit(id, 5, 10000);
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(4);

      const r2 = await checkRateLimit(id, 5, 10000);
      expect(r2.allowed).toBe(true);
      expect(r2.remaining).toBe(3);
    });

    it('blocks requests once threshold is reached', async () => {
      const id = 'client_test_2';
      for (let i = 0; i < 3; i++) {
        await checkRateLimit(id, 3, 10000);
      }

      const blocked = await checkRateLimit(id, 3, 10000);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.resetInSeconds).toBeGreaterThan(0);
    });

    it('enforceRateLimit returns 429 response when limit exceeded', async () => {
      const req = new Request('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '198.51.100.22' },
      });

      // Exhaust limit of 2
      await enforceRateLimit(req, 2, 5000);
      await enforceRateLimit(req, 2, 5000);

      // Third request should produce 429 response
      const res = await enforceRateLimit(req, 2, 5000);
      expect(res).not.toBeNull();
      expect(res?.status).toBe(429);
      expect(res?.headers.get('Retry-After')).toBeTruthy();
      expect(res?.headers.get('X-RateLimit-Limit')).toBe('2');
    });
  });

  describe('requireAdminToken', () => {
    const originalToken = process.env.ADMIN_API_TOKEN;

    beforeEach(() => {
      process.env.ADMIN_API_TOKEN = 'secret-test-token-12345';
    });

    afterEach(() => {
      process.env.ADMIN_API_TOKEN = originalToken;
    });

    it('rejects requests without admin token with 401', () => {
      const req = new Request('http://localhost:3000/api/test');
      const res = requireAdminToken(req);
      expect(res).not.toBeNull();
      expect(res?.status).toBe(401);
    });

    it('rejects invalid admin tokens with 403', () => {
      const req = new Request('http://localhost:3000/api/test', {
        headers: { 'x-admin-token': 'wrong-token' },
      });
      const res = requireAdminToken(req);
      expect(res).not.toBeNull();
      expect(res?.status).toBe(403);
    });

    it('accepts correct token in x-admin-token header', () => {
      const req = new Request('http://localhost:3000/api/test', {
        headers: { 'x-admin-token': 'secret-test-token-12345' },
      });
      const res = requireAdminToken(req);
      expect(res).toBeNull(); // null means authorized, request continues
    });

    it('accepts correct token in Authorization: Bearer header', () => {
      const req = new Request('http://localhost:3000/api/test', {
        headers: { authorization: 'Bearer secret-test-token-12345' },
      });
      const res = requireAdminToken(req);
      expect(res).toBeNull();
    });
  });

  describe('enforceRouteAuth (Dual-Mode Strategy)', () => {
    const origMode = process.env.RECOVERFLOW_RUNTIME_MODE;
    const origToken = process.env.ADMIN_API_TOKEN;

    beforeEach(() => {
      process.env.ADMIN_API_TOKEN = 'secret-test-token-12345';
    });

    afterEach(() => {
      process.env.RECOVERFLOW_RUNTIME_MODE = origMode;
      process.env.ADMIN_API_TOKEN = origToken;
    });

    it('allows simulated requests in DEMO mode without credentials', async () => {
      process.env.RECOVERFLOW_RUNTIME_MODE = 'DEMO';
      const req = new Request('http://localhost:3000/api/razorpay/subscriptions');

      const res = await enforceRouteAuth(req, {
        allowDemoSimulation: true,
        requiresLiveCredentials: false,
      });

      expect(res).toBeNull(); // Allowed for judges without credentials
    });

    it('requires admin token in LIVE mode even if allowDemoSimulation is requested', async () => {
      process.env.RECOVERFLOW_RUNTIME_MODE = 'LIVE';
      const req = new Request('http://localhost:3000/api/razorpay/subscriptions');

      const res = await enforceRouteAuth(req, {
        allowDemoSimulation: true,
        requiresLiveCredentials: false,
      });

      expect(res).not.toBeNull();
      expect(res?.status).toBe(401);
    });

    it('requires admin token when requiresLiveCredentials is set to true', async () => {
      process.env.RECOVERFLOW_RUNTIME_MODE = 'DEMO';
      const req = new Request('http://localhost:3000/api/razorpay/subscriptions');

      const res = await enforceRouteAuth(req, {
        allowDemoSimulation: true,
        requiresLiveCredentials: true,
      });

      expect(res).not.toBeNull();
      expect(res?.status).toBe(401);
    });
  });
});
