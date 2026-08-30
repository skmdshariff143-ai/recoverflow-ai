import { NextRequest, NextResponse } from 'next/server';
import { draftCustomerCommunicationWithGemini } from '@/lib/ai/geminiClient';
import { z } from 'zod';

const RequestSchema = z.object({
  customerName: z.string().min(1).max(100),
  amountINR: z.string().min(1).max(50),
  failureCategory: z.string().min(1).max(50),
  channel: z.enum(['sms', 'email', 'whatsapp']).default('email'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal communication drafting error' },
      { status: 500 },
    );
  }
}
