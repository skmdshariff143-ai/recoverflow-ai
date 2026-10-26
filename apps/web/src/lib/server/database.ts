import { PrismaClient } from '@prisma/client';
import { db as runtimeDatabase } from '@recoverflow/core';
import { PrismaDatabase } from '@recoverflow/core';
import { getRuntimeMode } from '@recoverflow/core';
import { hostedDemoUrl } from '@recoverflow/core';

const connection = hostedDemoUrl(getRuntimeMode(), process.env.RECOVERFLOW_DEMO_POSTGRES_PRISMA_URL);
const state = globalThis as unknown as { recoverflowHostedDemo?: PrismaDatabase };
export const hostedDemo = Boolean(connection);
if (connection && !state.recoverflowHostedDemo) {
  state.recoverflowHostedDemo = new PrismaDatabase(new PrismaClient({ datasourceUrl: connection }));
}
// The historical benchmark remains in memory; only the merchant console uses this store.
export const db = connection ? state.recoverflowHostedDemo! : runtimeDatabase;
