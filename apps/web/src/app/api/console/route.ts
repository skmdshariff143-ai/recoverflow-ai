import { NextResponse } from 'next/server';
import { route, requireSession } from '@/lib/server/access';
import { consoleSnapshot } from '@/lib/server/console';
export const GET = route(async (request) => NextResponse.json(await consoleSnapshot(await requireSession(request, 'financials:view'))));
