import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getRateLimitStore } from '../../apps/web/src/lib/apiGuards';

// ── Static Imports for Guarded Route Handlers ─────────────────────────────
import * as ConsoleRoot from '../../apps/web/src/app/api/console/route';
import * as ConsoleAudit from '../../apps/web/src/app/api/console/audit/route';
import * as ConsoleCases from '../../apps/web/src/app/api/console/cases/route';
import * as ConsoleCaseDetail from '../../apps/web/src/app/api/console/cases/[caseId]/route';
import * as ConsoleCommerce from '../../apps/web/src/app/api/console/commerce/route';
import * as ConsoleCopilot from '../../apps/web/src/app/api/console/copilot/route';
import * as ConsoleDemo from '../../apps/web/src/app/api/console/demo/route';
import * as ConsoleExport from '../../apps/web/src/app/api/console/export/route';
import * as ConsoleReview from '../../apps/web/src/app/api/console/review/route';
import * as ConsoleSettings from '../../apps/web/src/app/api/console/settings/route';

import * as AiDiagnose from '../../apps/web/src/app/api/ai/diagnose/route';
import * as AiDraftMessage from '../../apps/web/src/app/api/ai/draft-message/route';
import * as ChatTakeover from '../../apps/web/src/app/api/chat/takeover/route';
import * as LiveTrigger from '../../apps/web/src/app/api/live-trigger/route';
import * as MerchantVoiceClone from '../../apps/web/src/app/api/merchant/voice-clone/route';
import * as RazorpaySubs from '../../apps/web/src/app/api/razorpay/subscriptions/route';
import * as RazorpaySubsHalt from '../../apps/web/src/app/api/razorpay/subscriptions/halt/route';
import * as RecoveryEvents from '../../apps/web/src/app/api/recovery/events/route';
import * as RecoveryExecute from '../../apps/web/src/app/api/recovery/execute/route';
import * as RecoveryReportsExport from '../../apps/web/src/app/api/recovery/reports/export/route';
import * as RecoverySimulate from '../../apps/web/src/app/api/recovery/simulate/route';
import * as RecoveryStatus from '../../apps/web/src/app/api/recovery/status/[reference]/route';
import * as RecoveryStream from '../../apps/web/src/app/api/recovery/stream/route';
import * as RecoverySuppress from '../../apps/web/src/app/api/recovery/suppress/route';
import * as RecoveryTonePreview from '../../apps/web/src/app/api/recovery/tone-preview/route';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

// Explicit allowlist of routes that are public (by design: health probes, OAuth handshakes, HMAC webhooks, public telemetry)
const PUBLIC_ALLOWLIST_ROUTES = new Set([
  'auth/session/route.ts',
  'auth/shopify/route.ts',
  'auth/shopify/callback/route.ts',
  'demo/subscriptions/route.ts',
  'health/route.ts',
  'og/cart/route.tsx',
  'ready/route.ts',
  'v1/telemetry/intent/route.ts',
  'webhooks/razorpay/route.ts',
  'webhooks/shopify/checkouts/route.ts',
  'webhooks/shopify/fulfillments/route.ts',
  'webhooks/shopify/gdpr/route.ts',
  'webhooks/shopify/orders/route.ts',
  'webhooks/whatsapp/route.ts',
]);

