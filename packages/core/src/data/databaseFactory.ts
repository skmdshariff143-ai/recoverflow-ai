/**
 * RecoverFlow AI — Explicit Database Factory & Runtime Mode Resolver
 *
 * Enforces strict fail-closed behavior in SANDBOX and LIVE modes.
 * In-memory fallback exists exclusively in DEMO and TEST modes.
 */

import type { DatabasePort } from './DatabasePort';
import { MemoryDatabase } from './MemoryDatabase';
import { PrismaDatabase } from './PrismaDatabase';

export type RuntimeMode = 'DEMO' | 'SANDBOX' | 'LIVE' | 'TEST';

export class StartupConfigurationError extends Error {
  constructor(message: string) {
    super(`[STARTUP CONFIGURATION ERROR] ${message}`);
    this.name = 'StartupConfigurationError';
  }
}

let databaseSingleton: DatabasePort | null = null;

/**
 * Resolves the active runtime mode.
 * Explicitly checked via RECOVERFLOW_RUNTIME_MODE. Defaults to DEMO if unconfigured.
 */
export function getRuntimeMode(): RuntimeMode {
  const envMode = process.env.RECOVERFLOW_RUNTIME_MODE?.toUpperCase();
  if (envMode === 'LIVE' || envMode === 'SANDBOX' || envMode === 'DEMO' || envMode === 'TEST') {
    return envMode as RuntimeMode;
  }
  if (process.env.NODE_ENV === 'test') {
    return 'TEST';
  }
  return 'DEMO';
}

/**
 * Returns the active DatabasePort implementation according to runtime mode.
 * Throws StartupConfigurationError in SANDBOX / LIVE modes if DATABASE_URL is missing.
 */
export function getDatabase(options?: { mode?: RuntimeMode; forceNew?: boolean }): DatabasePort {
  if (databaseSingleton && !options?.forceNew && !options?.mode) {
    return databaseSingleton;
  }

  const mode = options?.mode || getRuntimeMode();
  const databaseUrl = process.env.DATABASE_URL;

  if (mode === 'LIVE' || mode === 'SANDBOX') {
    if (!databaseUrl) {
      throw new StartupConfigurationError(
        `DATABASE_URL is missing in '${mode}' mode. Production runtime must not fall back to in-memory database.`
      );
    }
    const instance = new PrismaDatabase();
    if (!options?.forceNew) databaseSingleton = instance;
    return instance;
  }

  // DEMO or TEST mode
  if (mode === 'TEST' && databaseUrl && process.env.RECOVERFLOW_FORCE_PRISMA === 'true') {
    const instance = new PrismaDatabase();
    if (!options?.forceNew) databaseSingleton = instance;
    return instance;
  }

  const instance = new MemoryDatabase();
  if (!options?.forceNew) databaseSingleton = instance;
  return instance;
}

/**
 * Reset singleton (useful for isolated integration and unit test setups).
 */
export function resetDatabaseSingleton(): void {
  databaseSingleton = null;
}
