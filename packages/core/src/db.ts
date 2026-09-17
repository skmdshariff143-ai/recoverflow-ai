/**
 * RecoverFlow AI — Database Access Layer Gateway
 *
 * Provides domain access to the active DatabasePort (MemoryDatabase in DEMO/TEST,
 * PrismaDatabase in SANDBOX/LIVE).
 */

export * from './data';
import { getDatabase } from './data/databaseFactory';
import type { DatabasePort } from './data/DatabasePort';

export const db: DatabasePort = getDatabase();
