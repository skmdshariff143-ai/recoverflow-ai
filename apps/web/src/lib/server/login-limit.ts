import { createHash } from 'node:crypto';
import Redis from 'ioredis';
import { checkRateLimit } from '../../../../../packages/core/src/rateLimiter';
import { getRuntimeMode } from '../../../../../packages/core/src/data/databaseFactory';
import { ApiError } from './access';

let redis: Redis | undefined;
export async function limitLogin(email: string) {
  const key = `auth:login:${createHash('sha256').update(email.toLowerCase()).digest('hex')}`;
  const mode = getRuntimeMode();
  if (mode === 'DEMO' || mode === 'TEST') {
    if (!checkRateLimit(key, 10, 15 * 60 * 1000).allowed) throw new ApiError(429, 'Too many sign-in attempts. Try again in 15 minutes.');
    return;
  }
  if (!process.env.REDIS_URL) throw new ApiError(503, 'Sign-in requires the configured Redis service.');
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 3000, enableOfflineQueue: false, lazyConnect: true });
    redis.on('error', () => {});
  }
  if (redis.status === 'wait') await redis.connect();
  const count = Number(await redis.eval("local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], 900) end; return n", 1, key));
  if (count > 10) throw new ApiError(429, 'Too many sign-in attempts. Try again in 15 minutes.');
}
