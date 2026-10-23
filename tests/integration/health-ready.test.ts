import { describe, it, expect } from 'vitest';
import { GET as healthGet } from '../../apps/web/src/app/api/health/route';
import { GET as readyGet } from '../../apps/web/src/app/api/ready/route';

describe('RecoverFlow AI — Health & Readiness Probes', () => {
  it('returns healthy status with system telemetry from /api/health', async () => {
    const res = await healthGet();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.status).toBe('healthy');
    expect(json.data.service).toBe('recoverflow-ai-web');
    expect(json.data.version).toBe('0.1.0');
    expect(json.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(json.meta.requestId).toBeDefined();
    expect(json.error).toBeNull();
  });

  it('returns ready status with subsystem checks from /api/ready', async () => {
    const res = await readyGet();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.status).toBe('ready');
    expect(json.data.subsystems.domainEngine.status).toBe('READY');
    expect(json.data.subsystems.database.status).toBe('READY');
    expect(json.data.subsystems.authentication.status).toBe('READY');
    expect(json.data.subsystems.redis.status).toBe('NOT_REQUIRED_IN_DEMO');
    expect(json.meta.requestId).toBeDefined();
    expect(json.error).toBeNull();
  });
});
