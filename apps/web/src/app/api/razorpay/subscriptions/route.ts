import { NextRequest, NextResponse } from 'next/server';
import { subscriptionStore, getRuntimeMode, type TestSubscription } from '@recoverflow/core';
import { enforceRateLimit } from '@/lib/apiGuards';
import { authorizeRequest } from '@/lib/routeAuth';
import { internalErrorResponse } from '@/lib/http';

export async function GET(req: NextRequest) {
  try {
    const authRes = await authorizeRequest(req, 'policy:view', { allowAnonymousDemo: true });
    if (!authRes.authorized) return authRes.response;

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
  } catch (err: unknown) {
    return internalErrorResponse('razorpay/subscriptions:GET', err, 'Failed to fetch subscriptions');
  }
}

export async function POST(req: NextRequest) {
  try {
    const rateLimitRes = await enforceRateLimit(req, 10, 60000);
    if (rateLimitRes) return rateLimitRes;

    // Creating real Razorpay resources always requires a real authenticated session with integration:manage
    const authRes = await authorizeRequest(req, 'integration:manage', {
      allowAnonymousDemo: false,
    });
    if (!authRes.authorized) return authRes.response;

    let body: { planName?: unknown; amountRupees?: unknown; customerEmail?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const mode = getRuntimeMode();

    const planName = typeof body.planName === 'string' && body.planName ? body.planName : 'Custom SaaS Plan';
    const amountRupees = typeof body.amountRupees === 'number' && body.amountRupees > 0 ? body.amountRupees : 2499;
    const amountPaise = amountRupees * 100;
    const customerEmail = typeof body.customerEmail === 'string' && body.customerEmail ? body.customerEmail : 'demo.subscriber@buildathon.in';

    const hasApiCredentials = Boolean(keyId && keySecret && keyId.startsWith('rzp_test_'));

    // In LIVE or SANDBOX, credentials MUST be configured; simulated path is strictly disallowed
    if (!hasApiCredentials) {
      if (mode !== 'DEMO' && mode !== 'TEST') {
        return NextResponse.json(
          { error: 'Razorpay API credentials are not configured in this runtime mode.' },
          { status: 503 }
        );
      }
    }

    let generatedSubId = `sub_${Math.random().toString(36).slice(2, 10)}`;
    let generatedPlanId = `plan_${Math.random().toString(36).slice(2, 8)}`;
    let shortUrl = `https://rzp.io/i/${generatedSubId}`;
    let isSimulated = false;

    // When real credentials are configured, execute upstream Razorpay API calls
    if (hasApiCredentials) {
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

      // 1. Create Plan upstream
      let planData: { id: string } | null = null;
      try {
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

        if (!planRes.ok) {
          const errBody = await planRes.text().catch(() => '');
          console.error('[Razorpay API] Plan creation upstream failure:', planRes.status, errBody);
          return NextResponse.json(
            { error: 'Upstream payment gateway error: failed to create subscription plan.' },
            { status: 502 }
          );
        }

        planData = await planRes.json();
      } catch (err: unknown) {
        console.error('[Razorpay API] Network connection failure during plan creation:', err);
        return NextResponse.json(
          { error: 'Upstream payment gateway unavailable.' },
          { status: 502 }
        );
      }

      if (!planData?.id) {
        return NextResponse.json(
          { error: "Failed to create plan upstream" },
          { status: 502 }
        );
      }
      generatedPlanId = planData.id;

      // 2. Create Subscription upstream
      try {
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

        if (!subRes.ok) {
          const errBody = await subRes.text().catch(() => '');
          console.error('[Razorpay API] Subscription creation upstream failure:', subRes.status, errBody);
          return NextResponse.json(
            { error: 'Upstream payment gateway error: failed to create subscription.' },
            { status: 502 }
          );
        }

        const subData = await subRes.json();
        generatedSubId = subData.id;
        shortUrl = subData.short_url || shortUrl;
      } catch (err: unknown) {
        console.error('[Razorpay API] Network connection failure during subscription creation:', err);
        return NextResponse.json(
          { error: 'Upstream payment gateway unavailable.' },
          { status: 502 }
        );
      }
    } else {
      // In DEMO / TEST mode without credentials, explicit simulated fallback
      isSimulated = true;
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
      dataSource: isSimulated ? 'local_fallback' : 'razorpay_live',
      simulated: isSimulated,
    };

    subscriptionStore.addSubscription(newSub);

    return NextResponse.json({
      success: true,
      simulated: isSimulated,
      message: isSimulated
        ? 'Simulated demo subscription created successfully!'
        : 'Test mode subscription created successfully!',
      subscription: newSub,
      totalSubscriptions: subscriptionStore.getSubscriptions().length,
    });
  } catch (err: unknown) {
    return internalErrorResponse('razorpay/subscriptions:POST', err, 'Failed to create subscription');
  }
}
