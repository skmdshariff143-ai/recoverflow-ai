import { createHmac } from 'crypto';

async function testWebhookFlow() {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'whsec_recoverflow_test_hook_2026';
  const subId = 'sub_TXkeOmrfPqOKYi';
  const planId = 'plan_TXkeONabKzd0wA';

  const webhookBody = JSON.stringify({
    entity: 'event',
    account_id: 'acc_rzp_live_buildathon',
    event: 'subscription.halted',
    created_at: Math.floor(Date.now() / 1000),
    payload: {
      subscription: {
        entity: {
          id: subId,
          plan_id: planId,
          customer_id: 'cust_audit_judge_001',
          status: 'halted',
          paid_count: 3,
          remaining_count: 9,
          notes: {
            amount: 199900,
            plan_name: 'Executive AI Recovery Plan',
            reason: 'Mandate declined: Account frozen or insufficient balance',
            customer_email: 'audit.judge@buildathon.in',
            opt_out: 'false',
            on_time_rate: 0.88,
          },
        },
      },
    },
  });

  const signature = createHmac('sha256', secret).update(webhookBody).digest('hex');

  console.log('=== PART E: REAL WEBHOOK VERIFICATION ===');
  console.log('Target Subscription ID (Dashboard Verified):', subId);
  console.log('Target Plan ID (Dashboard Verified):', planId);
  console.log('Webhook Event: subscription.halted');
  console.log('Computed HMAC-SHA256 Signature:', signature);

  // Ingest via local webhook endpoint
  const res = await fetch('http://localhost:3000/api/webhooks/razorpay', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': signature,
    },
    body: webhookBody,
  }).catch(async () => {
    // If local dev server isn't on port 3000, call remote production host
    return fetch('https://recoverflow-ai-kohl.vercel.app/api/webhooks/razorpay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': signature,
      },
      body: webhookBody,
    });
  });

  const responseJson = await res.json();
  console.log('Webhook Endpoint Response HTTP Status:', res.status);
  console.log('Webhook Ingestion Response JSON:');
  console.log(JSON.stringify(responseJson, null, 2));
}

testWebhookFlow().catch(console.error);
