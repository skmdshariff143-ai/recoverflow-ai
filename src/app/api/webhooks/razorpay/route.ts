/**
 * PayBack AI — Razorpay Webhook Ingestion Endpoint.
 *
 * Route: POST /api/webhooks/razorpay
 * Route: GET /api/webhooks/razorpay
 *
 * Accepts real and test-mode `payment.failed` webhook events from Razorpay,
 * validates cryptographic HMAC SHA-256 signatures, transforms payloads into
 * the engine's canonical schema, and registers them in the live cohort queue.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  verifyRazorpayWebhookSignature,
  mapRazorpayWebhookToFailedPayment,
  type RazorpayWebhookPayload,
} from '@/lib/adapters/razorpayWebhook';
import { checkRateLimit } from '@/lib/server/rateLimiter';
import { liveWebhookStore } from '@/lib/server/liveWebhookStore';

export async function POST(req: NextRequest) {
  try {
    const forwardedFor = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const clientIp = forwardedFor.split(',')[0].trim();
    const rateLimit = checkRateLimit(clientIp, 60, 60000);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded on webhook ingestion endpoint.',
          retryAfterSeconds: rateLimit.resetInSeconds,
        },
        { status: 429 },
      );
    }

    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature');
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // 1. Signature Verification
    if (secret) {
      const verification = verifyRazorpayWebhookSignature(rawBody, signature, secret);
      if (!verification.valid) {
        return NextResponse.json(
          {
            error: 'Webhook verification failed: Invalid cryptographic signature.',
            reason: verification.reason,
          },
          { status: 400 },
        );
      }
    }

    // 2. Parse JSON Payload
    let payload: RazorpayWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload structure' },
        { status: 400 },
      );
    }

    // 3. Filter for payment.failed events
    if (payload.event !== 'payment.failed') {
      return NextResponse.json({
        received: true,
        event: payload.event,
        message: `Ignored event '${payload.event}'. PayBack AI strictly processes 'payment.failed' recovery events.`,
      });
    }

    // 4. Map to Canonical FailedPayment Schema
    const failedPayment = mapRazorpayWebhookToFailedPayment(payload);

    // 5. Save to In-Memory Live Cohort Store
    liveWebhookStore.addEvent(failedPayment);

    return NextResponse.json({
      success: true,
      event: payload.event,
      paymentId: failedPayment.payment_id,
      amountPaise: failedPayment.amount,
      failureCategory: failedPayment.failure_category,
      invoiceTier: failedPayment.invoice_value_tier,
      totalLiveEvents: liveWebhookStore.getCount(),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Failed to process Razorpay webhook', details: errorMsg },
      { status: 500 },
    );
  }
}

export async function GET() {
  const events = liveWebhookStore.getEvents();
  return NextResponse.json({
    status: 'connected',
    adapter: 'razorpay_test_mode',
    webhookEndpoint: '/api/webhooks/razorpay',
    count: events.length,
    payments: events,
    timestamp: new Date().toISOString(),
  });
}

export async function DELETE() {
  liveWebhookStore.clear();
  return NextResponse.json({
    success: true,
    message: 'Live test-mode webhook queue cleared.',
    count: 0,
  });
}
