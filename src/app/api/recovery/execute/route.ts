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
  RecoveryExecutionResult,
} from '@/lib/adapters/recoveryAdapter';
import { globalTransactionalIdempotencyStore } from '@/lib/server/storage/atomicIdempotencyStore';
import { formatErrorResponse } from '@/types/errors';

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

    // ── Atomic Idempotency Intent Reservation ───────────────────────
    const reservation = await globalTransactionalIdempotencyStore.reserve(payload.idempotencyKey, payload);

    if (reservation.status === 'REPLAY') {
      const receipt = reservation.result as RecoveryExecutionResult;
      return NextResponse.json({
        success: receipt.success,
        receipt,
        serverTimestamp: new Date().toISOString(),
        idempotencyStatus: 'replayed_existing_execution',
        securityDisclaimer: 'Executed in Test Mode. Zero real financial debit triggered.',
      });
    }

    if (reservation.status === 'CONFLICT') {
      return NextResponse.json(
        {
          error: reservation.message,
        },
        { status: 409 },
      );
    }

    if (reservation.status === 'IN_PROGRESS') {
      return NextResponse.json(
        {
          error: 'Execution in progress for this idempotency key. Please retry shortly.',
          retryAfterMs: reservation.retryAfterMs,
        },
        { status: 429 },
      );
    }

    // ── Dispatch Execution to Requested Adapter ────────────────────
    let adapter;
    if (requestedAdapter === 'razorpay_test_mode') {
      adapter = new RazorpayTestModeAdapter();
    } else {
      adapter = globalSimulatorAdapter;
    }

    try {
      const receipt = await adapter.execute(payload);
      // Atomic commit of completed execution
      await globalTransactionalIdempotencyStore.commit(payload.idempotencyKey, payload, receipt, reservation.version);

      return NextResponse.json({
        success: receipt.success,
        receipt,
        serverTimestamp: new Date().toISOString(),
        idempotencyStatus: 'new_execution_recorded',
        securityDisclaimer: 'Executed in Test Mode. Zero real financial debit triggered.',
      });
    } catch (execErr: unknown) {
      const errMsg = execErr instanceof Error ? execErr.message : 'Execution failed';
      await globalTransactionalIdempotencyStore.fail(payload.idempotencyKey, payload, errMsg, reservation.version);
      throw execErr;
    }
  } catch (err: unknown) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
