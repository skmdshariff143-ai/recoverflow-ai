/**
 * RecoverFlow AI — Server-Side Recovery Transaction Status Route.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  RazorpayTestModeAdapter,
  globalSimulatorAdapter,
  InvalidSimulatorReferenceError,
} from '@/lib/adapters/recoveryAdapter';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reference: string }> },
) {
  try {
    const { reference } = await params;

    if (!reference || reference.trim() === '') {
      return NextResponse.json({ error: 'Transaction reference is required' }, { status: 400 });
    }

    const requestedAdapter = req.nextUrl.searchParams.get('adapter') ?? req.headers.get('x-recovery-adapter');
    let adapter;
    if (requestedAdapter === 'razorpay_test_mode' || reference.startsWith('plink_')) {
      adapter = new RazorpayTestModeAdapter();
    } else {
      adapter = globalSimulatorAdapter;
    }

    const queryResult = await adapter.getStatus(reference);

    return NextResponse.json({
      reference,
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to query status' },
      { status: 500 },
    );
  }
}
