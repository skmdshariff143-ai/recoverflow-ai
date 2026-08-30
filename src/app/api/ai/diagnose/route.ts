import { NextRequest, NextResponse } from 'next/server';
import { diagnoseGatewayErrorWithGemini } from '@/lib/ai/geminiClient';
import { z } from 'zod';

const RequestSchema = z.object({
  rawGatewayError: z.string().min(1).max(500),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal diagnostic error' },
      { status: 500 },
    );
  }
}
