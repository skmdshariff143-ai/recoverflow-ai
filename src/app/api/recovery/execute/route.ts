/**
 * PayBack AI — Server-Side Recovery Execution API Route.
 *
 * Enforces strict request validation, adapter boundary checks, and enforceable
 * idempotency replay/conflict detection.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  RecoveryExecutionRequestSchema,
  AdapterTypeSchema,
  RazorpayTestModeAdapter,
  globalSimulatorAdapter,
} from '@/lib/adapters/recoveryAdapter';
import { idempotencyStore } from '@/lib/server/idempotencyStore';

export async function POST(req: NextRequest) {
  try {
    const rawAdapterHeader = req.headers.get('x-recovery-adapter') ?? 'simulator';
    const adapterParse = AdapterTypeSchema.safeParse(rawAdapterHeader);

    if (!adapterParse.success) {
      return NextResponse.json(
        {
          error: `Invalid recovery adapter: '${rawAdapterHeader}'. Supported adapters: 'simulator', 'razorpay_test_mode'.`,
        },
        { status: 400 },
      );
    }

    const requestedAdapter = adapterParse.data;
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

    // ── Idempotency Check ──────────────────────────────────────────
    const idempCheck = idempotencyStore.check(payload.idempotencyKey, payload);
    if (idempCheck.status === 'replay') {
      return NextResponse.json({
        success: idempCheck.receipt.success,
        receipt: idempCheck.receipt,
        serverTimestamp: new Date().toISOString(),
        idempotencyStatus: 'replayed_existing_execution',
        securityDisclaimer: 'Executed in Test Mode. Zero real financial debit triggered.',
      });
    } else if (idempCheck.status === 'conflict') {
      return NextResponse.json(
        {
          error:
            'Idempotency Conflict: The provided idempotency key has already been used with a different request payload.',
        },
        { status: 409 },
      );
    }

    // ── Dispatch Execution to Requested Adapter ────────────────────
    let adapter;
    if (requestedAdapter === 'razorpay_test_mode') {
      adapter = new RazorpayTestModeAdapter();
    } else {
      adapter = globalSimulatorAdapter;
    }

    const receipt = await adapter.execute(payload);

    // Save in idempotency store
    idempotencyStore.save(payload.idempotencyKey, payload, receipt);

    return NextResponse.json({
      success: receipt.success,
      receipt,
      serverTimestamp: new Date().toISOString(),
      idempotencyStatus: 'new_execution_recorded',
      securityDisclaimer: 'Executed in Test Mode. Zero real financial debit triggered.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal execution error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
