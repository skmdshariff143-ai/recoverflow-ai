import { NextRequest, NextResponse } from 'next/server';
import { globalSuppressionService, type SuppressionType } from '@recoverflow/core';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const identifier: string = body.identifier;
    const type: SuppressionType = body.type || (identifier.includes('@') ? 'EMAIL' : 'PHONE');
    const reason = body.reason || 'MANUAL';

    if (!identifier) {
      return NextResponse.json({ error: 'identifier is required' }, { status: 400 });
    }

    const entry = await globalSuppressionService.suppress('merchant_default_01', identifier, type, reason);
    return NextResponse.json({ success: true, entry });
  } catch {
    return NextResponse.json({ error: 'Failed to suppress contact' }, { status: 500 });
  }
}
