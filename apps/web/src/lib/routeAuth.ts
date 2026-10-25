import { NextResponse } from 'next/server';
import {
  getRuntimeMode,
  extractTokenFromHeaders,
  verifyDurableSession,
  hasPermission,
  DEMO_PERSONA_SESSIONS,
  type Permission,
  type UserSession,
} from '@recoverflow/core';

/**
 * Returns true ONLY if RECOVERFLOW_ALLOW_ANON_DEMO is 'true'
 * AND the runtime mode is 'DEMO' or 'TEST'.
 * Always returns false in 'SANDBOX' or 'LIVE'.
 */
export function isAnonymousDemoEnabled(): boolean {
  if (process.env.RECOVERFLOW_ALLOW_ANON_DEMO !== 'true') return false;
  const mode = getRuntimeMode();
  return mode === 'DEMO' || mode === 'TEST';
}

export interface AuthorizeOptions {
  allowAnonymousDemo?: boolean;
}

export type AuthorizeResult =
  | { authorized: true; session: UserSession; response?: never }
  | { authorized: false; response: NextResponse; session?: never };

/**
 * Authorizes an incoming Next.js API request against a required permission.
 * Validates cryptographic signature and durable session revocation.
 * Falls back to DEMO_PERSONA_SESSIONS.RECOVERY_MANAGER if anonymous demo is allowed and enabled.
 */
export async function authorizeRequest(
  req: Request,
  permission: Permission,
  options?: AuthorizeOptions
): Promise<AuthorizeResult> {
  const token = extractTokenFromHeaders(req.headers);

  if (!token) {
    if (options?.allowAnonymousDemo && isAnonymousDemoEnabled()) {
      return {
        authorized: true,
        session: DEMO_PERSONA_SESSIONS.RECOVERY_MANAGER,
      };
    }
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Unauthorized: Authentication required.' },
        { status: 401 }
      ),
    };
  }

  const verification = await verifyDurableSession(token);
  if (!verification.valid || !verification.session) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Unauthorized: Session invalid, expired, or revoked.' },
        { status: 401 }
      ),
    };
  }

  const session = verification.session;
  if (!hasPermission(session.role, permission)) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: `Forbidden: Role '${session.role}' lacks '${permission}' permission.` },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    session,
  };
}
