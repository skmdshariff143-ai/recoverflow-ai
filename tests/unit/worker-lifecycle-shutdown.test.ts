import { describe, it, expect, beforeEach } from 'vitest';
import { db, StartupConfigurationError } from '@recoverflow/core';
import { startWorkerRuntime, startDistributedWorkers } from '@recoverflow/jobs';

describe('RecoverFlow AI — Worker Runtime Lifecycle & Fail-Closed Guardrails', () => {
  beforeEach(() => {
    (db as any).clear?.();
  });

  it('starts unified worker runtime and executes graceful closing cleanup', async () => {
    const runtime = await startWorkerRuntime({
      workerId: 'test_worker_lifecycle_01',
      enablePruner: false,
    });

    expect(runtime.workerId).toBe('test_worker_lifecycle_01');
    expect(runtime.isClosed).toBe(false);

    // Gracefully close
    await runtime.close();
    expect(runtime.isClosed).toBe(true);
  });

  it('fails closed in LIVE mode when REDIS_URL is missing', () => {
    const originalEnv = process.env.RECOVERFLOW_RUNTIME_MODE;
    const originalRedis = process.env.REDIS_URL;

    try {
      process.env.RECOVERFLOW_RUNTIME_MODE = 'LIVE';
      delete process.env.REDIS_URL;

      expect(() => startDistributedWorkers()).toThrow(
        StartupConfigurationError,
      );
    } finally {
      process.env.RECOVERFLOW_RUNTIME_MODE = originalEnv;
      if (originalRedis) process.env.REDIS_URL = originalRedis;
    }
  });
});
