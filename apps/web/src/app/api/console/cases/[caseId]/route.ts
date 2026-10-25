import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/server/database';
import { apiError, ApiError, requireSession } from '@/lib/server/access';
import { serializeCase } from '@/lib/server/console';
export async function GET(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const session = await requireSession(request, 'financials:view');
    const { caseId } = await params;
    const record = await db.getRecoveryCase(caseId, session.activeMerchantId);
    if (!record) throw new ApiError(404, 'This case does not exist in your workspace.');
    return NextResponse.json(await serializeCase(record, session.activeMerchantId), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
