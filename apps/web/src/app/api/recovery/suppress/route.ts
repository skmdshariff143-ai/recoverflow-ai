import { NextRequest, NextResponse } from 'next/server';
import { globalSuppressionService, type SuppressionType } from '@recoverflow/core';
import { enforceRateLimit, enforceRouteAuth } from '@/lib/apiGuards';
import { z } from 'zod';

const SuppressPayloadSchema = z.object({
  identifier: z.string().trim().min(3).max(255),
  type: z.enum(['EMAIL', 'PHONE']).optional(),
  reason: z.enum(['USER_UNSUBSCRIBE', 'BOUNCE', 'COMPLAINT', 'MANUAL']).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rateLimitRes = await enforceRateLimit(req, 20, 60000);
    if (rateLimitRes) return rateLimitRes;

    const body = await req.json().catch(() => ({}));
    const parsed = SuppressPayloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid suppression request payload', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const authRes = await enforceRouteAuth(req, {
      allowDemoSimulation: true,
      requiresLiveCredentials: process.env.RECOVERFLOW_RUNTIME_MODE !== 'DEMO',
    });
    if (authRes) return authRes;

    const { identifier, reason = 'MANUAL' } = parsed.data;
    const type: SuppressionType = parsed.data.type || (identifier.includes('@') ? 'EMAIL' : 'PHONE');

    const entry = await globalSuppressionService.suppress('merchant_default_01', identifier, type, reason);
    return NextResponse.json({ success: true, entry });
  } catch {
    return NextResponse.json({ error: 'Failed to suppress contact' }, { status: 500 });
  }
}
