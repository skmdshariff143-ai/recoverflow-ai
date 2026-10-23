import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/server/database';
import { route, requireSession, ApiError } from '@/lib/server/access';

const schema = z.object({ caseId: z.string().min(1).max(150), action: z.enum(['approve', 'reject']), reason: z.string().trim().min(10).max(1000) }).strict();
export const POST = route(async (request) => {
  const session = await requireSession(request, 'recovery:approve_high_value');
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) throw new ApiError(400, 'Choose a case and provide a review reason of 10–1,000 characters.');
  const result = await db.reviewRecoveryCase({ ...parsed.data, merchantId: session.activeMerchantId, userId: session.userId });
  if (result.outcome === 'not_found') throw new ApiError(404, 'Case not found.');
  if (result.outcome === 'not_pending') throw new ApiError(409, 'This case is no longer awaiting approval.');
  if (result.outcome === 'already_reviewed') throw new ApiError(409, 'You have already reviewed this case. A different reviewer must co-sign.');
  return NextResponse.json(result);
});
