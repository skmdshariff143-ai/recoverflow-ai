import { NextRequest, NextResponse } from 'next/server';
import { db } from './database';
import { extractTokenFromHeaders, verifySessionToken, hashSessionToken, hasPermission, type Permission, type UserSession } from '@recoverflow/core';
import { getRuntimeMode } from '@recoverflow/core';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const target = new URL(request.url);
  // Next's internal request URL can use localhost when bound to 127.0.0.1.
  // Host reflects the browser's origin; deployments can pin APP_URL explicitly.
  if (request.headers.get('host')) target.host = request.headers.get('host')!;
  const expected = process.env.APP_URL ? new URL(process.env.APP_URL).origin : target.origin;
  if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== expected)) {
    throw new ApiError(403, 'This request must originate from your workspace.');
  }
  if (request.headers.has('cookie') && !origin && !['same-origin', 'none'].includes(request.headers.get('sec-fetch-site') ?? '')) {
    throw new ApiError(403, 'An origin is required for cookie-authenticated changes.');
  }
}

export async function readSession(headers: Headers): Promise<UserSession | null> {
  const token = extractTokenFromHeaders(headers);
  if (!token) return null;
  const { valid, session } = verifySessionToken(token);
  if (!valid || !session || session.runtimeMode !== getRuntimeMode()) return null;
  const stored = await db.getSession(hashSessionToken(token));
  if (!stored || stored.isRevoked || new Date(stored.expiresAt).getTime() <= Date.now() ||
      stored.userId !== session.userId || stored.organizationId !== session.organizationId ||
      stored.activeMerchantId !== session.activeMerchantId || stored.role !== session.role) return null;
  if (db.isDurable || session.runtimeMode === 'LIVE' || session.runtimeMode === 'SANDBOX') {
    const membership = await db.getMembership(session.userId, session.organizationId);
    const merchant = await db.getMerchant(session.activeMerchantId);
    if (!membership || membership.role !== session.role || merchant?.organizationId !== session.organizationId) return null;
  }
  return session;
}

export async function requireSession(request: Request, permission?: Permission): Promise<UserSession> {
  const session = await readSession(request.headers);
  if (!session) throw new ApiError(401, 'Your session has expired. Please sign in again.');
  if (permission && !hasPermission(session.role, permission)) throw new ApiError(403, 'Your role does not have permission to perform this action.');
  return session;
}

export function apiError(error: unknown): NextResponse {
  if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid JSON request.' }, { status: 400 });
  console.error('[console] Request failed:', error instanceof Error ? error.name : 'Unknown error');
  return NextResponse.json({ error: 'The service is temporarily unavailable. Please try again.' }, { status: 503 });
}

export function route(handler: (request: NextRequest) => Promise<Response>) {
  return async (request: NextRequest) => {
    try {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) assertSameOrigin(request);
      const response = await handler(request);
      response.headers.set('Cache-Control', 'no-store');
      return response;
    } catch (error) { return apiError(error); }
  };
}
