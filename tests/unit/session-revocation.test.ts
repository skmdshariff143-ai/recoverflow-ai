import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  createSessionToken,
  registerDurableSession,
  verifyDurableSession,
  DEMO_PERSONA_SESSIONS,
  type UserSession,
} from '@recoverflow/core';

describe('RecoverFlow AI — Durable Session Revocation Matrix', () => {
  beforeEach(() => {
    (db as any).clear?.();
  });

  it('verifies active durable session and tracks in store', async () => {
    const sessionPayload = {
      ...DEMO_PERSONA_SESSIONS.RECOVERY_MANAGER,
      userId: 'usr_revoc_test_01',
    };

    const token = createSessionToken(sessionPayload, 60000);
    const decoded = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf-8')) as UserSession;

    await registerDurableSession(decoded, token);

    const verified = await verifyDurableSession(token);
    expect(verified.valid).toBe(true);
    expect(verified.session?.userId).toBe('usr_revoc_test_01');
  });

  it('instantly invalidates revoked session on logout', async () => {
    const sessionPayload = {
      ...DEMO_PERSONA_SESSIONS.ADMIN,
      userId: 'usr_revoc_test_02',
    };

    const token = createSessionToken(sessionPayload, 60000);
    const decoded = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf-8')) as UserSession;

    await registerDurableSession(decoded, token);

    // Initial check: Valid
    let verified = await verifyDurableSession(token);
    expect(verified.valid).toBe(true);

    // Revoke session
    const registered = await db.getSession(Buffer.from(require('crypto').createHash('sha256').update(token).digest('hex')).toString());
    if (registered) {
      await db.revokeSession(registered.id, 'User explicit logout');
    }

    // Post-revocation check: Rejected
    verified = await verifyDurableSession(token);
    expect(verified.valid).toBe(false);
    expect(verified.error).toBe('SESSION_REVOKED');
  });

  it('revokes all sessions across devices for a compromised user', async () => {
    const sessionPayload = {
      ...DEMO_PERSONA_SESSIONS.SUPPORT_AGENT,
      userId: 'usr_compromised_01',
    };

    const tokenDeviceA = createSessionToken(sessionPayload, 60000);
    const tokenDeviceB = createSessionToken(sessionPayload, 60000);

    const decodedA = JSON.parse(Buffer.from(tokenDeviceA.split('.')[0], 'base64url').toString('utf-8')) as UserSession;
    const decodedB = JSON.parse(Buffer.from(tokenDeviceB.split('.')[0], 'base64url').toString('utf-8')) as UserSession;

    await registerDurableSession(decodedA, tokenDeviceA);
    await registerDurableSession(decodedB, tokenDeviceB);

    // Both valid
    expect((await verifyDurableSession(tokenDeviceA)).valid).toBe(true);
    expect((await verifyDurableSession(tokenDeviceB)).valid).toBe(true);

    // Global revocation (e.g. password reset / compromise)
    const revokedCount = await db.revokeAllUserSessions('usr_compromised_01', 'Credential compromised');
    expect(revokedCount).toBe(2);

    // Both now rejected
    expect((await verifyDurableSession(tokenDeviceA)).valid).toBe(false);
    expect((await verifyDurableSession(tokenDeviceB)).valid).toBe(false);
  });
});
