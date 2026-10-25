import { NextRequest, NextResponse } from 'next/server';
import { globalSuppressionService, type SuppressionType } from '@recoverflow/core';
import { enforceRateLimit } from '@/lib/apiGuards';
import { authorizeRequest } from '@/lib/routeAuth';
import { internalErrorResponse } from '@/lib/http';
import { z } from 'zod';

const SuppressPayloadSchema = z.object({
  identifier: z.string().trim().min(3).max(254),
  type: z.enum(['EMAIL', 'PHONE']).optional(),
  reason: z.enum(['USER_UNSUBSCRIBE', 'BOUNCE', 'COMPLAINT', 'MANUAL']).default('MANUAL'),
});

export async function POST(req: NextRequest) {
  try {
    const rateLimitRes = await enforceRateLimit(req, 20, 60000);
    if (rateLimitRes) return rateLimitRes;

    const authRes = await authorizeRequest(req, 'support:intervene', {
      allowAnonymousDemo: true,
    });
    if (!authRes.authorized) return authRes.response;
    const { session } = authRes;

    let bodyRaw: unknown = {};
    try {
      bodyRaw = await req.json();
    } catch {
      bodyRaw = {};
    }

    const parsed = SuppressPayloadSchema.safeParse(bodyRaw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid suppression request payload', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { identifier, reason } = parsed.data;
    const type: SuppressionType = parsed.data.type || (identifier.includes('@') ? 'EMAIL' : 'PHONE');

    const entry = await globalSuppressionService.suppress(session.activeMerchantId, identifier, type, reason);
    return NextResponse.json({ success: true, entry });
  } catch (err: unknown) {
    return internalErrorResponse('recovery/suppress', err, 'Failed to suppress contact');
  }
}
