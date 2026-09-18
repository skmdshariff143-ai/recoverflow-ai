/**
 * RecoverFlow AI — PostgreSQL Real Infrastructure Test Harness (Phase 4)
 *
 * Enforces fail-closed semantics for PostgreSQL integration testing.
 * If DATABASE_URL is missing or PostgreSQL is unreachable, throws InfrastructureUnavailableError.
 * Tests under tests/integration/postgres/** MUST use this harness.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaDatabase } from './PrismaDatabase';

export class InfrastructureUnavailableError extends Error {
  constructor(service: string, reason: string) {
    super(`[FAIL-CLOSED] Required test infrastructure ${service} is unavailable: ${reason}`);
    this.name = 'InfrastructureUnavailableError';
  }
}

export interface PostgresTestContext {
  prisma: PrismaClient;
  db: PrismaDatabase;
  cleanup: () => Promise<void>;
}

export async function createPostgresTestHarness(): Promise<PostgresTestContext> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new InfrastructureUnavailableError(
      'PostgreSQL',
      'DATABASE_URL environment variable is not defined. Real PostgreSQL container or database is required for integration tests.'
    );
  }

  const prisma = new PrismaClient({
    datasources: {
      db: { url: databaseUrl },
    },
    log: ['error'],
  });

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err: unknown) {
    await prisma.$disconnect();
    throw new InfrastructureUnavailableError(
      'PostgreSQL',
      `Could not connect to PostgreSQL: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const db = new PrismaDatabase(prisma);

  const cleanup = async () => {
    try {
      await prisma.$executeRawUnsafe(
        'TRUNCATE TABLE "AuditEvent", "RecoveryAttempt", "RecoveryDecision", "RecoveryOutcome", "RecoveryCase", "Payment", "OutboxEvent", "IdempotencyKey", "WebhookEvent", "SessionRevocation", "Session", "CartEvent", "Merchant" CASCADE;'
      );
    } catch {
      // Ignore if table clean
    }
  };

  return {
    prisma,
    db,
    cleanup,
  };
}
