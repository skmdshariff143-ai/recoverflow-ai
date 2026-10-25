import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db } from '../../packages/core/src/db';
import { hashPassword } from '../../packages/core/src/password';
import { POST as login } from '../../apps/web/src/app/api/auth/session/route';
import { readSession } from '../../apps/web/src/lib/server/access';

// Exercise the durable identity rules against isolated fixtures. Redis and
// PostgreSQL transport are separate infrastructure contracts, not mocked here as passing.
vi.mock('../../apps/web/src/lib/server/login-limit', () => ({ limitLogin: vi.fn() }));
const password = 'console-unit-only-password';
const request = (body: unknown) => new NextRequest('http://localhost:3000/api/auth/session', { method: 'POST', headers: { origin: 'http://localhost:3000', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
let userId: string;
let organizationId: string;

describe('Credential sign-in and current membership validation', () => {
  beforeEach(async () => {
    db.clear?.(); db.seedDefaults?.();
    vi.stubEnv('RECOVERFLOW_RUNTIME_MODE', 'SANDBOX');
    vi.stubEnv('AUTH_SECRET', 'unit-test-only-secret-with-at-least-thirty-two-characters');
    vi.stubEnv('APP_URL', 'http://localhost:3000');
    const user = await db.createUser({ email: 'owner@example.test', passwordHash: await hashPassword(password) });
    const organization = await db.createOrganization({ name: 'Unit workspace', slug: 'unit-workspace' });
    userId = user.id; organizationId = organization.id;
    await db.createMembership({ userId, organizationId, role: 'OWNER' });
    const merchant = await db.getMerchant('merchant_default_01');
    await db.upsertMerchant({ ...merchant!, organizationId });
  });
  afterEach(() => vi.unstubAllEnvs());
  it('authenticates provisioned credentials and rejects demo personas', async () => {
    const response = await login(request({ method: 'password', email: 'owner@example.test', password, organization: 'unit-workspace' }));
    expect(response.status).toBe(200);
    const headers = new Headers({ cookie: response.headers.get('set-cookie')!.split(';')[0] });
    expect(await readSession(headers)).toMatchObject({ userId, organizationId, role: 'OWNER', runtimeMode: 'SANDBOX' });
    expect((await login(request({ method: 'demo', role: 'OWNER' }))).status).toBe(403);
  });
  it('returns the same error for bad credentials and an unassigned workspace', async () => {
    const wrongPassword = await login(request({ method: 'password', email: 'owner@example.test', password: 'wrong-password', organization: 'unit-workspace' }));
    const wrongWorkspace = await login(request({ method: 'password', email: 'owner@example.test', password, organization: 'another-workspace' }));
    expect(wrongPassword.status).toBe(401); expect(wrongWorkspace.status).toBe(401);
    expect(await wrongPassword.json()).toEqual(await wrongWorkspace.json());
  });
  it('invalidates a session when the operator role or merchant assignment changes', async () => {
    const response = await login(request({ method: 'password', email: 'owner@example.test', password, organization: 'unit-workspace' }));
    const headers = new Headers({ cookie: response.headers.get('set-cookie')!.split(';')[0] });
    const membership = await db.getMembership(userId, organizationId);
    membership!.role = 'VIEWER';
    expect(await readSession(headers)).toBeNull();
    membership!.role = 'OWNER';
    const merchant = await db.getMerchant('merchant_default_01');
    await db.upsertMerchant({ ...merchant!, organizationId: 'different-organization' });
    expect(await readSession(headers)).toBeNull();
  });
});
