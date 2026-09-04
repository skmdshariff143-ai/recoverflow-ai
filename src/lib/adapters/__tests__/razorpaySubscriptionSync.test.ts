import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  mapRazorpaySubscription,
  normalizeSubscriptionStatus,
  fetchRazorpaySubscriptionsLive,
  type RazorpayRawSubscription,
  type RazorpayRawPlan,
} from '../razorpaySubscriptionSync';

describe('Razorpay Live Subscription Sync Adapter', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('normalizeSubscriptionStatus', () => {
    it('normalizes various status casing and synonyms accurately', () => {
      expect(normalizeSubscriptionStatus('active')).toBe('active');
      expect(normalizeSubscriptionStatus('ACTIVE')).toBe('active');
      expect(normalizeSubscriptionStatus('halted')).toBe('halted');
      expect(normalizeSubscriptionStatus('cancelled')).toBe('cancelled');
      expect(normalizeSubscriptionStatus('canceled')).toBe('cancelled');
      expect(normalizeSubscriptionStatus('paused')).toBe('paused');
      expect(normalizeSubscriptionStatus('authenticated')).toBe('authenticated');
      expect(normalizeSubscriptionStatus('completed')).toBe('completed');
      expect(normalizeSubscriptionStatus('created')).toBe('created');
      expect(normalizeSubscriptionStatus('unknown_status')).toBe('created');
    });
  });

  describe('mapRazorpaySubscription', () => {
    it('correctly maps raw Razorpay API subscription item and plan details to TestSubscription', () => {
      const rawSub: RazorpayRawSubscription = {
        id: 'sub_TXkqfseDOItjGK',
        plan_id: 'plan_TXkqf6iIK0P97Z',
        status: 'created',
        created_at: 1788455817,
        short_url: 'https://rzp.io/rzp/lipGBrJ',
        notes: {
          customer_email: 'security.auditor@buildathon.in',
          project: 'PayBack AI Buildathon',
        },
      };

      const planMap = new Map<string, RazorpayRawPlan>([
        [
          'plan_TXkqf6iIK0P97Z',
          {
            id: 'plan_TXkqf6iIK0P97Z',
            item: {
              name: 'Enterprise AI Autopay Tier (Rotated Key)',
              amount: 1499900,
              currency: 'INR',
            },
          },
        ],
      ]);

      const mapped = mapRazorpaySubscription(rawSub, planMap);

      expect(mapped.subscription_id).toBe('sub_TXkqfseDOItjGK');
      expect(mapped.plan_id).toBe('plan_TXkqf6iIK0P97Z');
      expect(mapped.plan_name).toBe('Enterprise AI Autopay Tier (Rotated Key)');
      expect(mapped.amount_paise).toBe(1499900);
      expect(mapped.customer_email).toBe('security.auditor@buildathon.in');
      expect(mapped.customer_id).toBe('cust_TXkqfseDOItjGK');
      expect(mapped.subscription_link).toBe('https://rzp.io/rzp/lipGBrJ');
      expect(mapped.status).toBe('created');
      expect(mapped.dataSource).toBe('razorpay_live');
      expect(mapped.created_at).toBe(new Date(1788455817 * 1000).toISOString());
    });

    it('computes next_due_on from charge_at, current_end, or fallback 30 days', () => {
      const rawWithChargeAt: RazorpayRawSubscription = {
        id: 'sub_123',
        plan_id: 'plan_123',
        status: 'active',
        charge_at: 1788550000,
      };
      const mapped1 = mapRazorpaySubscription(rawWithChargeAt);
      expect(mapped1.next_due_on).toBe(new Date(1788550000 * 1000).toISOString());

      const rawWithCurrentEnd: RazorpayRawSubscription = {
        id: 'sub_456',
        plan_id: 'plan_456',
        status: 'active',
        current_end: 1788650000,
      };
      const mapped2 = mapRazorpaySubscription(rawWithCurrentEnd);
      expect(mapped2.next_due_on).toBe(new Date(1788650000 * 1000).toISOString());

      const rawFallback: RazorpayRawSubscription = {
        id: 'sub_789',
        plan_id: 'plan_789',
        status: 'created',
        created_at: 1788000000,
      };
      const mapped3 = mapRazorpaySubscription(rawFallback);
      const expectedFallback = new Date(1788000000 * 1000 + 30 * 24 * 60 * 60 * 1000).toISOString();
      expect(mapped3.next_due_on).toBe(expectedFallback);
    });
  });

  describe('fetchRazorpaySubscriptionsLive', () => {
    it('returns local_fallback when credentials are not configured', async () => {
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;

      const result = await fetchRazorpaySubscriptionsLive();
      expect(result.success).toBe(false);
      expect(result.dataSource).toBe('local_fallback');
      expect(result.subscriptions).toHaveLength(0);
    });

    it('handles pagination across multiple pages of subscriptions from Razorpay API', async () => {
      process.env.RAZORPAY_KEY_ID = 'rzp_test_mockKey123';
      process.env.RAZORPAY_KEY_SECRET = 'mockSecret123';

      const mockFetch = vi.fn();
      globalThis.fetch = mockFetch;

      // Mock plans endpoint
      mockFetch.mockImplementationOnce(async (url: string) => {
        if (url.includes('/v1/plans')) {
          return {
            ok: true,
            json: async () => ({
              items: [
                { id: 'plan_A', item: { name: 'Plan A', amount: 100000 } },
                { id: 'plan_B', item: { name: 'Plan B', amount: 200000 } },
              ],
            }),
          };
        }
        return { ok: false };
      });

      // Mock subscription page 1 (2 items, pageSize = 2)
      mockFetch.mockImplementationOnce(async (url: string) => {
        expect(url).toContain('count=2');
        expect(url).toContain('skip=0');
        return {
          ok: true,
          json: async () => ({
            count: 3,
            items: [
              { id: 'sub_001', plan_id: 'plan_A', status: 'created', created_at: 1700000000 },
              { id: 'sub_002', plan_id: 'plan_B', status: 'active', created_at: 1700000100 },
            ],
          }),
        };
      });

      // Mock subscription page 2 (1 item, indicating last page)
      mockFetch.mockImplementationOnce(async (url: string) => {
        expect(url).toContain('count=2');
        expect(url).toContain('skip=2');
        return {
          ok: true,
          json: async () => ({
            count: 3,
            items: [
              { id: 'sub_003', plan_id: 'plan_A', status: 'halted', created_at: 1700000200 },
            ],
          }),
        };
      });

      const result = await fetchRazorpaySubscriptionsLive({
        pageSize: 2,
        maxPages: 3,
      });

      expect(result.success).toBe(true);
      expect(result.dataSource).toBe('razorpay_live');
      expect(result.subscriptions).toHaveLength(3);
      expect(result.subscriptions[0].subscription_id).toBe('sub_001');
      expect(result.subscriptions[0].plan_name).toBe('Plan A');
      expect(result.subscriptions[1].subscription_id).toBe('sub_002');
      expect(result.subscriptions[1].plan_name).toBe('Plan B');
      expect(result.subscriptions[2].subscription_id).toBe('sub_003');
      expect(result.subscriptions[2].status).toBe('halted');
    });

    it('handles network failure gracefully with local_fallback and error details', async () => {
      process.env.RAZORPAY_KEY_ID = 'rzp_test_mockKey123';
      process.env.RAZORPAY_KEY_SECRET = 'mockSecret123';

      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection timeout to Razorpay API'));

      const result = await fetchRazorpaySubscriptionsLive();
      expect(result.success).toBe(false);
      expect(result.dataSource).toBe('local_fallback');
      expect(result.error).toContain('Connection timeout');
    });
  });
});
