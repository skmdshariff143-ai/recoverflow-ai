/**
 * RecoverFlow AI — Server-Side Recovery Execution API Route.
 *
 * Exposes a secure, server-bounded execution boundary that validates incoming
 * requests via Zod, dispatches to the requested adapter (Simulator or Razorpay Test Mode),
 * enforces idempotency, and returns structured execution receipts.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  RecoveryExecutionRequestSchema,
  getExecutionAdapter,
  DeterministicSimulatorAdapter,
  RazorpayTestModeAdapter,
} from '@/lib/adapters/recoveryAdapter';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = RecoveryExecutionRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed: Invalid recovery execution payload.',
          details: parseResult.error.format(),
        },
        { status: 400 },
      );
    }

    const payload = parseResult.data;
    const requestedAdapter = req.headers.get('x-recovery-adapter') ?? 'simulator';

    let adapter = getExecutionAdapter();
    if (requestedAdapter === 'simulator') {
      adapter = new DeterministicSimulatorAdapter();
    } else if (requestedAdapter === 'razorpay_test_mode') {
      adapter = new RazorpayTestModeAdapter();
    }

    const receipt = await adapter.execute(payload);

    return NextResponse.json({
      success: receipt.success,
      receipt,
      serverTimestamp: new Date().toISOString(),
      securityDisclaimer: 'Executed in Test Mode. Zero real financial debit triggered.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal execution error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
