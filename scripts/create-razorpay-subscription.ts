/**
 * Script: create-razorpay-subscription.ts
 *
 * Programmatically creates a plan and test subscription in Razorpay Sandbox mode
 * or dispatches test subscriptions to the local/live API.
 */

async function main() {
  const host = process.env.TARGET_HOST || 'http://localhost:3000';
  console.log(`[Seed Subscriptions] Target host: ${host}`);

  const demoPlans = [
    { name: 'SaaS Pro Monthly', amountRupees: 1499, email: 'priya.sharma@saasgrowth.in' },
    { name: 'Enterprise Annual Tier', amountRupees: 52000, email: 'arjun.mehta@fincloud.co' },
    { name: 'Growth Autopay Plan', amountRupees: 4999, email: 'deepak.verma@scaleup.io' },
    { name: 'Developer API Subscription', amountRupees: 12500, email: 'neha.patel@devstack.net' },
  ];

  for (const plan of demoPlans) {
    try {
      const res = await fetch(`${host}/api/razorpay/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planName: plan.name,
          amountRupees: plan.amountRupees,
          customerEmail: plan.email,
        }),
      });
      const data = await res.json();
      console.log(`✓ [${data.dataSource || 'unknown'}] Created Subscription for "${plan.name}":`, data.subscription?.subscription_id, `(Link: ${data.subscription?.subscription_link})`);
      if (data.dataSource === 'local_fallback' && data.fallbackReason) {
        console.warn(`  ⚠️ Fallback Reason: ${data.fallbackReason}`);
      }
    } catch (err) {
      console.error(`Failed to create plan ${plan.name}:`, err);
    }
  }

  console.log('[Seed Subscriptions] Complete!');
}

main().catch(console.error);
