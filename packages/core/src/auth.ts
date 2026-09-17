/**
 * RecoverFlow AI — Authentication, Session Security & Multi-Tenant RBAC Matrix.
 *
 * Implements cryptographic session token management, role-based authorization,
 * and tenant-isolation invariants.
 */

import { createHmac, timingSafeEqual } from 'crypto';

export type UserRole = 'OWNER' | 'ADMIN' | 'RECOVERY_MANAGER' | 'SUPPORT_AGENT' | 'DEVELOPER' | 'ANALYST' | 'VIEWER';

export interface UserSession {
  userId: string;
  email: string;
  name: string;
  organizationId: string;
  organizationSlug: string;
  activeMerchantId: string;
  role: UserRole;
  expiresAt: number; // UNIX timestamp ms
  issuedAt: number;
}

export type Permission =
  | 'recovery:execute'
  | 'recovery:approve_high_value'
  | 'policy:modify'
  | 'policy:view'
  | 'audit:view'
  | 'audit:export'
  | 'team:manage'
  | 'integration:manage'
  | 'developer:manage_keys'
  | 'support:intervene'
  | 'financials:view';

const ROLE_PERMISSIONS: Record<UserRole, Set<Permission>> = {
  OWNER: new Set([
    'recovery:execute',
    'recovery:approve_high_value',
    'policy:modify',
    'policy:view',
    'audit:view',
    'audit:export',
    'team:manage',
    'integration:manage',
    'developer:manage_keys',
    'support:intervene',
    'financials:view',
  ]),
  ADMIN: new Set([
    'recovery:execute',
    'recovery:approve_high_value',
    'policy:modify',
    'policy:view',
    'audit:view',
    'audit:export',
    'team:manage',
    'integration:manage',
    'developer:manage_keys',
    'support:intervene',
    'financials:view',
  ]),
  RECOVERY_MANAGER: new Set([
    'recovery:execute',
    'recovery:approve_high_value',
    'policy:modify',
    'policy:view',
    'audit:view',
    'audit:export',
    'support:intervene',
    'financials:view',
  ]),
  SUPPORT_AGENT: new Set([
    'policy:view',
    'audit:view',
    'support:intervene',
    'financials:view',
  ]),
  DEVELOPER: new Set([
    'policy:view',
    'audit:view',
    'integration:manage',
    'developer:manage_keys',
  ]),
  ANALYST: new Set([
    'policy:view',
    'audit:view',
    'audit:export',
    'financials:view',
  ]),
  VIEWER: new Set([
    'policy:view',
    'audit:view',
    'financials:view',
  ]),
};

const ROLE_HIERARCHY: Record<UserRole, number> = {
  OWNER: 50,
  ADMIN: 40,
  RECOVERY_MANAGER: 30,
  SUPPORT_AGENT: 25,
  DEVELOPER: 20,
  ANALYST: 15,
  VIEWER: 10,
};

const DEFAULT_AUTH_SECRET = process.env.AUTH_SECRET || 'recoverflow_auth_secret_dev_32_bytes_min_sig';

/**
 * Check if a role satisfies a minimum role requirement in the hierarchy.
 */
export function hasMinimumRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 0);
}

/**
 * Check if a user role has a specific permission.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

/**
 * Mint a cryptographically signed HMAC-SHA256 session token.
 */
export function createSessionToken(
  session: Omit<UserSession, 'expiresAt' | 'issuedAt'>,
  ttlMs: number = 7 * 24 * 60 * 60 * 1000,
  secret: string = DEFAULT_AUTH_SECRET,
): string {
  const now = Date.now();
  const fullSession: UserSession = {
    ...session,
    issuedAt: now,
    expiresAt: now + ttlMs,
  };

  const payload = Buffer.from(JSON.stringify(fullSession), 'utf-8').toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

/**
 * Verify and decode an HMAC-SHA256 session token.
 */
export function verifySessionToken(
  token: string | null | undefined,
  secret: string = DEFAULT_AUTH_SECRET,
): { valid: boolean; session: UserSession | null; error?: string } {
  if (!token || typeof token !== 'string') {
    return { valid: false, session: null, error: 'MISSING_TOKEN' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, session: null, error: 'MALFORMED_TOKEN' };
  }

  const [payloadBase64, providedSig] = parts;
  const expectedSig = createHmac('sha256', secret).update(payloadBase64).digest('base64url');

  const providedBuf = Buffer.from(providedSig, 'utf-8');
  const expectedBuf = Buffer.from(expectedSig, 'utf-8');

  if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
    return { valid: false, session: null, error: 'INVALID_SIGNATURE' };
  }

  try {
    const raw = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
    const session = JSON.parse(raw) as UserSession;

    if (Date.now() > session.expiresAt) {
      return { valid: false, session: null, error: 'EXPIRED_TOKEN' };
    }

    return { valid: true, session };
  } catch {
    return { valid: false, session: null, error: 'CORRUPTED_PAYLOAD' };
  }
}

