import { describe, it, expect } from 'vitest';
import {
  createSessionToken,
  verifySessionToken,
  hasMinimumRole,
  hasPermission,
  assertTenantScoping,
  extractTokenFromHeaders,
  getTenantContext,
  requireTenantContext,
  requirePermission,
  DEMO_PERSONA_SESSIONS,
  type UserRole,
} from '@recoverflow/core';

describe('RecoverFlow AI — Session Authentication & RBAC Security Matrix', () => {
  const secret = 'test_secret_for_cryptographic_verification_key_32';

  it('creates and successfully verifies valid session token', () => {
    const sessionPayload = {
      userId: 'usr_test_001',
      email: 'operator@fintech.com',
      name: 'Test Operator',
      organizationId: 'org_acme_corp',
      organizationSlug: 'acme-corp',
      activeMerchantId: 'merchant_99',
      role: 'RECOVERY_MANAGER' as UserRole,
    };

    const token = createSessionToken(sessionPayload, 60000, secret);
    expect(token).toContain('.');

    const result = verifySessionToken(token, secret);
    expect(result.valid).toBe(true);
    expect(result.session).not.toBeNull();
    expect(result.session?.userId).toBe('usr_test_001');
    expect(result.session?.role).toBe('RECOVERY_MANAGER');
    expect(result.session?.activeMerchantId).toBe('merchant_99');
  });

  it('rejects tampered session tokens', () => {
    const token = createSessionToken(
      {
        userId: 'usr_normal',
        email: 'user@test.com',
        name: 'Normal User',
        organizationId: 'org_1',
        organizationSlug: 'org-1',
        activeMerchantId: 'm_1',
        role: 'VIEWER',
      },
      60000,
      secret,
    );

    const [payload, sig] = token.split('.');
    // Tamper with payload (elevate role to OWNER)
    const raw = Buffer.from(payload, 'base64url').toString('utf-8');
    const tamperedObj = JSON.parse(raw);
    tamperedObj.role = 'OWNER';
    const tamperedPayload = Buffer.from(JSON.stringify(tamperedObj), 'utf-8').toString('base64url');
    const tamperedToken = `${tamperedPayload}.${sig}`;

    const result = verifySessionToken(tamperedToken, secret);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('INVALID_SIGNATURE');
    expect(result.session).toBeNull();
  });

  it('rejects expired session tokens', () => {
    const token = createSessionToken(
      {
        userId: 'usr_expired',
        email: 'exp@test.com',
        name: 'Expired User',
        organizationId: 'org_1',
        organizationSlug: 'org-1',
        activeMerchantId: 'm_1',
        role: 'ANALYST',
      },
      -1000, // already expired
      secret,
    );

    const result = verifySessionToken(token, secret);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('EXPIRED_TOKEN');
  });

  it('enforces strict role hierarchy across 7 roles', () => {
    expect(hasMinimumRole('OWNER', 'VIEWER')).toBe(true);
    expect(hasMinimumRole('OWNER', 'RECOVERY_MANAGER')).toBe(true);
    expect(hasMinimumRole('RECOVERY_MANAGER', 'ADMIN')).toBe(false);
    expect(hasMinimumRole('SUPPORT_AGENT', 'RECOVERY_MANAGER')).toBe(false);
    expect(hasMinimumRole('DEVELOPER', 'SUPPORT_AGENT')).toBe(false);
    expect(hasMinimumRole('ANALYST', 'DEVELOPER')).toBe(false);
    expect(hasMinimumRole('VIEWER', 'VIEWER')).toBe(true);
  });

  it('enforces granular permission matrix across all 7 roles', () => {
    // OWNER has all permissions
    expect(hasPermission('OWNER', 'recovery:execute')).toBe(true);
    expect(hasPermission('OWNER', 'team:manage')).toBe(true);
    expect(hasPermission('OWNER', 'policy:modify')).toBe(true);
    expect(hasPermission('OWNER', 'developer:manage_keys')).toBe(true);

    // RECOVERY_MANAGER can execute and approve, but cannot manage team/integrations
    expect(hasPermission('RECOVERY_MANAGER', 'recovery:execute')).toBe(true);
    expect(hasPermission('RECOVERY_MANAGER', 'recovery:approve_high_value')).toBe(true);
    expect(hasPermission('RECOVERY_MANAGER', 'team:manage')).toBe(false);
    expect(hasPermission('RECOVERY_MANAGER', 'integration:manage')).toBe(false);

    // SUPPORT_AGENT can intervene on support cases and view financials
    expect(hasPermission('SUPPORT_AGENT', 'support:intervene')).toBe(true);
    expect(hasPermission('SUPPORT_AGENT', 'financials:view')).toBe(true);
    expect(hasPermission('SUPPORT_AGENT', 'policy:modify')).toBe(false);
    expect(hasPermission('SUPPORT_AGENT', 'recovery:approve_high_value')).toBe(false);

    // DEVELOPER can manage keys and integrations, but cannot execute money recoveries
    expect(hasPermission('DEVELOPER', 'developer:manage_keys')).toBe(true);
    expect(hasPermission('DEVELOPER', 'integration:manage')).toBe(true);
    expect(hasPermission('DEVELOPER', 'recovery:execute')).toBe(false);
    expect(hasPermission('DEVELOPER', 'recovery:approve_high_value')).toBe(false);

    // ANALYST can view policy and financials, but cannot execute or approve
    expect(hasPermission('ANALYST', 'policy:view')).toBe(true);
    expect(hasPermission('ANALYST', 'financials:view')).toBe(true);
    expect(hasPermission('ANALYST', 'recovery:execute')).toBe(false);
    expect(hasPermission('ANALYST', 'recovery:approve_high_value')).toBe(false);

    // VIEWER is read-only
    expect(hasPermission('VIEWER', 'financials:view')).toBe(true);
    expect(hasPermission('VIEWER', 'policy:modify')).toBe(false);
    expect(hasPermission('VIEWER', 'recovery:execute')).toBe(false);
  });

  it('enforces tenant isolation and throws on cross-tenant access attempts', () => {
    const session = DEMO_PERSONA_SESSIONS.RECOVERY_MANAGER;

    // Same merchant and org -> OK
    expect(() => assertTenantScoping(session, 'merchant_default_01', 'org_recoverflow_demo')).not.toThrow();

    // Cross-merchant attempt -> throws
    expect(() => assertTenantScoping(session, 'merchant_OTHER_STORE', 'org_recoverflow_demo')).toThrow(
      /FORBIDDEN_CROSS_MERCHANT/,
    );

    // Cross-organization attempt -> throws
    expect(() => assertTenantScoping(session, 'merchant_default_01', 'org_OTHER_CORP')).toThrow(
      /FORBIDDEN_CROSS_TENANT/,
    );

    // Unauthenticated attempt -> throws
    expect(() => assertTenantScoping(null, 'merchant_default_01')).toThrow(
      /UNAUTHENTICATED/,
    );
  });

  it('extracts session tokens from multiple HTTP header patterns', () => {
    const rawToken = createSessionToken(DEMO_PERSONA_SESSIONS.ADMIN, 60000, secret);

    // 1. Direct Bearer header in Record
    expect(extractTokenFromHeaders({ authorization: `Bearer ${rawToken}` })).toBe(rawToken);

    // 2. Custom header in Record
    expect(extractTokenFromHeaders({ 'x-session-token': rawToken })).toBe(rawToken);

    // 3. Cookie header in Record
    expect(extractTokenFromHeaders({ cookie: `foo=bar; recoverflow_session=${rawToken}; theme=dark` })).toBe(rawToken);

    // 4. Raw string
    expect(extractTokenFromHeaders(`Bearer ${rawToken}`)).toBe(rawToken);
    expect(extractTokenFromHeaders(rawToken)).toBe(rawToken);

    // 5. Null or empty
    expect(extractTokenFromHeaders(null)).toBeNull();
    expect(extractTokenFromHeaders({})).toBeNull();
  });

  it('resolves tenant context via getTenantContext and requireTenantContext', () => {
    const token = createSessionToken(DEMO_PERSONA_SESSIONS.RECOVERY_MANAGER, 60000, secret);

    // getTenantContext with valid header
    const resolved = getTenantContext({ authorization: `Bearer ${token}` }, secret);
    expect(resolved).not.toBeNull();
    expect(resolved?.role).toBe('RECOVERY_MANAGER');
    expect(resolved?.activeMerchantId).toBe('merchant_default_01');

    // getTenantContext with missing header
    expect(getTenantContext({}, secret)).toBeNull();

    // requireTenantContext with matching merchant
    const required = requireTenantContext({ authorization: `Bearer ${token}` }, 'merchant_default_01', undefined, secret);
    expect(required.userId).toBe(DEMO_PERSONA_SESSIONS.RECOVERY_MANAGER.userId);

    // requireTenantContext with cross-merchant -> throws
    expect(() => requireTenantContext({ authorization: `Bearer ${token}` }, 'merchant_OTHER', undefined, secret)).toThrow(
      /FORBIDDEN_CROSS_MERCHANT/,
    );

    // requireTenantContext unauthenticated -> throws
    expect(() => requireTenantContext({}, 'merchant_default_01', undefined, secret)).toThrow(
      /UNAUTHENTICATED/,
    );
  });

  it('enforces granular permissions via requirePermission', () => {
    const ownerSession = DEMO_PERSONA_SESSIONS.OWNER;
    const viewerSession = DEMO_PERSONA_SESSIONS.VIEWER;

    // Allowed permission should not throw
    expect(() => requirePermission(ownerSession, 'recovery:execute')).not.toThrow();
    expect(() => requirePermission(viewerSession, 'financials:view')).not.toThrow();

    // Forbidden permission should throw
    expect(() => requirePermission(viewerSession, 'recovery:execute')).toThrow(
      /FORBIDDEN_PERMISSION/,
    );

    // Null session should throw
    expect(() => requirePermission(null, 'financials:view')).toThrow(
      /UNAUTHENTICATED/,
    );
  });
});

