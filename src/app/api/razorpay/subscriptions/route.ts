import { NextRequest, NextResponse } from 'next/server';
import { subscriptionStore, type TestSubscription } from '@/lib/server/subscriptionStore';
import { fetchRazorpaySubscriptionsLive } from '@/lib/adapters/razorpaySubscriptionSync';

export async function GET() {
  const syncResult = await fetchRazorpaySubscriptionsLive();
  if (syncResult.success && syncResult.subscriptions.length > 0) {
    subscriptionStore.syncLiveSubscriptions(syncResult.subscriptions);
  }

  const subs = subscriptionStore.getSubscriptions();
  const allLive = subs.length > 0 && subs.every((s) => s.dataSource === 'razorpay_live');
  const someLive = subs.some((s) => s.dataSource === 'razorpay_live');

  return NextResponse.json({
    success: true,
    count: subs.length,
    dataSource: syncResult.success && allLive ? 'razorpay_live' : someLive ? 'mixed' : 'local_fallback',
    subscriptions: subs,
    liveSync: {
      synced: syncResult.success,
      totalReported: syncResult.totalCount,
      error: syncResult.error,
    },
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
    const customerEmail =
      typeof body.customerEmail === 'string' && body.customerEmail
        ? body.customerEmail
        : 'demo.subscriber@buildathon.in';

    let generatedSubId = `sub_${Math.random().toString(36).slice(2, 10)}`;
    let generatedPlanId = `plan_${Math.random().toString(36).slice(2, 8)}`;
    let shortUrl = `https://rzp.io/i/${generatedSubId}`;
    let dataSource: 'razorpay_live' | 'local_fallback' = 'local_fallback';
    let fallbackReason: string | undefined;

    // Check if test-mode credentials exist
    if (!keyId || !keySecret || !keyId.trim().startsWith('rzp_test_')) {
      fallbackReason = 'RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET missing or not starting with rzp_test_ in environment';
      console.warn(
        `⚠️ [Razorpay Subscriptions - LOCAL FALLBACK ACTIVATED] ${fallbackReason}. Generating deterministic mock subscription.`,
      );
    } else {
      const cleanKeyId = keyId.trim();
      const cleanSecret = keySecret.trim();
      const auth = Buffer.from(`${cleanKeyId}:${cleanSecret}`).toString('base64');

      try {
        // 1. Create Plan via official Razorpay Sandbox API
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
          const planErrorText = await planRes.text();
          fallbackReason = `Razorpay Plan Creation API failed with HTTP ${planRes.status}: ${planErrorText}`;
          console.error(`🚨 [Razorpay API Failure - Plan Creation] ${fallbackReason}`);
        } else {
          const planData = await planRes.json();
          generatedPlanId = planData.id;

          // 2. Create Subscription via official Razorpay Sandbox API
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
                customer_email: customerEmail,
                project: 'PayBack AI Buildathon',
              },
            }),
          });

          if (!subRes.ok) {
            const subErrorText = await subRes.text();
            fallbackReason = `Razorpay Subscription Creation API failed with HTTP ${subRes.status}: ${subErrorText}`;
            console.error(`🚨 [Razorpay API Failure - Subscription Creation] ${fallbackReason}`);
          } else {
            const subData = await subRes.json();
            generatedSubId = subData.id;
            shortUrl = subData.short_url || shortUrl;
            dataSource = 'razorpay_live';
            console.log(
              `✅ [Razorpay Live API Success] Genuine subscription created: ${generatedSubId} (Plan: ${generatedPlanId}, Link: ${shortUrl})`,
            );
          }
        }
      } catch (err: unknown) {
        const errorDetail = err instanceof Error ? err.stack ?? err.message : String(err);
        fallbackReason = `Network/Runtime exception calling Razorpay API: ${errorDetail}`;
        console.error(`🚨 [Razorpay API Network Error] ${fallbackReason}`);
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
      status: 'created',
      dataSource,
    };

    subscriptionStore.addSubscription(newSub);

    return NextResponse.json({
      success: true,
      dataSource,
      ...(fallbackReason ? { fallbackReason } : {}),
      message:
        dataSource === 'razorpay_live'
          ? 'Genuine Razorpay sandbox subscription created successfully!'
          : 'Local mock subscription created via deterministic fallback.',
      subscription: newSub,
      totalSubscriptions: subscriptionStore.getSubscriptions().length,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, dataSource: 'local_fallback', error: 'Failed to create subscription', details: errorMsg },
      { status: 500 },
    );
  }
}
