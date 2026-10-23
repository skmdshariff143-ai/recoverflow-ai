import { NextResponse } from 'next/server';
import { db } from '@/lib/server/database';
import { route, requireSession } from '@/lib/server/access';
export const POST = route(async (request) => {
  const session = await requireSession(request, 'audit:view');
  const result = await db.verifyAuditChain(session.activeMerchantId);
  return NextResponse.json({ ...result, checkedAt: new Date().toISOString(), scope: 'First 10,000 events in this merchant ledger' });
});
