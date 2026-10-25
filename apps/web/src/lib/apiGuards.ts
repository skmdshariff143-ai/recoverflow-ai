import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getClientIp } from './http';

export interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

export interface RateLimitStore {
  get(key: string): Promise<RateLimitRecord | undefined> | RateLimitRecord | undefined;
  set(key: string, record: RateLimitRecord): Promise<void> | void;
  delete(key: string): Promise<void> | void;
  clear?(): Promise<void> | void;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private store: Map<string, RateLimitRecord>;

  constructor() {
    const g = globalThis as unknown as { __rf_rate_limit_store?: Map<string, RateLimitRecord> };
    if (!g.__rf_rate_limit_store) {
      g.__rf_rate_limit_store = new Map<string, RateLimitRecord>();
    }
    this.store = g.__rf_rate_limit_store;
  }

  get(key: string): RateLimitRecord | undefined {
    return this.store.get(key);
  }

  set(key: string, record: RateLimitRecord): void {
    this.store.set(key, record);
    this.cleanupLazy();
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  private cleanupLazy(): void {
    if (this.store.size > 500) {
      const now = Date.now();
      for (const [k, v] of this.store.entries()) {
        if (v.resetAt <= now) {
          this.store.delete(k);
        }
      }
    }
  }
}

// Global pluggable store singleton
let currentRateLimitStore: RateLimitStore = new MemoryRateLimitStore();

export function setRateLimitStore(store: RateLimitStore): void {
  currentRateLimitStore = store;
}

export function getRateLimitStore(): RateLimitStore {
  return currentRateLimitStore;
}

export async function checkRateLimit(
  identifier: string,
  limit: number = 30,
  windowMs: number = 60000
): Promise<RateLimitResult> {
  const now = Date.now();
  const store = getRateLimitStore();
  const record = await store.get(identifier);

  if (!record || record.resetAt <= now) {
    await store.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      resetInSeconds: Math.ceil(windowMs / 1000),
    };
  }

  if (record.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds: Math.max(1, Math.ceil((record.resetAt - now) / 1000)),
    };
  }

  record.count += 1;
  await store.set(identifier, record);

  return {
    allowed: true,
    remaining: Math.max(0, limit - record.count),
    resetInSeconds: Math.max(1, Math.ceil((record.resetAt - now) / 1000)),
  };
}

/**
 * Enforces sliding window rate limits using the unforgeable client IP from getClientIp.
 */
export async function enforceRateLimit(
  req: Request,
  limit: number = 30,
  windowMs: number = 60000
): Promise<NextResponse | null> {
  const clientIp = getClientIp(req);
  let pathname = '';
  try {
    pathname = new URL(req.url).pathname;
  } catch {
    pathname = 'unknown';
  }
  const key = `${pathname}:${clientIp}`;

  const result = await checkRateLimit(key, limit, windowMs);
  if (!result.allowed) {
    return NextResponse.json(
      {
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Please wait ${result.resetInSeconds}s before retrying.`,
        retryAfter: result.resetInSeconds,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(result.resetInSeconds),
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil((Date.now() + result.resetInSeconds * 1000) / 1000)),
        },
      }
    );
  }

  return null;
}

/**
 * Validates service-to-service / operator token via timing-safe comparison.
 * Never allows anonymous or demo bypass.
 */
export function requireServiceToken(req: Request): NextResponse | null {
  const tokenHeader = req.headers.get('x-admin-token') || '';
  const authHeader = req.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const supplied = tokenHeader || bearerToken;

  const expected = process.env.ADMIN_API_TOKEN;

  if (!expected) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Unauthorized: Server ADMIN_API_TOKEN is unconfigured' },
        { status: 500 }
      );
    }
  }

  if (!supplied) {
    return NextResponse.json(
      { error: 'Unauthorized: Service token required in x-admin-token or Authorization header' },
      { status: 401 }
    );
  }

  const expectedToken = expected || 'demo-admin-token';
  const suppliedBuf = Buffer.from(supplied);
  const expectedBuf = Buffer.from(expectedToken);

  if (suppliedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(suppliedBuf, expectedBuf)) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid service token' },
      { status: 403 }
    );
  }

  return null;
}

export const requireAdminToken = requireServiceToken;

export async function enforceRouteAuth(
  req: Request,
  opts?: { allowDemoSimulation?: boolean; requiresLiveCredentials?: boolean }
): Promise<NextResponse | null> {
  const runtimeMode = process.env.RECOVERFLOW_RUNTIME_MODE || 'DEMO';
  const isDemo = runtimeMode === 'DEMO';

  if (opts?.requiresLiveCredentials) {
    return requireServiceToken(req);
  }

  if (isDemo && opts?.allowDemoSimulation) {
    return null;
  }

  if (!isDemo) {
    return requireServiceToken(req);
  }

  if (opts?.allowDemoSimulation !== false) {
    return null;
  }

  return requireServiceToken(req);
}
