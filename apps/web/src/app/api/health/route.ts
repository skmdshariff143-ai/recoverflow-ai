import { NextResponse } from 'next/server';
import { liveWebhookStore } from '@recoverflow/core';

export async function GET() {
  const uptimeSeconds = process.uptime();
  const memoryUsage = process.memoryUsage();

  return NextResponse.json({
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(uptimeSeconds),
      version: '1.0.0',
      service: 'recoverflow-ai-web',
      environment: process.env.NODE_ENV || 'development',
      runtime: {
        nodeVersion: process.version,
        platform: process.platform,
        memory: {
          heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
        },
      },
      metrics: {
        liveQueueDepth: liveWebhookStore.getCount(),
        invariantsEnforced: [
          'INTEGER_PAISE_MATH',
          'BOUNDED_ADVISORY_AI',
          'SHA256_HASH_CHAIN_LEDGER',
          'DUAL_CUSTODY_APPROVAL_GATE',
          'TRAI_RBI_QUIET_HOURS',
        ],
      },
    },
    error: null,
    meta: {
      requestId: `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    },
  });
}
