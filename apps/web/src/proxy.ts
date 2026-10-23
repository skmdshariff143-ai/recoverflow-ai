import { NextRequest, NextResponse } from 'next/server';

// Evaluation routes do not have a tenant-scoped execution contract.
// New console endpoints authorize inside their own handlers as well.
export function proxy(request: NextRequest) {
  const mode = (process.env.RECOVERFLOW_RUNTIME_MODE || 'DEMO').toUpperCase();
  const path = request.nextUrl.pathname;
  const durable = mode === 'LIVE' || mode === 'SANDBOX';
  if (!['DEMO', 'TEST', 'LIVE', 'SANDBOX'].includes(mode)) return NextResponse.json({ error: 'Invalid runtime configuration.' }, { status: 503 });
  if (durable && ['/demo', '/trigger', '/ecommerce'].some((prefix) => path === prefix || path.startsWith(prefix + '/'))) return NextResponse.redirect(new URL('/overview', request.url));
  if (durable && path.startsWith('/api/') && !path.startsWith('/api/console') && !['/api/auth/session', '/api/health', '/api/ready'].includes(path)) {
    return NextResponse.json({ error: 'This legacy integration endpoint is available only in the isolated demo. Live provider activation requires the tenant-scoped integration rollout.' }, { status: 503 });
  }
  if (!durable && (path.startsWith('/api/razorpay/') || path.startsWith('/api/auth/shopify') || path === '/api/merchant/voice-clone')) {
    return NextResponse.json({ error: 'External provider actions are disabled in demo mode.' }, { status: 403 });
  }
  if (!durable && path === '/api/recovery/execute' && request.headers.get('x-recovery-adapter') === 'razorpay_test_mode') {
    return NextResponse.json({ error: 'Provider execution is disabled in demo mode. Use the deterministic simulator.' }, { status: 403 });
  }
  return NextResponse.next();
}
export const config = { matcher: ['/api/:path*', '/demo/:path*', '/trigger/:path*', '/ecommerce/:path*'] };