// Map of guarded route files to their module exports and sample invocation params
const GUARDED_ROUTE_MODULES: Record<string, { module: any; dummyParams?: any }> = {
  'console/route.ts': { module: ConsoleRoot },
  'console/audit/route.ts': { module: ConsoleAudit },
  'console/cases/route.ts': { module: ConsoleCases },
  'console/cases/[caseId]/route.ts': { module: ConsoleCaseDetail, dummyParams: { params: Promise.resolve({ caseId: 'case_test_123' }) } },
  'console/commerce/route.ts': { module: ConsoleCommerce },
  'console/copilot/route.ts': { module: ConsoleCopilot },
  'console/demo/route.ts': { module: ConsoleDemo },
  'console/export/route.ts': { module: ConsoleExport },
  'console/review/route.ts': { module: ConsoleReview },
  'console/settings/route.ts': { module: ConsoleSettings },

  'ai/diagnose/route.ts': { module: AiDiagnose },
  'ai/draft-message/route.ts': { module: AiDraftMessage },
  'chat/takeover/route.ts': { module: ChatTakeover },
  'live-trigger/route.ts': { module: LiveTrigger },
  'merchant/voice-clone/route.ts': { module: MerchantVoiceClone },
  'razorpay/subscriptions/route.ts': { module: RazorpaySubs },
  'razorpay/subscriptions/halt/route.ts': { module: RazorpaySubsHalt },
  'recovery/events/route.ts': { module: RecoveryEvents },
  'recovery/execute/route.ts': { module: RecoveryExecute },
  'recovery/reports/export/route.ts': { module: RecoveryReportsExport },
  'recovery/simulate/route.ts': { module: RecoverySimulate },
  'recovery/status/[reference]/route.ts': { module: RecoveryStatus, dummyParams: { params: Promise.resolve({ reference: 'sim_ref_12345' }) } },
  'recovery/stream/route.ts': { module: RecoveryStream },
  'recovery/suppress/route.ts': { module: RecoverySuppress },
  'recovery/tone-preview/route.ts': { module: RecoveryTonePreview },
};

function getAllRouteFiles(dir: string, baseDir = dir): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getAllRouteFiles(fullPath, baseDir));
    } else if (file.startsWith('route.ts') || file.startsWith('route.tsx')) {
      const rel = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      results.push(rel);
    }
  }
  return results;
}

describe('api-routes-guard: Route Inventory & Anonymous Defense in Depth', () => {
  const apiDir = path.resolve(__dirname, '../../apps/web/src/app/api');

  beforeEach(() => {
    delete process.env.RECOVERFLOW_ALLOW_ANON_DEMO;
    process.env.RECOVERFLOW_RUNTIME_MODE = 'TEST';
    getRateLimitStore().clear?.();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('verifies that every route in the filesystem is either in the guarded list or public allowlist', () => {
    const routeFiles = getAllRouteFiles(apiDir);
    expect(routeFiles.length).toBeGreaterThan(0);

    const unexpectedRoutes: string[] = [];

    for (const relPath of routeFiles) {
      const isPublic = PUBLIC_ALLOWLIST_ROUTES.has(relPath);
      const isGuarded = Object.prototype.hasOwnProperty.call(GUARDED_ROUTE_MODULES, relPath);

      if (!isPublic && !isGuarded) {
        unexpectedRoutes.push(relPath);
      }
    }

    expect(
      unexpectedRoutes,
      `Found unguarded/unclassified routes in apps/web/src/app/api! Add them to GUARDED_ROUTE_MODULES with tests, or explicitly to PUBLIC_ALLOWLIST_ROUTES: ${unexpectedRoutes.join(', ')}`
    ).toEqual([]);
  });

  for (const [routePath, config] of Object.entries(GUARDED_ROUTE_MODULES)) {
    describe(`Guarded route: /api/${routePath}`, () => {
      for (const method of HTTP_METHODS) {
        const handler = config.module[method];
        if (typeof handler === 'function') {
          it(`rejects anonymous ${method} with 401 when RECOVERFLOW_ALLOW_ANON_DEMO is unset`, async () => {
            // Guarantee anonymous environment
            delete process.env.RECOVERFLOW_ALLOW_ANON_DEMO;
            process.env.RECOVERFLOW_RUNTIME_MODE = 'TEST';

            const url = `http://localhost:3000/api/${routePath.replace('/route.ts', '').replace('/route.tsx', '')}`;
            const req = new NextRequest(url, {
              method,
              headers: {
                'Content-Type': 'application/json',
              },
              ...(method !== 'GET' ? { body: JSON.stringify({}) } : {}),
            });

            const res = config.dummyParams ? await handler(req, config.dummyParams) : await handler(req);
            expect(
              res.status,
              `Route /api/${routePath} method ${method} expected 401 when called anonymously, got ${res.status}`
            ).toBe(401);
          });
        }
      }
    });
  }
});
