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

// Next.js can load the API and server-component bundles independently. Keep the
// in-process adapter shared across those bundles (and development hot reloads).
const databaseState = globalThis as unknown as { recoverflowDatabase?: DatabasePort; recoverflowDatabaseMode?: RuntimeMode };

/**
 * Resolves the active runtime mode.
 * Explicitly checked via RECOVERFLOW_RUNTIME_MODE. Defaults to DEMO if unconfigured.
 */
export function getRuntimeMode(): RuntimeMode {
  const envMode = process.env.RECOVERFLOW_RUNTIME_MODE?.toUpperCase();
  if (envMode === 'LIVE' || envMode === 'SANDBOX' || envMode === 'DEMO' || envMode === 'TEST') {
    return envMode as RuntimeMode;
  }
  if (envMode) throw new StartupConfigurationError(`Unknown RECOVERFLOW_RUNTIME_MODE '${envMode}'. Use DEMO, SANDBOX, LIVE, or TEST.`);
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
  if (databaseState.recoverflowDatabase && databaseState.recoverflowDatabaseMode === getRuntimeMode() && !options?.forceNew && !options?.mode) {
    return databaseState.recoverflowDatabase;
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
    if (!options?.forceNew) { databaseState.recoverflowDatabase = instance; databaseState.recoverflowDatabaseMode = mode; }
    return instance;
  }

  // DEMO or TEST mode
  if (mode === 'TEST' && databaseUrl && process.env.RECOVERFLOW_FORCE_PRISMA === 'true') {
    const instance = new PrismaDatabase();
    if (!options?.forceNew) { databaseState.recoverflowDatabase = instance; databaseState.recoverflowDatabaseMode = mode; }
    return instance;
  }

  const instance = new MemoryDatabase();
  if (!options?.forceNew) { databaseState.recoverflowDatabase = instance; databaseState.recoverflowDatabaseMode = mode; }
  return instance;
}

/**
 * Reset singleton (useful for isolated integration and unit test setups).
 */
export function resetDatabaseSingleton(): void {
  delete databaseState.recoverflowDatabase;
  delete databaseState.recoverflowDatabaseMode;
}
