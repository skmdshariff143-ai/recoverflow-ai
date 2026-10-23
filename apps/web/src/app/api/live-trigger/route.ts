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
 * 2. Authenticated for live credentials, demo-safe simulated execution allowed.
 * 3. Zod-validated trigger inputs.
 * 4. Minor unit paise representation.
 * 5. Appends to liveWebhookStore for instantaneous reflection in the Command Center queue.
 */

import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, enforceRouteAuth } from '@/lib/apiGuards';
import { liveWebhookStore } from '@recoverflow/core';
import {
  mapRazorpayWebhookToFailedPayment,
  type RazorpayWebhookPayload,
} from '@recoverflow/core';
import { z } from 'zod';

const LiveTriggerSchema = z.object({
  category: z.string().max(100).optional(),
  amountPaise: z.number().int().positive().max(100000000).optional(),
  amountRupees: z.number().positive().max(1000000).optional(),
  judgeNote: z.string().max(255).optional(),
  subscriptionId: z.string().max(100).optional(),
  paymentId: z.string().max(100).optional(),
  method: z.string().max(50).optional(),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limiting Check
    const rateLimitRes = await enforceRateLimit(req, 15, 60000);
    if (rateLimitRes) return rateLimitRes;

    // 2. Auth Guard
    const authRes = await enforceRouteAuth(req, {
      allowDemoSimulation: true,
      requiresLiveCredentials: process.env.RECOVERFLOW_RUNTIME_MODE !== 'DEMO',
    });
    if (authRes) return authRes;

    // 3. Parse & Validate Trigger Parameters
    let bodyRaw: unknown = {};
    try {
      bodyRaw = await req.json();
    } catch {
      bodyRaw = {};
    }

    const validated = LiveTriggerSchema.safeParse(bodyRaw);
    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid live-trigger payload', issues: validated.error.issues },
        { status: 400 }
      );
    }

    const body = validated.data;
    const category = body.category || 'bank_downtime';

    // Amount in paise (default ₹2,499 = 249900 paise)
    let amountPaise = body.amountPaise && body.amountPaise > 0
      ? Math.floor(body.amountPaise)
      : 249900;

    if (body.amountRupees && body.amountRupees > 0) {
      amountPaise = Math.floor(body.amountRupees * 100);
    }

    const judgeNote = body.judgeNote && body.judgeNote.trim()
      ? body.judgeNote.trim()
      : 'Judge Live Demo Injection';

    const rawId = body.subscriptionId && body.subscriptionId.trim()
      ? body.subscriptionId.trim()
      : body.paymentId && body.paymentId.trim()
      ? body.paymentId.trim()
      : `pay_judge_${Math.random().toString(36).slice(2, 8)}`;

    const isSubscription = rawId.startsWith('sub_');
    const method = body.method || 'upi';

    // 4. Construct Canonical Razorpay Webhook Payload
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

    // 5. Map & Ingest into Live Webhook Store
    const failedPayment = mapRazorpayWebhookToFailedPayment(webhookPayload);
    liveWebhookStore.addEvent(failedPayment);

    return NextResponse.json({
      success: true,
      message: 'Live test payment failure event successfully ingested!',
      payment: failedPayment,
      totalLiveEvents: liveWebhookStore.getCount(),
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
