import { NextResponse } from 'next/server';
import { db, hostedDemo } from '@/lib/server/database';
import { getRuntimeMode } from '../../../../../../../packages/core/src/data/databaseFactory';
import { checkRateLimit } from '../../../../../../../packages/core/src/rateLimiter';
import { route, requireSession, ApiError } from '@/lib/server/access';
export const POST = route(async (request) => {
  const session = await requireSession(request, 'recovery:execute');
  if (!['DEMO', 'TEST'].includes(getRuntimeMode()) || (db.isDurable && !hostedDemo)) throw new ApiError(403, 'Sample cases are only available in the isolated demo.');
  if (!checkRateLimit(`console-demo:${session.userId}`, 10, 60000).allowed) throw new ApiError(429, 'Please wait a minute before creating another demo case.');
  const payment = await db.createPayment({ merchantId: session.activeMerchantId, externalPaymentId: `demo_${crypto.randomUUID()}`, amountPaise: 249900n, currency: 'USD', gateway: 'DEMO' });
  const record = await db.createRecoveryCase({ merchantId: session.activeMerchantId, paymentId: payment.id, recoveryProbBps: 6500, expectedValuePaise: 162435n });
  await db.updateRecoveryCase({ id: record.id, merchantId: session.activeMerchantId, updates: { status: 'APPROVAL_REQUIRED' } });
  return NextResponse.json({ caseId: record.id, source: 'DEMO' }, { status: 201 });
});
