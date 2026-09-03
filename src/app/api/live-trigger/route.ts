/**
 * PayBack AI — Judge-Triggered Live Failure API Endpoint.
 *
 * Route: POST /api/live-trigger
 *
 * Allows a judge or audience member (via mobile QR scan or test runner) to inject
 * a live test-mode Razorpay payment.failed event directly into the live recovery engine.
 *
 * Invariants:
 * 1. Strictly rate-limited (max 15 triggers per minute per client).
 * 2. Generates canonical Razorpay webhook payload structure.
 * 3. Enforces minor unit paise representation.
 * 4. Appends to liveWebhookStore for instantaneous reflection in the Command Center queue.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/server/rateLimiter';
import { liveWebhookStore } from '@/lib/server/liveWebhookStore';
import {
  mapRazorpayWebhookToFailedPayment,
  type RazorpayWebhookPayload,
} from '@/lib/adapters/razorpayWebhook';

export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limiting Check
    const forwardedFor = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const clientIp = forwardedFor.split(',')[0].trim();
    const rateLimit = checkRateLimit(clientIp, 15, 60000);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded for demo live-trigger.',
          message: `Maximum 15 triggers per minute allowed. Please wait ${rateLimit.resetInSeconds}s before triggering again.`,
          retryAfterSeconds: rateLimit.resetInSeconds,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.resetInSeconds),
            'X-RateLimit-Limit': '15',
            'X-RateLimit-Remaining': '0',
          },
        },
      );
    }

    // 2. Parse Trigger Parameters
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // Use defaults if empty body
      body = {};
    }

    const category = typeof body.category === 'string' && body.category
      ? body.category
      : 'bank_downtime';
    
    // Amount in paise (default ₹2,499 = 249900 paise)
    let amountPaise = typeof body.amountPaise === 'number' && body.amountPaise > 0
      ? Math.floor(body.amountPaise)
      : 249900;

    if (typeof body.amountRupees === 'number' && body.amountRupees > 0) {
      amountPaise = Math.floor(body.amountRupees * 100);
    }

    const judgeNote = typeof body.judgeNote === 'string' && body.judgeNote.trim()
      ? body.judgeNote.trim()
      : 'Judge Live Demo Injection';

    const rawId = typeof body.subscriptionId === 'string' && body.subscriptionId.trim()
      ? body.subscriptionId.trim()
      : typeof body.paymentId === 'string' && body.paymentId.trim()
      ? body.paymentId.trim()
      : `pay_judge_${Math.random().toString(36).slice(2, 8)}`;

    const isSubscription = rawId.startsWith('sub_');

    const method = typeof body.method === 'string' && body.method
      ? body.method
      : 'upi';

    // 3. Construct Canonical Razorpay Webhook Payload
    const nowSec = Math.floor(Date.now() / 1000);
    const eventName = isSubscription
      ? (category === 'invalid_mandate' ? 'subscription.halted' : category === 'customer_cancellation' ? 'subscription.cancelled' : 'subscription.halted')
      : 'payment.failed';

    const webhookPayload: RazorpayWebhookPayload = isSubscription
      ? {
          entity: 'event',
          account_id: 'acc_rzp_live_buildathon',
          event: eventName,
          created_at: nowSec,
          payload: {
            subscription: {
              entity: {
                id: rawId,
                plan_id: 'plan_live_saas_pro',
                customer_id: `cust_${rawId.replace(/^sub_/, '')}`,
                status: category === 'customer_cancellation' ? 'cancelled' : 'halted',
                paid_count: 3,
                remaining_count: 9,
                notes: {
                  amount: amountPaise,
                  judge_demo: 'true',
                  judge_note: judgeNote,
                  opt_out: 'false',
                  on_time_rate: 0.85,
                },
              },
            },
          },
        }
      : {
          entity: 'event',
          account_id: 'acc_rzp_live_buildathon',
          event: 'payment.failed',
          created_at: nowSec,
          payload: {
            payment: {
              entity: {
                id: rawId,
                amount: amountPaise,
                currency: 'INR',
                status: 'failed',
                method: method,
                customer_id: `cust_judge_${Math.floor(Math.random() * 9000 + 1000)}`,
                email: 'judge.review@buildathon.razorpay.com',
                contact: '+919876500000',
                error_code: 'BAD_REQUEST_ERROR',
                error_description: `Live test failure: ${category.replace(/_/g, ' ')} during processing.`,
                error_source: category === 'bank_downtime' ? 'issuing_bank' : 'gateway',
                error_step: 'payment_authorization',
                error_reason: category,
                created_at: nowSec,
                notes: {
                  judge_demo: 'true',
                  judge_note: judgeNote,
                  opt_out: 'false',
                  on_time_rate: 0.85,
                },
              },
            },
          },
        };

    // 4. Map & Ingest into Live Webhook Store
    const failedPayment = mapRazorpayWebhookToFailedPayment(webhookPayload);
    liveWebhookStore.addEvent(failedPayment);

    return NextResponse.json({
      success: true,
      message: 'Live test payment failure event successfully ingested!',
      payment: failedPayment,
      totalLiveEvents: liveWebhookStore.getCount(),
      rateLimitRemaining: rateLimit.remaining,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Failed to process live failure trigger', details: errorMsg },
      { status: 500 },
    );
  }
}
