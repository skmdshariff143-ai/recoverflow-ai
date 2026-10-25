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
 * 2. Authenticated via routeAuth, demo-safe simulated execution allowed.
 * 3. Zod-validated trigger inputs.
 * 4. Minor unit paise representation.
 * 5. Appends to liveWebhookStore for instantaneous reflection in the Command Center queue.
 */

import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/apiGuards';
import { authorizeRequest } from '@/lib/routeAuth';
import { internalErrorResponse } from '@/lib/http';
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
    const authRes = await authorizeRequest(req, 'recovery:execute', {
      allowAnonymousDemo: true,
    });
    if (!authRes.authorized) return authRes.response;

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

    const isSubscription = rawId.startsWith('sub_') || category === 'mandate_revoked' || category === 'invalid_mandate';
    const method = body.method || 'card';
    const subId = rawId;
    const paymentId = rawId;
    const nowSec = Math.floor(Date.now() / 1000);

    // 4. Construct Synthetic Event Payload
    const webhookPayload: RazorpayWebhookPayload = isSubscription
      ? {
          entity: 'event',
          account_id: 'acc_rzp_live_buildathon',
          event: 'subscription.halted',
          created_at: nowSec,
          payload: {
            subscription: {
              entity: {
                id: subId,
                plan_id: 'plan_pro_monthly_01',
                customer_id: 'cust_judge_demo',
                status: 'halted',
                paid_count: 3,
                remaining_count: 9,
                notes: {
                  amount: amountPaise,
                  reason: 'Customer cancelled mandate via UPI autopay app',
                  on_time_rate: 0.88,
                  opt_out: 'false',
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
                id: paymentId,
                amount: amountPaise,
                currency: 'INR',
                status: 'failed',
                order_id: `order_live_${Date.now()}`,
                invoice_id: null,
                international: false,
                method: method,
                customer_id: `cust_judge_${Math.floor(Math.random() * 9000 + 1000)}`,
                amount_refunded: 0,
                refund_status: null,
                captured: false,
                description: `Live Judge Trigger: ${judgeNote}`,
                card_id: method === 'card' ? 'card_live_visa_demo' : null,
                bank: method === 'netbanking' ? 'HDFC' : null,
                wallet: null,
                vpa: method === 'upi' ? 'judge@okhdfcbank' : null,
                email: 'evaluator.judge@buildathon.in',
                contact: '+919876543210',
                notes: {
                  project: 'PayBack AI',
                  category: category,
                  judge_note: judgeNote,
                },
                error_code: category === 'bank_downtime'
                  ? 'GATEWAY_ERROR'
                  : category === 'insufficient_funds'
                    ? 'BAD_REQUEST_ERROR'
                    : 'PAYMENT_FAILED',
                error_description: category === 'bank_downtime'
                  ? 'Issuing bank network connection timed out during 2FA challenge'
                  : category === 'insufficient_funds'
                    ? 'Account has insufficient balance to honor debit'
                    : `Simulated gateway rejection: ${category}`,
                error_source: 'gateway',
                error_step: 'payment_authorization',
                error_reason: category === 'bank_downtime' ? 'bank_downtime' : category,
                created_at: nowSec,
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
  } catch (err: unknown) {
    return internalErrorResponse('live-trigger', err, 'Failed to process live failure trigger');
  }
}