/**
 * Enforce multi-tenant access control invariant.
 * Throws if the active session does not own or have access to the target merchant.
 */
export function assertTenantScoping(
  session: UserSession | null,
  targetMerchantId: string,
  targetOrgId?: string,
): void {
  if (!session) {
    throw new Error('UNAUTHENTICATED: Active session required for tenant-scoped operations');
  }

  if (targetOrgId && session.organizationId !== targetOrgId) {
    throw new Error(`FORBIDDEN_CROSS_TENANT: User org '${session.organizationId}' cannot access org '${targetOrgId}'`);
  }

  if (session.activeMerchantId !== targetMerchantId) {
    throw new Error(`FORBIDDEN_CROSS_MERCHANT: User active merchant '${session.activeMerchantId}' does not match '${targetMerchantId}'`);
  }
}

/**
 * Pre-defined demo persona sessions for instant evaluator walkthrough.
 */
export const DEMO_PERSONA_SESSIONS: Record<UserRole, UserSession> = {
  OWNER: {
    userId: 'usr_owner_demo_01',
    email: 'sarah.cfo@luxurybrand.com',
    name: 'Sarah Jenkins (CFO / Owner)',
    organizationId: 'org_recoverflow_demo',
    organizationSlug: 'luxurybrand-enterprise',
    activeMerchantId: 'merchant_01',
    role: 'OWNER',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  },
  ADMIN: {
    userId: 'usr_admin_demo_02',
    email: 'alex.ops@luxurybrand.com',
    name: 'Alex Rivera (VP Operations)',
    organizationId: 'org_recoverflow_demo',
    organizationSlug: 'luxurybrand-enterprise',
    activeMerchantId: 'merchant_01',
    role: 'ADMIN',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  },
  RECOVERY_MANAGER: {
    userId: 'usr_mgr_demo_03',
    email: 'priya.lead@luxurybrand.com',
    name: 'Priya Sharma (Recovery Operations Lead)',
    organizationId: 'org_recoverflow_demo',
    organizationSlug: 'luxurybrand-enterprise',
    activeMerchantId: 'merchant_01',
    role: 'RECOVERY_MANAGER',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  },
  SUPPORT_AGENT: {
    userId: 'usr_support_demo_06',
    email: 'sam.support@luxurybrand.com',
    name: 'Sam Taylor (Customer Support Lead)',
    organizationId: 'org_recoverflow_demo',
    organizationSlug: 'luxurybrand-enterprise',
    activeMerchantId: 'merchant_01',
    role: 'SUPPORT_AGENT',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  },
  DEVELOPER: {
    userId: 'usr_dev_demo_07',
    email: 'jordan.dev@luxurybrand.com',
    name: 'Jordan Lee (Integration Engineer)',
    organizationId: 'org_recoverflow_demo',
    organizationSlug: 'luxurybrand-enterprise',
    activeMerchantId: 'merchant_01',
    role: 'DEVELOPER',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  },
  ANALYST: {
    userId: 'usr_analyst_demo_04',
    email: 'david.data@luxurybrand.com',
    name: 'David Chen (Risk & Recovery Analyst)',
    organizationId: 'org_recoverflow_demo',
    organizationSlug: 'luxurybrand-enterprise',
    activeMerchantId: 'merchant_01',
    role: 'ANALYST',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  },
  VIEWER: {
    userId: 'usr_viewer_demo_05',
    email: 'evaluator.guest@fintech-review.org',
    name: 'Guest Judge / Auditor',
    organizationId: 'org_recoverflow_demo',
    organizationSlug: 'luxurybrand-enterprise',
    activeMerchantId: 'merchant_01',
    role: 'VIEWER',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  },
};
