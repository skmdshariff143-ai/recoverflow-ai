import { NextResponse } from 'next/server';
import {
  getRuntimeMode,
  extractTokenFromHeaders,
  hasPermission,
  DEMO_PERSONA_SESSIONS,
  type Permission,
  type UserSession,
} from '@recoverflow/core';
import { readSession, assertSameOrigin, ApiError } from './server/access';

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
 * Delegates to readSession to enforce runtime-mode binding, db.getSession,
 * organization membership (LIVE/SANDBOX) and durable session revocation in one place.
 * Enforces same-origin CSRF on state-changing methods authenticated by cookie.
 * If credentials are present but invalid, returns 401 and NEVER falls back to demo persona.
 * Uses DEMO_PERSONA_SESSIONS.RECOVERY_MANAGER only when no credential was sent,
 * the route allows demo, and isAnonymousDemoEnabled() is true.
 */
export async function authorizeRequest(
  req: Request,
  permission: Permission,
  options?: AuthorizeOptions
): Promise<AuthorizeResult> {
  const token = extractTokenFromHeaders(req.headers);

  // If ANY credential was provided (Bearer token or cookie):
  if (token) {
    try {
      const session = await readSession(req.headers);
      if (!session) {
        return {
          authorized: false,
          response: NextResponse.json(
            { error: 'Unauthorized: Session invalid, expired, or revoked.' },
            { status: 401 }
          ),
        };
      }

      // Check granular RBAC permission
      if (!hasPermission(session.role, permission)) {
        return {
          authorized: false,
          response: NextResponse.json(
            { error: `Forbidden: Role '${session.role}' lacks '${permission}' permission.` },
            { status: 403 }
          ),
        };
      }

      // For state-changing methods authenticated by cookie, enforce CSRF/same-origin protection
      const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());
      const rawCookie = req.headers.get('cookie') || req.headers.get('Cookie');

      if (isStateChanging && rawCookie) {
        try {
          assertSameOrigin(req);
        } catch (originErr) {
          if (originErr instanceof ApiError) {
            return {
              authorized: false,
              response: NextResponse.json(
                { error: originErr.message },
                { status: originErr.status }
              ),
            };
          }
          return {
            authorized: false,
            response: NextResponse.json(
              { error: 'Forbidden: Cross-site request rejected.' },
              { status: 403 }
            ),
          };
        }
      }

      return {
        authorized: true,
        session,
      };
    } catch {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: 'Unauthorized: Session validation failed.' },
          { status: 401 }
        ),
      };
    }
  }

  // NO credential was sent
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
