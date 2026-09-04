/**
 * PayBack AI — Razorpay Live Subscription Sync Adapter.
 *
 * Pulls real subscription and plan portfolios directly from Razorpay Test-Mode API
 * (GET /v1/subscriptions and GET /v1/plans), maps them into the canonical TestSubscription
 * shape, and provides automatic pagination and resilient fallback.
 */

import type { TestSubscription } from '@/lib/server/subscriptionStore';

export interface RazorpayRawSubscription {
  id: string;
  entity?: string;
  plan_id: string;
  customer_id?: string | null;
  customer_email?: string | null;
  customer_contact?: string | null;
  status: string;
  current_start?: number | null;
  current_end?: number | null;
  ended_at?: number | null;
  quantity?: number;
  notes?: Record<string, string> | null;
  charge_at?: number | null;
  start_at?: number | null;
  end_at?: number | null;
  auth_attempts?: number;
  total_count?: number;
  paid_count?: number;
  customer_notify?: boolean | number;
  created_at?: number;
  expire_by?: number | null;
  short_url?: string;
  has_scheduled_changes?: boolean;
  change_scheduled_at?: number | null;
  source?: string;
  payment_method?: string | null;
  offer_id?: string | null;
  halted_at?: number | null;
  remaining_count?: number;
}

export interface RazorpayRawPlan {
  id: string;
  entity?: string;
  interval?: number;
  period?: string;
  item?: {
    id?: string;
    name?: string;
    amount?: number;
    currency?: string;
    description?: string;
  };
  notes?: Record<string, string> | null;
  created_at?: number;
}

export interface RazorpaySyncOptions {
  keyId?: string;
  keySecret?: string;
  pageSize?: number;
  maxPages?: number;
  fetchPlans?: boolean;
}

export interface RazorpaySyncResult {
  success: boolean;
  subscriptions: TestSubscription[];
  totalCount: number;
  dataSource: 'razorpay_live' | 'local_fallback';
  error?: string;
  fetchedAt: string;
}

/**
 * Normalizes Razorpay raw subscription status into canonical TestSubscription status.
 */
export function normalizeSubscriptionStatus(rawStatus: string): TestSubscription['status'] {
  const normalized = (rawStatus || '').toLowerCase().trim();
  switch (normalized) {
    case 'active':
      return 'active';
    case 'halted':
      return 'halted';
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    case 'paused':
      return 'paused';
    case 'authenticated':
      return 'authenticated';
    case 'completed':
      return 'completed';
    case 'created':
    default:
      return 'created';
  }
}

/**
 * Maps a single raw Razorpay subscription item and optional plan mapping into TestSubscription.
 */
