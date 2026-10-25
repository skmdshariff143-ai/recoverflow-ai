import { PrismaClient } from '@prisma/client';
import { db as runtimeDatabase } from '../../../../../packages/core/src/db';
import { PrismaDatabase } from '../../../../../packages/core/src/data/PrismaDatabase';
import { getRuntimeMode } from '../../../../../packages/core/src/data/databaseFactory';
import { hostedDemoUrl } from '../../../../../packages/core/src/data/hostedDemo';

const connection = hostedDemoUrl(getRuntimeMode(), process.env.RECOVERFLOW_DEMO_POSTGRES_PRISMA_URL);
const state = globalThis as unknown as { recoverflowHostedDemo?: PrismaDatabase };
export const hostedDemo = Boolean(connection);
if (connection && !state.recoverflowHostedDemo) {
  state.recoverflowHostedDemo = new PrismaDatabase(new PrismaClient({ datasourceUrl: connection }));
}
// The historical benchmark remains in memory; only the merchant console uses this store.
export const db = connection ? state.recoverflowHostedDemo! : runtimeDatabase;
