/**
 * PayBack AI — Server-Side Recovery Transaction Status Route.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  RazorpayTestModeAdapter,
  globalSimulatorAdapter,
  InvalidSimulatorReferenceError,
} from '@recoverflow/core';
import { authorizeRequest } from '@/lib/routeAuth';
import { internalErrorResponse } from '@/lib/http';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reference: string }> },
) {
  try {
    const { reference } = await params;

    const trimmedRef = reference ? reference.trim() : '';
    if (!trimmedRef || !/^[A-Za-z0-9_-]{1,64}$/.test(trimmedRef)) {
      return NextResponse.json(
        { error: 'Invalid reference: must match /^[A-Za-z0-9_-]{1,64}$/' },
        { status: 400 }
      );
    }

    const requestedAdapter = req.nextUrl.searchParams.get('adapter') ?? req.headers.get('x-recovery-adapter');
    const isRazorpay = requestedAdapter === 'razorpay_test_mode' || trimmedRef.startsWith('plink_');

    // The Razorpay adapter path requires a real authenticated session; simulator allows demo
    const authRes = await authorizeRequest(req, 'recovery:execute', {
      allowAnonymousDemo: !isRazorpay,
    });
    if (!authRes.authorized) return authRes.response;

    let adapter;
    if (isRazorpay) {
      adapter = new RazorpayTestModeAdapter();
    } else {
      adapter = globalSimulatorAdapter;
    }

    const queryResult = await adapter.getStatus(trimmedRef);

    return NextResponse.json({
      reference: trimmedRef,
      status: queryResult.status,
      settledAmountPaise: queryResult.settledAmountPaise,
      razorpayStatusRaw: queryResult.razorpayStatusRaw,
      source: queryResult.source,
      adapter: adapter.adapterName,
      timestamp: queryResult.timestamp,
      executionStatus:
        queryResult.status === 'test_link_created'
          ? 'link_created'
          : queryResult.status === 'captured'
            ? 'executed'
            : 'failed',
      outcomeStatus:
        queryResult.status === 'captured'
          ? 'synthetic_captured'
          : queryResult.status === 'test_link_created'
            ? 'synthetic_not_recovered'
            : 'unverified',
      evidenceClass:
        queryResult.evidenceClass ??
        (adapter.adapterName === 'razorpay_test_mode' ? 'LIVE_TEST_MODE' : 'SYNTHETIC'),
      syntheticOutcomeAmountPaise:
        queryResult.syntheticOutcomeAmountPaise ?? queryResult.verifiedSyntheticRecoveredPaise ?? 0,
      verifiedSyntheticRecoveredPaise: queryResult.verifiedSyntheticRecoveredPaise ?? 0,
      liveSettledAmountPaise: queryResult.liveSettledAmountPaise ?? 0,
      provenanceNotice:
        queryResult.provenanceNotice ??
        'Deterministic synthetic evaluation outcome; not live merchant settlement.',
    });
  } catch (err: unknown) {
    // Invalid or tampered simulator reference — return HTTP 422 with technical error,
    // not a business outcome. This is distinct from a legitimate failed recovery.
    if (err instanceof InvalidSimulatorReferenceError) {
      return NextResponse.json(
        {
          error: err.message,
          errorCode: err.errorCode,
          reference: err.reference,
          reason: err.reason,
          evidenceClass: err.evidenceClass,
          liveSettledAmountPaise: err.liveSettledAmountPaise,
          syntheticOutcomeAmountPaise: err.syntheticOutcomeAmountPaise,
        },
        { status: 422 },
      );
    }
    return internalErrorResponse('recovery/status', err, 'Failed to query status');
  }
}
