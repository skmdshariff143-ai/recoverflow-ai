/**
 * PayBack AI — Test-Mode Subscription Store & Razorpay Adapter.
 *
 * Models Razorpay Subscriptions corresponding directly to the Razorpay Dashboard schema:
 * [Subscription Id, Plan Id, Subscription Link, Customer Id, Next Due on, Created At, Status]
 */

export interface TestSubscription {
  subscription_id: string;
  plan_id: string;
  plan_name: string;
  subscription_link: string;
  customer_id: string;
  customer_email: string;
  amount_paise: number;
  next_due_on: string;
  created_at: string;
  status: 'active' | 'created' | 'authenticated' | 'halted' | 'cancelled' | 'paused' | 'completed';
  failure_reason?: string;
}

const INITIAL_DEMO_SUBSCRIPTIONS: TestSubscription[] = [
  {
    subscription_id: 'sub_TXW1raR9Uus3ch',
    plan_id: 'plan_pro_monthly_01',
    plan_name: 'SaaS Pro Monthly',
    subscription_link: 'https://rzp.io/i/sub_TXW1raR9Uus3ch',
    customer_id: 'cust_TXW1raR9Uus3ch',
    customer_email: 'priya.sharma@saasgrowth.in',
    amount_paise: 149900,
    next_due_on: '2026-09-15T00:00:00.000Z',
    created_at: '2026-08-15T10:30:00.000Z',
    status: 'active',
  },
  {
    subscription_id: 'sub_Hk72Lp0Qrst89v',
    plan_id: 'plan_ent_annual_02',
    plan_name: 'Enterprise Annual Tier',
    subscription_link: 'https://rzp.io/i/sub_Hk72Lp0Qrst89v',
    customer_id: 'cust_Hk72Lp0Qrst89v',
    customer_email: 'arjun.mehta@fincloud.co',
    amount_paise: 5200000,
    next_due_on: '2026-09-20T00:00:00.000Z',
    created_at: '2026-07-01T08:00:00.000Z',
    status: 'active',
  },
  {
    subscription_id: 'sub_Bld99Replay01a',
    plan_id: 'plan_growth_tier_03',
    plan_name: 'Growth Autopay Plan',
    subscription_link: 'https://rzp.io/i/sub_Bld99Replay01a',
    customer_id: 'cust_Bld99Replay01a',
    customer_email: 'deepak.verma@scaleup.io',
    amount_paise: 499900,
    next_due_on: '2026-09-10T00:00:00.000Z',
    created_at: '2026-08-10T14:15:00.000Z',
    status: 'active',
  },
  {
    subscription_id: 'sub_Ent88SaaS999',
    plan_id: 'plan_dev_api_04',
    plan_name: 'Developer API Subscription',
    subscription_link: 'https://rzp.io/i/sub_Ent88SaaS999',
    customer_id: 'cust_Ent88SaaS999',
    customer_email: 'neha.patel@devstack.net',
    amount_paise: 1250000,
    next_due_on: '2026-09-05T00:00:00.000Z',
    created_at: '2026-08-05T16:45:00.000Z',
    status: 'active',
  },
];

class SubscriptionStore {
  private subscriptions: TestSubscription[] = [...INITIAL_DEMO_SUBSCRIPTIONS];

  getSubscriptions(): TestSubscription[] {
    return [...this.subscriptions];
  }

  getSubscription(id: string): TestSubscription | undefined {
    return this.subscriptions.find((s) => s.subscription_id === id);
  }

  addSubscription(sub: TestSubscription): void {
    const idx = this.subscriptions.findIndex((s) => s.subscription_id === sub.subscription_id);
    if (idx >= 0) {
      this.subscriptions[idx] = sub;
    } else {
      this.subscriptions.unshift(sub);
    }
  }

  updateStatus(id: string, status: TestSubscription['status'], reason?: string): TestSubscription | null {
    const sub = this.subscriptions.find((s) => s.subscription_id === id);
    if (sub) {
      sub.status = status;
      if (reason) sub.failure_reason = reason;
      return sub;
    }
    return null;
  }

  reset(): void {
    this.subscriptions = [...INITIAL_DEMO_SUBSCRIPTIONS];
  }
}

const globalForSub = globalThis as unknown as { subscriptionStore?: SubscriptionStore };
export const subscriptionStore = globalForSub.subscriptionStore ?? new SubscriptionStore();
globalForSub.subscriptionStore = subscriptionStore;
