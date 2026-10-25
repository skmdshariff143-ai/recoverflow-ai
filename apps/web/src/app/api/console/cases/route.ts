import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/server/database';
import { route, requireSession, ApiError } from '@/lib/server/access';
import { serializeCase } from '@/lib/server/console';
const schema = z.object({ search: z.string().max(150).default(''), status: z.enum(['all', 'DETECTED', 'DIAGNOSED', 'ELIGIBILITY_CHECKED', 'APPROVAL_REQUIRED', 'SCHEDULED', 'EXECUTING', 'OUTCOME_OBSERVED', 'RECOVERED', 'RETRY_SCHEDULED', 'STOPPED']).default('all'), active: z.enum(['true', 'false']).default('false'), sort: z.enum(['recent', 'value']).default('recent'), page: z.coerce.number().int().min(0).max(10000).default(0) });
export const GET = route(async (request) => {
  const session = await requireSession(request, 'financials:view');
  const parsed = schema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) throw new ApiError(400, 'Invalid case search or pagination parameters.');
  const query = parsed.data;
  const result = await db.searchRecoveryCases({ merchantId: session.activeMerchantId, search: query.search, status: query.status === 'all' ? undefined : query.status, activeOnly: query.active === 'true', sortBy: query.sort === 'value' ? 'expectedValuePaise' : 'createdAt', offset: query.page * 10, limit: 10 });
  return NextResponse.json({ items: await Promise.all(result.items.map((record) => serializeCase(record, session.activeMerchantId))), total: result.total, page: query.page, pageSize: 10 });
});
