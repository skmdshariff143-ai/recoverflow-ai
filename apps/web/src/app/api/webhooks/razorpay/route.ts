/**
 * PayBack AI — Razorpay Webhook Ingestion Endpoint.
 *
 * Route: POST /api/webhooks/razorpay
 * Route: GET /api/webhooks/razorpay
 * Route: DELETE /api/webhooks/razorpay
 *
 * Accepts real and test-mode webhook events from Razorpay, validates cryptographic
 * HMAC SHA-256 signatures, transforms payloads into the engine's canonical schema,
 * and registers them in the live cohort queue.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  verifyRazorpayWebhookSignature,
  mapRazorpayWebhookToFailedPayment,
  type RazorpayWebhookPayload,
  liveWebhookStore,
} from '@recoverflow/core';
import { enforceRateLimit } from '@/lib/apiGuards';
import { authorizeRequest, isAnonymousDemoEnabled } from '@/lib/routeAuth';
import { internalErrorResponse } from '@/lib/http';

const SUPPORTED_EVENTS = new Set([
  'payment.failed',
  'payment.authorized',
  'payment.captured',
  'subscription.halted',
  'subscription.cancelled',
  'subscription.paused',
  'subscription.resumed',
]);

export async function POST(req: NextRequest) {
  try {
    const rateLimitRes = await enforceRateLimit(req, 60, 60000);
    if (rateLimitRes) return rateLimitRes;

    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature');
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // 1. Signature Verification
    if (signature) {
      if (!secret) {
        return NextResponse.json(
          { error: 'Service Unavailable: Webhook verification secret unconfigured' },
          { status: 503 }
        );
      }
      const verification = verifyRazorpayWebhookSignature(rawBody, signature, secret);
      if (!verification.valid) {
        console.warn(`[Razorpay Webhook] Signature verification rejected.`);
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      console.log(`[Razorpay Webhook] Signature verified: VALID (HMAC-SHA256).`);
    } else {
      // Signature header absent: fail closed unless anonymous demo is explicitly enabled
      if (!isAnonymousDemoEnabled()) {
        return NextResponse.json(
          { error: 'Unauthorized: Webhook signature required' },
          { status: 401 }
        );
      }
      console.log(`[Razorpay Webhook] Unsigned event accepted in demo mode.`);
    }

    // 2. Parse JSON Payload
    let payload: RazorpayWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload structure' },
        { status: 400 }
      );
    }

    if (!payload || typeof payload !== 'object' || !payload.event) {
      return NextResponse.json(
        { error: 'Invalid webhook payload: missing event' },
        { status: 400 }
      );
    }

    console.log(`[Razorpay Webhook] Processing event: '${payload.event}'`);

    // 3. Strict allowlist of supported recovery events
    if (!SUPPORTED_EVENTS.has(payload.event)) {
      return NextResponse.json(
        { error: `Unsupported or unknown webhook event: '${payload.event}'` },
        { status: 400 }
      );
    }

    const countBefore = liveWebhookStore.getCount();

    // 4. Map to Canonical FailedPayment Schema
    const failedPayment = mapRazorpayWebhookToFailedPayment(payload);

    // 5. Save to In-Memory Live Cohort Store
    liveWebhookStore.addEvent(failedPayment);
    const countAfter = liveWebhookStore.getCount();

    console.log(
      `[Razorpay Webhook] Appended event to store. ID: ${failedPayment.payment_id}, Event: ${payload.event}, Category: ${failedPayment.failure_category}, Events count: ${countBefore} -> ${countAfter}`
    );

    return NextResponse.json({
      success: true,
      event: payload.event,
      paymentId: failedPayment.payment_id,
      amountPaise: failedPayment.amount,
      failureCategory: failedPayment.failure_category,
      invoiceTier: failedPayment.invoice_value_tier,
      totalLiveEvents: countAfter,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    return internalErrorResponse('webhooks/razorpay', err, 'Failed to process Razorpay webhook');
  }
}

export async function GET(req: NextRequest) {
  try {
    
    const authRes = await authorizeRequest(req, 'audit:view', { allowAnonymousDemo: true });
    if (!authRes.authorized) return authRes.response;

    const events = liveWebhookStore.getEvents();
    return NextResponse.json({
      status: 'connected',
      adapter: 'razorpay_test_mode',
      webhookEndpoint: '/api/webhooks/razorpay',
      count: events.length,
      payments: events,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    return internalErrorResponse('webhooks/razorpay:get', err, 'Failed to retrieve webhook events');
  }
}

export async function DELETE(req: NextRequest) {
  try {
    
    const requiredPermission = ['LIVE', 'SANDBOX'].includes(process.env.RECOVERFLOW_RUNTIME_MODE || '')
      ? 'integration:manage'
      : 'recovery:execute';
    const authRes = await authorizeRequest(req, requiredPermission, { allowAnonymousDemo: true });
    if (!authRes.authorized) return authRes.response;

    liveWebhookStore.clear();
    return NextResponse.json({
      success: true,
      message: 'Live test-mode webhook queue cleared.',
      count: 0,
    });
  } catch (err: unknown) {
    return internalErrorResponse('webhooks/razorpay:delete', err, 'Failed to clear webhook queue');
  }
}
