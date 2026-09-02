/**
 * PayBack AI — In-Memory Token-Bucket Rate Limiter for Live Demo & Trigger Endpoints.
 *
 * Prevents automated spam and abuse during live judge presentations while allowing
 * genuine multi-user audience participation (default: 15 triggers per minute per client).
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up expired buckets periodically (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (record.resetAt <= now) {
        rateLimitStore.delete(key);
      }
    }
  }, 300000);
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

export function checkRateLimit(
  identifier: string,
  limit: number = 15,
  windowMs: number = 60000,
): RateLimitResult {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || record.resetAt <= now) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      allowed: true,
      remaining: limit - 1,
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
  return {
    allowed: true,
    remaining: limit - record.count,
    resetInSeconds: Math.max(1, Math.ceil((record.resetAt - now) / 1000)),
  };
}
