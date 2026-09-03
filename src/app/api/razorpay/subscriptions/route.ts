import { NextRequest, NextResponse } from 'next/server';
import { subscriptionStore, type TestSubscription } from '@/lib/server/subscriptionStore';

export async function GET() {
  const subs = subscriptionStore.getSubscriptions();
  return NextResponse.json({
    success: true,
    count: subs.length,
    subscriptions: subs,
    dashboardColumns: [
      'Subscription Id',
      'Plan Id',
      'Subscription Link',
      'Customer Id',
      'Next Due on',
      'Created At',
      'Status',
    ],
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    const planName = typeof body.planName === 'string' && body.planName ? body.planName : 'Custom SaaS Plan';
    const amountRupees = typeof body.amountRupees === 'number' && body.amountRupees > 0 ? body.amountRupees : 2499;
    const amountPaise = amountRupees * 100;
    const customerEmail = typeof body.customerEmail === 'string' && body.customerEmail ? body.customerEmail : 'demo.subscriber@buildathon.in';

    let generatedSubId = `sub_${Math.random().toString(36).slice(2, 10)}`;
    let generatedPlanId = `plan_${Math.random().toString(36).slice(2, 8)}`;
    let shortUrl = `https://rzp.io/i/${generatedSubId}`;

    // If real Razorpay test API keys are available, call Razorpay test API
    if (keyId && keySecret && keyId.startsWith('rzp_test_')) {
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

      try {
        // 1. Create Plan
        const planRes = await fetch('https://api.razorpay.com/v1/plans', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${auth}`,
          },
          body: JSON.stringify({
            period: 'monthly',
            interval: 1,
            item: {
              name: planName,
              amount: amountPaise,
              currency: 'INR',
              description: `Monthly subscription for ${planName}`,
            },
          }),
        });

        if (planRes.ok) {
          const planData = await planRes.json();
          generatedPlanId = planData.id;

          // 2. Create Subscription
          const subRes = await fetch('https://api.razorpay.com/v1/subscriptions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Basic ${auth}`,
            },
            body: JSON.stringify({
              plan_id: generatedPlanId,
              total_count: 12,
              quantity: 1,
              customer_notify: 1,
              notes: {
                project: 'PayBack AI Buildathon',
              },
            }),
          });

          if (subRes.ok) {
            const subData = await subRes.json();
            generatedSubId = subData.id;
            shortUrl = subData.short_url || shortUrl;
          }
        }
      } catch (err) {
        console.warn('[Razorpay API] Using deterministic sandbox fallback:', err);
      }
    }

    const newSub: TestSubscription = {
      subscription_id: generatedSubId,
      plan_id: generatedPlanId,
      plan_name: planName,
      subscription_link: shortUrl,
      customer_id: `cust_${generatedSubId.slice(4)}`,
      customer_email: customerEmail,
      amount_paise: amountPaise,
      next_due_on: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
      status: 'active',
    };

    subscriptionStore.addSubscription(newSub);

    return NextResponse.json({
      success: true,
      message: 'Test mode subscription created successfully!',
      subscription: newSub,
      totalSubscriptions: subscriptionStore.getSubscriptions().length,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Failed to create subscription', details: errorMsg }, { status: 500 });
  }
}
