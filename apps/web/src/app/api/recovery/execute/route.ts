/**
 * PayBack AI — Server-Side Recovery Execution API Route.
 *
 * Enforces strict request validation, adapter boundary checks, and enforceable
 * atomic idempotency replay/conflict/in-progress locking.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  RecoveryExecutionRequestSchema,
  AdapterTypeSchema,
  RazorpayTestModeAdapter,
  globalSimulatorAdapter,
} from '@recoverflow/core';
import { idempotencyStore } from '@recoverflow/core';
import { authorizeRequest } from '@/lib/routeAuth';
import { enforceRateLimit } from '@/lib/apiGuards';
import { internalErrorResponse } from '@/lib/http';

export async function POST(req: NextRequest) {
  try {
    const rateLimitRes = await enforceRateLimit(req, 30, 60000);
    if (rateLimitRes) return rateLimitRes;

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
    const isSimulator = requestedAdapter === 'simulator';

    // Anonymous demo allowed only for simulator adapter; razorpay_test_mode requires a real session
    const authResult = await authorizeRequest(req, 'recovery:execute', {
      allowAnonymousDemo: isSimulator,
    });
    if (!authResult.authorized) return authResult.response;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

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

    // ── Atomic Synchronous Idempotency Begin / Locking ─────────────
    const idempResult = idempotencyStore.begin(payload.idempotencyKey, payload, 30);

    if (idempResult.status === 'replay') {
      const receipt = idempResult.receipt as Record<string, unknown> | undefined;
      return NextResponse.json({
        success: receipt?.success ?? true,
        receipt: idempResult.receipt,
        serverTimestamp: new Date().toISOString(),
        idempotencyStatus: 'replayed_existing_execution',
        securityDisclaimer: 'Executed in Test Mode. Zero real financial debit triggered.',
      });
    }

    if (idempResult.status === 'conflict') {
      return NextResponse.json(
        {
          error:
            'Idempotency Conflict: The provided idempotency key has already been used with a different request payload.',
          message: idempResult.message,
        },
        { status: 409 },
      );
    }

    if (idempResult.status === 'in_progress') {
      return NextResponse.json(
        {
          error: 'Operation in progress. Concurrent execution detected.',
          message: idempResult.message,
        },
        { status: 409 },
      );
    }

    let isSaved = false;
    try {
      // ── Dispatch Execution to Requested Adapter ────────────────────
      let adapter;
      if (requestedAdapter === 'razorpay_test_mode') {
        adapter = new RazorpayTestModeAdapter();
      } else {
        adapter = globalSimulatorAdapter;
      }

      const receipt = await adapter.execute(payload);

      // Save committed execution in idempotency store
      idempotencyStore.save(payload.idempotencyKey, payload, receipt);
      isSaved = true;

      return NextResponse.json({
        success: receipt.success,
        receipt,
        serverTimestamp: new Date().toISOString(),
        idempotencyStatus: 'new_execution_recorded',
        securityDisclaimer: 'Executed in Test Mode. Zero real financial debit triggered.',
      });
    } finally {
      // If execution throws, release lock so retries are not deadlocked
      if (!isSaved) {
        idempotencyStore.release(payload.idempotencyKey);
      }
    }
  } catch (err: unknown) {
    return internalErrorResponse('recovery/execute', err, 'Internal execution error');
  }
}
