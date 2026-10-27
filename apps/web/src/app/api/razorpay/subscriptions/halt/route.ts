import { NextRequest, NextResponse } from 'next/server';
import { subscriptionStore } from '@recoverflow/core';
import { liveWebhookStore } from '@recoverflow/core';
import { mapRazorpayWebhookToFailedPayment, type RazorpayWebhookPayload } from '@recoverflow/core';
import { enforceRateLimit } from '@/lib/apiGuards';
import { authorizeRequest } from '@/lib/routeAuth';
import { internalErrorResponse } from '@/lib/http';

export async function POST(req: NextRequest) {
  try {
    const rateLimitRes = await enforceRateLimit(req, 15, 60000);
    if (rateLimitRes) return rateLimitRes;

    const authRes = await authorizeRequest(req, 'recovery:execute', {
      allowAnonymousDemo: true,
    });
    if (!authRes.authorized) return authRes.response;

    let body: { subscriptionId?: unknown; action?: unknown; reason?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const subscriptionId = typeof body.subscriptionId === 'string' ? body.subscriptionId.trim() : '';
    if (!/^sub_[A-Za-z0-9]{6,40}$/.test(subscriptionId)) {
      return NextResponse.json(
        { error: 'Invalid subscriptionId: must match /^sub_[A-Za-z0-9]{6,40}$/' },
        { status: 400 }
      );
    }

    const action = body.action === 'cancel' ? 'cancelled' : 'halted';
    const reason = typeof body.reason === 'string' ? body.reason.slice(0, 255) : 'Mandate declined by issuing bank';

    const updated = subscriptionStore.updateStatus(subscriptionId, action, reason);
    const sub = updated ?? {
      subscription_id: subscriptionId,
      plan_id: 'plan_pro_monthly_01',
      plan_name: 'SaaS Pro Monthly',
      subscription_link: `https://rzp.io/i/${subscriptionId}`,
      customer_id: `cust_${subscriptionId.slice(4)}`,
      customer_email: 'subscriber@demo.in',
      amount_paise: 149900,
      next_due_on: new Date().toISOString(),
      created_at: new Date().toISOString(),
      status: action,
    };

    // Construct Razorpay Webhook Event for this state change
    const nowSec = Math.floor(Date.now() / 1000);
    const webhookPayload: RazorpayWebhookPayload = {
      entity: 'event',
      account_id: 'acc_rzp_live_buildathon',
      event: action === 'cancelled' ? 'subscription.cancelled' : 'subscription.halted',
      created_at: nowSec,
      payload: {
        subscription: {
          entity: {
            id: sub.subscription_id,
            plan_id: sub.plan_id,
            customer_id: sub.customer_id,
            status: action,
            paid_count: 2,
            remaining_count: 10,
            notes: {
              amount: sub.amount_paise,
              plan_name: sub.plan_name,
              reason: reason,
              opt_out: 'false',
              on_time_rate: 0.82,
            },
          },
        },
      },
    };

    const failedPayment = mapRazorpayWebhookToFailedPayment(webhookPayload);
    liveWebhookStore.addEvent(failedPayment);

    return NextResponse.json({
      success: true,
      message: `Subscription ${subscriptionId} status updated to '${action}' and webhook event ingested!`,
      subscription: sub,
      eventIngested: failedPayment,
      totalLiveEvents: liveWebhookStore.getCount(),
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    return internalErrorResponse('razorpay/subscriptions/halt', err, 'Failed to halt subscription');
  }
}
