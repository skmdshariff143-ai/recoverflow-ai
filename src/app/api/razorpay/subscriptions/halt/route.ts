import { NextRequest, NextResponse } from 'next/server';
import { subscriptionStore } from '@/lib/server/subscriptionStore';
import { liveWebhookStore } from '@/lib/server/liveWebhookStore';
import { mapRazorpayWebhookToFailedPayment, type RazorpayWebhookPayload } from '@/lib/adapters/razorpayWebhook';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const subscriptionId = typeof body.subscriptionId === 'string' && body.subscriptionId
      ? body.subscriptionId
      : 'sub_TXW1raR9Uus3ch';

    const action = body.action === 'cancel' ? 'cancelled' : 'halted';
    const reason = typeof body.reason === 'string' ? body.reason : 'Mandate declined by issuing bank';

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
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Failed to halt subscription', details: errorMsg }, { status: 500 });
  }
}
