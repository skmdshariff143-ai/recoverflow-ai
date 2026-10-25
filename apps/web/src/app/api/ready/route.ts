import { NextResponse } from 'next/server';
import Redis from 'ioredis';
import { getRuntimeMode } from '../../../../../../packages/core/src/data/databaseFactory';
import { db } from '@/lib/server/database';
import { validateAuthSecret } from '../../../../../../packages/core/src/auth';

export async function GET() {
  const subsystems: Record<string, { status: string; latencyMs?: number }> = {};
  let ready = true;
  let mode = 'UNKNOWN';
  try {
    mode = getRuntimeMode();
    const health = await db.getHealth();
    subsystems.database = { status: health.status === 'healthy' ? 'READY' : 'UNAVAILABLE', latencyMs: health.latencyMs };
    ready = health.status === 'healthy';
    try { validateAuthSecret(); subsystems.authentication = { status: 'READY' }; }
    catch { subsystems.authentication = { status: 'MISCONFIGURED' }; ready = false; }
    if (mode === 'LIVE' || mode === 'SANDBOX') {
      if (!process.env.REDIS_URL) { subsystems.redis = { status: 'NOT_CONFIGURED' }; ready = false; }
      else {
        const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, connectTimeout: 2000, commandTimeout: 2000, maxRetriesPerRequest: 0, retryStrategy: () => null });
        redis.on('error', () => {});
        const start = Date.now();
        try { await redis.connect(); await redis.ping(); subsystems.redis = { status: 'READY', latencyMs: Date.now() - start }; }
        catch { subsystems.redis = { status: 'UNAVAILABLE' }; ready = false; }
        finally { redis.disconnect(); }
      }
    } else subsystems.redis = { status: 'NOT_REQUIRED_IN_DEMO' };
    subsystems.domainEngine = { status: 'READY' };
    subsystems.gemini = { status: process.env.GEMINI_API_KEY ? 'CONFIGURED_NOT_PROBED' : 'OPTIONAL_NOT_CONFIGURED' };
  } catch { ready = false; subsystems.configuration = { status: 'UNAVAILABLE' }; }
  return NextResponse.json({ data: { status: ready ? 'ready' : 'degraded', mode, subsystems, timestamp: new Date().toISOString() }, error: null, meta: { requestId: crypto.randomUUID() } }, { status: ready ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
