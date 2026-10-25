import { NextResponse } from 'next/server';

/** Process liveness only; dependency and authentication checks live at /api/ready. */
export async function GET() {
  return NextResponse.json({
    data: { status: 'healthy', timestamp: new Date().toISOString(), uptimeSeconds: Math.round(process.uptime()), version: '0.1.0', service: 'recoverflow-ai-web', environment: process.env.NODE_ENV || 'development' },
    error: null,
    meta: { requestId: crypto.randomUUID() },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
