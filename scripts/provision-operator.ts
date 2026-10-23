import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { hashPassword } from '../packages/core/src/password';

// Server-side provisioning only. Passwords are read from the environment, never CLI arguments or logs.
async function main() {
const { OPERATOR_EMAIL, OPERATOR_PASSWORD, WORKSPACE_SLUG, MERCHANT_URL, OPERATOR_NAME, MERCHANT_NAME } = process.env;
if (!OPERATOR_EMAIL || !OPERATOR_PASSWORD || !WORKSPACE_SLUG || !MERCHANT_URL) {
  throw new Error('Set OPERATOR_EMAIL, OPERATOR_PASSWORD, WORKSPACE_SLUG, and MERCHANT_URL before provisioning.');
}
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(WORKSPACE_SLUG)) throw new Error('WORKSPACE_SLUG must be lowercase words separated by hyphens.');
const storeUrl = new URL(MERCHANT_URL);
if (storeUrl.protocol !== 'https:') throw new Error('MERCHANT_URL must use HTTPS.');
const prisma = new PrismaClient();
try {
  const passwordHash = await hashPassword(OPERATOR_PASSWORD);
  await prisma.$transaction(async (tx) => {
    const email = OPERATOR_EMAIL.trim().toLowerCase();
    if (await tx.user.findUnique({ where: { email } })) throw new Error('This operator already exists. Provisioning does not overwrite credentials.');
    const organization = await tx.organization.upsert({ where: { slug: WORKSPACE_SLUG }, update: {}, create: { slug: WORKSPACE_SLUG, name: MERCHANT_NAME || WORKSPACE_SLUG } });
    const user = await tx.user.create({ data: { email, name: OPERATOR_NAME || 'Workspace owner', passwordHash } });
    await tx.membership.create({ data: { userId: user.id, organizationId: organization.id, role: 'OWNER' } });
    const existingMerchant = await tx.merchant.findUnique({ where: { storeUrl: storeUrl.origin } });
    if (existingMerchant && existingMerchant.organizationId !== organization.id) throw new Error('Merchant belongs to a different workspace.');
    if (!existingMerchant) await tx.merchant.create({ data: { organizationId: organization.id, storeUrl: storeUrl.origin, shopDomain: storeUrl.hostname, storeName: MERCHANT_NAME || WORKSPACE_SLUG, webhookSecret: randomBytes(32).toString('hex') } });
  });
  console.log('Operator provisioned. Sign in using the configured email, password, and workspace slug.');
} finally { await prisma.$disconnect(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : 'Provisioning failed.'); process.exitCode = 1; });
