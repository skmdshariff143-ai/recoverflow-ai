/**
 * RecoverFlow AI — Server-Side Recovery Transaction Status Route.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  RazorpayTestModeAdapter,
  globalSimulatorAdapter,
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
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to query status' },
      { status: 500 },
    );
  }
}
