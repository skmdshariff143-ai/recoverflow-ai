import { Prisma, PrismaClient, type CaseStatus } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { MemoryDatabase } from '../packages/core/src/data/MemoryDatabase';
import { hostedDemoUrl } from '../packages/core/src/data/hostedDemo';
import { DEMO_PERSONA_SESSIONS } from '../packages/core/src/auth';

async function main() {
  if (process.env.RECOVERFLOW_RUNTIME_MODE && process.env.RECOVERFLOW_RUNTIME_MODE !== 'DEMO') throw new Error('Hosted demo setup requires DEMO mode.');
  const connection = hostedDemoUrl('DEMO', process.env.RECOVERFLOW_DEMO_POSTGRES_URL_NON_POOLING);
  if (!connection) throw new Error('The dedicated RECOVERFLOW_DEMO_POSTGRES_URL_NON_POOLING connection is required.');
  const migrationUrl = new URL(connection);
  migrationUrl.searchParams.delete('pgbouncer');
  const migration = spawnSync(process.execPath, [resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy', '--schema=packages/core/prisma/schema.prisma'], {
    env: { ...process.env, DATABASE_URL: migrationUrl.toString() }, stdio: 'inherit',
  });
  if (migration.status !== 0) throw new Error('Hosted demo migrations failed.');
  const prisma = new PrismaClient({ datasourceUrl: migrationUrl.toString() });
  const sample = new MemoryDatabase();
  const merchant = [...sample.merchants.values()][0];
  const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value, (_, entry) => typeof entry === 'bigint' ? String(entry) : entry));
  try {
    await prisma.$transaction(async (tx) => {
      if (await tx.merchant.count({ where: { id: { not: merchant.id } } })) throw new Error('The demo schema contains another merchant. Refusing to seed it.');
      await tx.organization.upsert({ where: { id: 'org_recoverflow_demo' }, update: {}, create: { id: 'org_recoverflow_demo', slug: 'luxurybrand-enterprise', name: 'RecoverFlow demo workspace' } });
      for (const identity of Object.values(DEMO_PERSONA_SESSIONS)) {
        await tx.user.upsert({ where: { id: identity.userId }, update: {}, create: { id: identity.userId, email: identity.email, name: identity.name } });
        await tx.membership.upsert({ where: { userId_organizationId: { userId: identity.userId, organizationId: identity.organizationId } }, update: {}, create: { userId: identity.userId, organizationId: identity.organizationId, role: identity.role } });
      }
      await tx.merchant.upsert({ where: { id: merchant.id }, update: {}, create: {
        id: merchant.id, organizationId: 'org_recoverflow_demo', storeUrl: merchant.storeUrl, shopDomain: merchant.shopDomain,
        storeName: merchant.storeName, webhookSecret: randomBytes(32).toString('hex'),
        brandToneGuidelines: merchant.brandToneGuidelines, brandVoiceCasualVsFormal: merchant.brandVoiceCasualVsFormal,
        brandVoiceUrgencyVsGentle: merchant.brandVoiceUrgencyVsGentle, discountCeilingPercentage: merchant.discountCeilingPercentage,
        minMarginPercentage: merchant.minMarginPercentage,
      } });
      await tx.cartEvent.createMany({ skipDuplicates: true, data: [...sample.cartEvents.values()].map((cart) => ({
        id: cart.id, merchantId: cart.merchantId, cartToken: cart.cartToken, customerName: cart.customerName,
        customerEmail: cart.customerEmail, customerPhone: cart.customerPhone, currency: cart.currency, totalPrice: cart.totalPrice,
        totalAmountMinor: BigInt(cart.totalAmountMinor ?? Math.round(cart.totalPrice * 100)), items: json(cart.items),
        status: cart.status, recoveryStage: cart.recoveryStage, abandonmentType: cart.abandonmentType,
        checkoutUrl: cart.checkoutUrl, suggestedDiscountCode: cart.suggestedDiscountCode,
        recoveredAt: cart.recoveredAt ? new Date(cart.recoveredAt) : null, createdAt: new Date(cart.createdAt), updatedAt: new Date(cart.updatedAt),
      })) });
      const customers = new Set([...sample.recoveryCases.values()].map((record) => record.customerId).filter((id): id is string => Boolean(id)));
      await tx.customer.createMany({ skipDuplicates: true, data: [...customers].map((id) => ({ id, merchantId: merchant.id, name: 'Sample customer' })) });
      await tx.payment.createMany({ skipDuplicates: true, data: [...sample.payments.values()].map((payment) => ({
        id: payment.id, merchantId: payment.merchantId, externalPaymentId: payment.externalPaymentId,
        amountPaise: BigInt(payment.amountPaise), currency: payment.currency,
        status: payment.status === 'CAPTURED' ? 'CAPTURED' : 'FAILED', gateway: 'DEMO', createdAt: new Date(payment.createdAt), updatedAt: new Date(payment.updatedAt),
      })) });
      await tx.recoveryCase.createMany({ skipDuplicates: true, data: [...sample.recoveryCases.values()].map((record) => ({
        id: record.id, merchantId: record.merchantId, paymentId: record.paymentId, customerId: record.customerId,
        status: record.status as CaseStatus, attemptCount: record.attemptCount, maxAttempts: record.maxAttempts,
        recoveryProbBps: record.recoveryProbBps, expectedValuePaise: BigInt(record.expectedValuePaise),
        createdAt: new Date(record.createdAt), updatedAt: new Date(record.updatedAt),
      })) });
      await tx.messageLog.createMany({ skipDuplicates: true, data: [...sample.messageLogs.values()].map((message) => {
        if (message.channel !== 'WHATSAPP' && message.channel !== 'EMAIL') throw new Error('Unsupported sample message channel.');
        return {
        id: message.id, merchantId: message.merchantId, cartEventId: message.cartEventId,
        channel: message.channel, direction: message.direction, content: message.content,
        deliveryStatus: message.deliveryStatus, createdAt: new Date(message.createdAt),
      }; }) });
    }, { timeout: 60000 });
    console.log('Hosted demo initialized in the isolated recoverflow_demo schema. Existing demo records were preserved.');
    console.log(JSON.stringify({ cases: await prisma.recoveryCase.count(), carts: await prisma.cartEvent.count(), operators: await prisma.user.count() }));
  } finally { await prisma.$disconnect(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : 'Hosted demo setup failed.'); process.exitCode = 1; });