export function mapRazorpaySubscription(
  raw: RazorpayRawSubscription,
  planMap?: Map<string, RazorpayRawPlan>,
): TestSubscription {
  const plan = planMap?.get(raw.plan_id);
  const planName =
    plan?.item?.name ||
    raw.notes?.plan_name ||
    (raw.notes?.project ? `${raw.notes.project} Plan` : `Subscription Plan (${raw.plan_id.slice(-6)})`);

  const amountPaise =
    plan?.item?.amount && plan.item.amount > 0
      ? plan.item.amount
      : raw.notes?.amount_paise
        ? Number(raw.notes.amount_paise)
        : 249900;

  const customerEmail =
    raw.notes?.customer_email ||
    raw.customer_email ||
    `subscriber.${raw.id.slice(4, 10).toLowerCase()}@buildathon.in`;

  const customerId =
    raw.customer_id ||
    raw.notes?.customer_id ||
    `cust_${raw.id.slice(4)}`;

  const createdEpochMs = (raw.created_at ? raw.created_at * 1000 : Date.now());
  const createdAtIso = new Date(createdEpochMs).toISOString();

  // Next due calculation: prefer charge_at, then current_end, then created_at + 30 days
  let nextDueIso: string;
  if (raw.charge_at && raw.charge_at > 0) {
    nextDueIso = new Date(raw.charge_at * 1000).toISOString();
  } else if (raw.current_end && raw.current_end > 0) {
    nextDueIso = new Date(raw.current_end * 1000).toISOString();
  } else {
    nextDueIso = new Date(createdEpochMs + 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  const shortUrl = raw.short_url || `https://rzp.io/i/${raw.id}`;

  return {
    subscription_id: raw.id,
    plan_id: raw.plan_id,
    plan_name: planName,
    subscription_link: shortUrl,
    customer_id: customerId,
    customer_email: customerEmail,
    amount_paise: amountPaise,
    next_due_on: nextDueIso,
    created_at: createdAtIso,
    status: normalizeSubscriptionStatus(raw.status),
    dataSource: 'razorpay_live',
  };
}

/**
 * Fetches the live portfolio of subscriptions directly from the Razorpay API.
 */
export async function fetchRazorpaySubscriptionsLive(
  options?: RazorpaySyncOptions,
): Promise<RazorpaySyncResult> {
  const keyId = (options?.keyId || process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (options?.keySecret || process.env.RAZORPAY_KEY_SECRET || '').trim();

  if (!keyId || !keySecret || !keyId.startsWith('rzp_test_')) {
    return {
      success: false,
      subscriptions: [],
      totalCount: 0,
      dataSource: 'local_fallback',
      error: 'Razorpay test credentials missing or invalid in environment.',
      fetchedAt: new Date().toISOString(),
    };
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const pageSize = options?.pageSize || 50;
  const maxPages = options?.maxPages || 5;
  const shouldFetchPlans = options?.fetchPlans !== false;

  try {
    // 1. Fetch Plans map for accurate plan names & amounts
    const planMap = new Map<string, RazorpayRawPlan>();
    if (shouldFetchPlans) {
      try {
        const plansRes = await fetch(`https://api.razorpay.com/v1/plans?count=100`, {
          headers: { Authorization: `Basic ${auth}` },
        });
        if (plansRes.ok) {
          const plansData = await plansRes.json();
          if (Array.isArray(plansData.items)) {
            for (const p of plansData.items) {
              if (p.id) planMap.set(p.id, p);
            }
          }
        }
      } catch (planErr) {
        console.warn('⚠️ [Razorpay Sync] Plan prefetch failed, continuing with subscriptions:', planErr);
      }
    }

    // 2. Fetch subscriptions with pagination support
    const allRawSubscriptions: RazorpayRawSubscription[] = [];
    let skip = 0;
    let page = 0;
    let totalCountReported = 0;

    while (page < maxPages) {
      const url = `https://api.razorpay.com/v1/subscriptions?count=${pageSize}&skip=${skip}`;
      const res = await fetch(url, {
        headers: { Authorization: `Basic ${auth}` },
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Razorpay API responded with HTTP ${res.status}: ${errText}`);
      }

      const data = await res.json();
      totalCountReported = data.count ?? (skip + (data.items?.length || 0));
      const items: RazorpayRawSubscription[] = data.items || [];

      if (items.length === 0) break;

      allRawSubscriptions.push(...items);
      skip += items.length;
      page += 1;

      // If we received fewer items than requested, we've reached the last page
      if (items.length < pageSize) break;
    }

    const mappedSubscriptions = allRawSubscriptions.map((item) =>
      mapRazorpaySubscription(item, planMap),
    );

    return {
      success: true,
      subscriptions: mappedSubscriptions,
      totalCount: totalCountReported,
      dataSource: 'razorpay_live',
      fetchedAt: new Date().toISOString(),
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('🚨 [Razorpay Sync Error]:', errorMsg);
    return {
      success: false,
      subscriptions: [],
      totalCount: 0,
      dataSource: 'local_fallback',
      error: errorMsg,
      fetchedAt: new Date().toISOString(),
    };
  }
}
