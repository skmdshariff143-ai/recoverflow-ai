import { NextResponse } from 'next/server';

/**
 * Extracts client IP preferring trusted edge proxy headers,
 * falling back to the LAST entry in X-Forwarded-For (never the first,
 * which is client-controllable and susceptible to spoofing).
 */
export function getClientIp(req: Request): string {
  const vercelForwarded = req.headers.get('x-vercel-forwarded-for');
  if (vercelForwarded && vercelForwarded.trim().length > 0) {
    return vercelForwarded.trim();
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp && realIp.trim().length > 0) {
    return realIp.trim();
  }

  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (parts.length > 0) {
      // Outermost trusted proxy appends to the end of the list
      return parts[parts.length - 1];
    }
  }

  return '127.0.0.1';
}

/**
 * Logs the error server-side and returns a generic 500 error response
 * that never leaks stack traces or internal implementation details.
 */
export function internalErrorResponse(
  label: string,
  err: unknown,
  publicMessage = 'An unexpected internal server error occurred.'
): NextResponse {
  console.error(`[${label}] Internal error:`, err);
  return NextResponse.json(
    { error: publicMessage },
    { status: 500 }
  );
}
