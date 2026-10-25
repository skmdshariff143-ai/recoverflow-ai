import { NextRequest, NextResponse } from 'next/server';
import { diagnoseGatewayErrorWithGemini } from '@recoverflow/agents';
import { enforceRateLimit } from '@/lib/apiGuards';
import { authorizeRequest } from '@/lib/routeAuth';
import { internalErrorResponse } from '@/lib/http';
import { z } from 'zod';

const RequestSchema = z.object({
  rawGatewayError: z.string().min(1).max(500),
});

export async function POST(req: NextRequest) {
  try {
    const rateLimitRes = await enforceRateLimit(req, 20, 60000);
    if (rateLimitRes) return rateLimitRes;

    const authRes = await authorizeRequest(req, 'support:intervene', { allowAnonymousDemo: true });
    if (!authRes.authorized) return authRes.response;

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    const validated = RequestSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid request: rawGatewayError must be between 1 and 500 characters.' },
        { status: 400 },
      );
    }

    const diagnosis = await diagnoseGatewayErrorWithGemini(validated.data.rawGatewayError);
    return NextResponse.json(diagnosis);
  } catch (err: unknown) {
    return internalErrorResponse('ai/diagnose', err, 'Internal diagnostic error');
  }
}
