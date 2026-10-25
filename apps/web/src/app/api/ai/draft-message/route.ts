import { NextRequest, NextResponse } from 'next/server';
import { draftCustomerCommunicationWithGemini } from '@recoverflow/agents';
import { enforceRateLimit } from '@/lib/apiGuards';
import { authorizeRequest } from '@/lib/routeAuth';
import { internalErrorResponse } from '@/lib/http';
import { z } from 'zod';

const RequestSchema = z.object({
  customerName: z.string().min(1).max(100),
  amountINR: z.string().min(1).max(50),
  failureCategory: z.string().min(1).max(50),
  channel: z.enum(['sms', 'email', 'whatsapp']).default('email'),
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
        { error: 'Invalid message drafting parameters.' },
        { status: 400 },
      );
    }

    const message = await draftCustomerCommunicationWithGemini(
      validated.data.customerName,
      validated.data.amountINR,
      validated.data.failureCategory,
      validated.data.channel,
    );

    return NextResponse.json(message);
  } catch (err: unknown) {
    return internalErrorResponse('ai/draft-message', err, 'Internal communication drafting error');
  }
}
