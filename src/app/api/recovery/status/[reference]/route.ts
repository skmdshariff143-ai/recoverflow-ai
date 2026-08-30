/**
 * RecoverFlow AI — Server-Side Recovery Transaction Status Route.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getExecutionAdapter } from '@/lib/adapters/recoveryAdapter';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reference: string }> },
) {
  try {
    const { reference } = await params;

    if (!reference || reference.trim() === '') {
      return NextResponse.json({ error: 'Transaction reference is required' }, { status: 400 });
    }

    const adapter = getExecutionAdapter();
    const status = await adapter.getStatus(reference);

    return NextResponse.json({
      reference,
      status: status.status,
      settledAmountPaise: status.settledAmountPaise,
      adapter: adapter.adapterName,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to query status' },
      { status: 500 },
    );
  }
}
