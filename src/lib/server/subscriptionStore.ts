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
  dataSource?: 'razorpay_live' | 'local_fallback';
}

const INITIAL_DEMO_SUBSCRIPTIONS: TestSubscription[] = [
  {
    subscription_id: 'sub_TXdwpRFnHIme90',
    plan_id: 'plan_TXdwpE57FzejwX',
    plan_name: 'Global Payment Orchestrator',
    subscription_link: 'https://rzp.io/rzp/l7Lmydn',
    customer_id: 'cust_TXdwpRFnHIme90',
    customer_email: 'radhika.nair@globalvault.com',
    amount_paise: 7500000,
    next_due_on: '2026-09-30T00:00:00.000Z',
    created_at: '2026-09-03T17:16:55.000Z',
    status: 'created',
    dataSource: 'razorpay_live',
  },
  {
    subscription_id: 'sub_TXdwo7zLgvIhov',
    plan_id: 'plan_TXdwnsPYEZefFd',
    plan_name: 'Startup Accelerator Plan',
    subscription_link: 'https://rzp.io/rzp/JL1VfBVU',
    customer_id: 'cust_TXdwo7zLgvIhov',
    customer_email: 'karan.shroff@fintechlaunch.io',
    amount_paise: 99900,
    next_due_on: '2026-09-18T00:00:00.000Z',
    created_at: '2026-09-03T17:16:54.000Z',
    status: 'created',
    dataSource: 'razorpay_live',
  },
  {
    subscription_id: 'sub_TXdwms7QX6F6HY',
    plan_id: 'plan_TXdwmdp4jElb5q',
    plan_name: 'Scale Tier Quarterly Autopay',
    subscription_link: 'https://rzp.io/rzp/0UOWVfS',
    customer_id: 'cust_TXdwms7QX6F6HY',
    customer_email: 'vikram.singh@hypergrowth.tech',
    amount_paise: 2499900,
    next_due_on: '2026-10-15T00:00:00.000Z',
    created_at: '2026-09-03T17:16:53.000Z',
    status: 'created',
    dataSource: 'razorpay_live',
  },
  {
    subscription_id: 'sub_TXdwlWncCBeBuf',
    plan_id: 'plan_TXdwlMW9llKDfA',
    plan_name: 'FinTech Compliance Suite',
    subscription_link: 'https://rzp.io/rzp/ZML9D7m',
    customer_id: 'cust_TXdwlWncCBeBuf',
    customer_email: 'ananya.deshmukh@bharatpay.in',
    amount_paise: 1850000,
    next_due_on: '2026-09-25T00:00:00.000Z',
    created_at: '2026-09-03T17:16:52.000Z',
    status: 'created',
    dataSource: 'razorpay_live',
  },
  {
    subscription_id: 'sub_TXdwkIv72ok0Cj',
    plan_id: 'plan_TXdwjrA0U3wEht',
    plan_name: 'AI Copilot Add-On',
    subscription_link: 'https://rzp.io/rzp/Qv4oz6Bg',
    customer_id: 'cust_TXdwkIv72ok0Cj',
    customer_email: 'rohit.verma@neuralfin.ai',
    amount_paise: 349900,
    next_due_on: '2026-09-12T00:00:00.000Z',
    created_at: '2026-09-03T17:16:51.000Z',
    status: 'created',
    dataSource: 'razorpay_live',
  },
  {
    subscription_id: 'sub_TXdrqtDrqR91IV',
    plan_id: 'plan_TXdrqbKW7OuejG',
    plan_name: 'Developer API Subscription',
    subscription_link: 'https://rzp.io/rzp/x2ojWWF',
    customer_id: 'cust_TXdrqtDrqR91IV',
    customer_email: 'neha.patel@devstack.net',
    amount_paise: 1250000,
    next_due_on: '2026-09-05T00:00:00.000Z',
    created_at: '2026-09-03T17:12:12.000Z',
    status: 'created',
    dataSource: 'razorpay_live',
  },
  {
    subscription_id: 'sub_TXdrpbWWASct8j',
    plan_id: 'plan_TXdrpOBS7vr2zT',
    plan_name: 'Growth Autopay Plan',
    subscription_link: 'https://rzp.io/rzp/NHunz5h2',
    customer_id: 'cust_TXdrpbWWASct8j',
    customer_email: 'deepak.verma@scaleup.io',
    amount_paise: 499900,
    next_due_on: '2026-09-10T00:00:00.000Z',
    created_at: '2026-09-03T17:12:11.000Z',
    status: 'created',
    dataSource: 'razorpay_live',
  },
  {
    subscription_id: 'sub_TXdroGLUXyYIZO',
    plan_id: 'plan_TXdro5GE7dg51u',
    plan_name: 'Enterprise Annual Tier',
    subscription_link: 'https://rzp.io/rzp/e5G8pcyS',
    customer_id: 'cust_TXdroGLUXyYIZO',
    customer_email: 'arjun.mehta@fincloud.co',
    amount_paise: 5200000,
    next_due_on: '2026-09-20T00:00:00.000Z',
    created_at: '2026-09-03T17:12:10.000Z',
    status: 'created',
    dataSource: 'razorpay_live',
  },
  {
    subscription_id: 'sub_TXdrmwWFp4rrc3',
    plan_id: 'plan_TXdrmaT1ZglroT',
    plan_name: 'SaaS Pro Monthly',
    subscription_link: 'https://rzp.io/rzp/IjAxpIvF',
    customer_id: 'cust_TXdrmwWFp4rrc3',
    customer_email: 'priya.sharma@saasgrowth.in',
    amount_paise: 149900,
    next_due_on: '2026-09-15T00:00:00.000Z',
    created_at: '2026-09-03T17:12:09.000Z',
    status: 'created',
    dataSource: 'razorpay_live',
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
