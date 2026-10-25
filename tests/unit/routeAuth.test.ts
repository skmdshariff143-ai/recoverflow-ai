import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db } from '../../packages/core/src/db';
import {
  createSessionToken,
  DEMO_PERSONA_SESSIONS,
} from '../../packages/core/src/auth';
import { authorizeRequest, isAnonymousDemoEnabled } from '../../apps/web/src/lib/routeAuth';
import { POST as login } from '../../apps/web/src/app/api/auth/session/route';

function createReq(
  url = 'http://localhost:3000/api/recovery/execute',
  options: {
    method?: string;
    token?: string;
    cookie?: string;
    origin?: string;
    secFetchSite?: string;
  } = {}
) {
  const headers = new Headers();
  headers.set('host', 'localhost:3000');
  if (options.token) {
    headers.set('authorization', `Bearer ${options.token}`);
  }
  if (options.cookie) {
    headers.set('cookie', options.cookie);
  }
  if (options.origin) {
    headers.set('origin', options.origin);
  }
  if (options.secFetchSite) {
    headers.set('sec-fetch-site', options.secFetchSite);
  }
  return new NextRequest(url, {
    method: options.method || 'GET',
    headers,
  });
}

describe('routeAuth: authorizeRequest and isAnonymousDemoEnabled', () => {
  beforeEach(() => {
    vi.stubEnv('RECOVERFLOW_RUNTIME_MODE', 'TEST');
    vi.stubEnv('RECOVERFLOW_ALLOW_ANON_DEMO', 'false');
    db.clear?.();
    db.seedDefaults?.();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('isAnonymousDemoEnabled()', () => {
    it('returns false when RECOVERFLOW_ALLOW_ANON_DEMO is not true', () => {
      vi.stubEnv('RECOVERFLOW_ALLOW_ANON_DEMO', 'false');
      vi.stubEnv('RECOVERFLOW_RUNTIME_MODE', 'DEMO');
      expect(isAnonymousDemoEnabled()).toBe(false);
    });

    it('returns true when RECOVERFLOW_ALLOW_ANON_DEMO is true in DEMO or TEST mode', () => {
      vi.stubEnv('RECOVERFLOW_ALLOW_ANON_DEMO', 'true');
      vi.stubEnv('RECOVERFLOW_RUNTIME_MODE', 'DEMO');
      expect(isAnonymousDemoEnabled()).toBe(true);

      vi.stubEnv('RECOVERFLOW_RUNTIME_MODE', 'TEST');
      expect(isAnonymousDemoEnabled()).toBe(true);
    });

    it('returns false in SANDBOX or LIVE mode even if RECOVERFLOW_ALLOW_ANON_DEMO is true', () => {
      vi.stubEnv('RECOVERFLOW_ALLOW_ANON_DEMO', 'true');

      vi.stubEnv('RECOVERFLOW_RUNTIME_MODE', 'SANDBOX');
      expect(isAnonymousDemoEnabled()).toBe(false);

      vi.stubEnv('RECOVERFLOW_RUNTIME_MODE', 'LIVE');
      expect(isAnonymousDemoEnabled()).toBe(false);
    });
  });

  describe('authorizeRequest() — Anonymous handling', () => {
    it('returns 401 when no credential is provided and demo is not allowed on route', async () => {
      vi.stubEnv('RECOVERFLOW_ALLOW_ANON_DEMO', 'true');
      const req = createReq();
      const res = await authorizeRequest(req, 'recovery:execute', { allowAnonymousDemo: false });
      expect(res.authorized).toBe(false);
      expect(res.response?.status).toBe(401);
    });

    it('returns 401 when no credential is provided and RECOVERFLOW_ALLOW_ANON_DEMO is not enabled', async () => {
      vi.stubEnv('RECOVERFLOW_ALLOW_ANON_DEMO', 'false');
      const req = createReq();
      const res = await authorizeRequest(req, 'recovery:execute', { allowAnonymousDemo: true });
      expect(res.authorized).toBe(false);
      expect(res.response?.status).toBe(401);
    });

    it('falls back to DEMO_PERSONA_SESSIONS.RECOVERY_MANAGER when anonymous demo is allowed and enabled', async () => {
      vi.stubEnv('RECOVERFLOW_ALLOW_ANON_DEMO', 'true');
      const req = createReq();
      const res = await authorizeRequest(req, 'recovery:execute', { allowAnonymousDemo: true });
      expect(res.authorized).toBe(true);
      expect(res.session?.role).toBe('RECOVERY_MANAGER');
      expect(res.session?.userId).toBe(DEMO_PERSONA_SESSIONS.RECOVERY_MANAGER.userId);
    });
  });

  describe('authorizeRequest() — Credential handling', () => {
    it('returns 401 when an invalid bearer token is provided and NEVER falls back to demo persona', async () => {
      vi.stubEnv('RECOVERFLOW_ALLOW_ANON_DEMO', 'true');
      const req = createReq('http://localhost:3000/api/recovery/execute', {
        token: 'invalid-malformed-token-xyz',
      });
      const res = await authorizeRequest(req, 'recovery:execute', { allowAnonymousDemo: true });
      expect(res.authorized).toBe(false);
      expect(res.response?.status).toBe(401);
    });

    it('returns 401 when token is validly signed but not registered in database session store', async () => {
      vi.stubEnv('RECOVERFLOW_ALLOW_ANON_DEMO', 'true');
      const unregisteredToken = createSessionToken({
        ...DEMO_PERSONA_SESSIONS.ADMIN,
        runtimeMode: 'TEST',
      });
      const req = createReq('http://localhost:3000/api/recovery/execute', {
        token: unregisteredToken,
      });
      const res = await authorizeRequest(req, 'recovery:execute', { allowAnonymousDemo: true });
      expect(res.authorized).toBe(false);
      expect(res.response?.status).toBe(401);
    });

    it('authorizes a registered valid session with required permission', async () => {
      // Create session via login endpoint
      const loginReq = new NextRequest('http://localhost:3000/api/auth/session', {
        method: 'POST',
        headers: { origin: 'http://localhost:3000' },
        body: JSON.stringify({ method: 'demo', role: 'ADMIN' }),
      });
      const loginRes = await login(loginReq);
      expect(loginRes.status).toBe(200);
      const cookieHeader = loginRes.headers.get('set-cookie')!;
      const token = cookieHeader.split(';')[0].replace('recoverflow_session=', '');

      const req = createReq('http://localhost:3000/api/recovery/execute', {
        token,
      });
      const res = await authorizeRequest(req, 'recovery:execute');
      expect(res.authorized).toBe(true);
      expect(res.session?.role).toBe('ADMIN');
    });

    it('returns 403 when session has insufficient role permission', async () => {
      const loginReq = new NextRequest('http://localhost:3000/api/auth/session', {
        method: 'POST',
        headers: { origin: 'http://localhost:3000' },
        body: JSON.stringify({ method: 'demo', role: 'VIEWER' }),
      });
      const loginRes = await login(loginReq);
      expect(loginRes.status).toBe(200);
      const cookieHeader = loginRes.headers.get('set-cookie')!;
      const token = cookieHeader.split(';')[0].replace('recoverflow_session=', '');

      const req = createReq('http://localhost:3000/api/recovery/execute', {
        token,
      });
      const res = await authorizeRequest(req, 'recovery:execute');
      expect(res.authorized).toBe(false);
      expect(res.response?.status).toBe(403);
    });

    it('rejects cross-site cookie authenticated POST requests with 403 (CSRF protection)', async () => {
      const loginReq = new NextRequest('http://localhost:3000/api/auth/session', {
        method: 'POST',
        headers: { origin: 'http://localhost:3000' },
        body: JSON.stringify({ method: 'demo', role: 'ADMIN' }),
      });
      const loginRes = await login(loginReq);
      const cookie = loginRes.headers.get('set-cookie')!.split(';')[0];

      const req = createReq('http://localhost:3000/api/recovery/execute', {
        method: 'POST',
        cookie,
        origin: 'https://malicious-site.attacker',
        secFetchSite: 'cross-site',
      });
      const res = await authorizeRequest(req, 'recovery:execute');
      expect(res.authorized).toBe(false);
      expect(res.response?.status).toBe(403);
    });
  });
});
