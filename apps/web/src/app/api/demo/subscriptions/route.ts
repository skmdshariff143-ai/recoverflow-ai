import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getRuntimeMode } from '@recoverflow/core';
import type { TestSubscription } from '@recoverflow/core';
import { checkRateLimit } from '@recoverflow/core';
import { route, ApiError } from '@/lib/server/access';

const state = globalThis as unknown as { recoverflowDemoSubscriptions?: TestSubscription[] };
function records() {
  if (!['DEMO', 'TEST'].includes(getRuntimeMode())) throw new ApiError(404, 'Subscription simulation is only available in demo mode.');
  state.recoverflowDemoSubscriptions ??= ['Starter monthly', 'Growth monthly', 'Scale annual'].map((name, index) => ({
    subscription_id: `sub_demo_${index + 1}`, plan_id: `plan_demo_${index + 1}`, plan_name: name,
    subscription_link: '/demo', customer_id: `customer_demo_${index + 1}`, customer_email: `sample${index + 1}@example.test`,
    amount_paise: [99900, 249900, 1999900][index], next_due_on: new Date(Date.now() + 7 * 86400000).toISOString(), created_at: new Date().toISOString(), status: 'active', dataSource: 'local_fallback',
  }));
  return state.recoverflowDemoSubscriptions;
}
function limit() { if (!checkRateLimit('demo-subscriptions', 20, 60000).allowed) throw new ApiError(429, 'Please wait a minute before changing another sample subscription.'); }
export const GET = route(async () => NextResponse.json({ success: true, source: 'DEMO', dataSource: 'local_fallback', subscriptions: records() }));
export const POST = route(async (request) => {
  const list = records(); limit();
  const parsed = z.object({ planName: z.string().trim().min(2).max(100), amountRupees: z.number().positive().max(1000000), customerEmail: z.email().max(254) }).safeParse(await request.json());
  if (!parsed.success) throw new ApiError(400, 'Enter a plan name, valid sample email, and an amount between 0 and 1,000,000 INR.');
  const input = parsed.data;
  const id = crypto.randomUUID();
  const subscription: TestSubscription = { subscription_id: `sub_demo_${id}`, plan_id: `plan_demo_${id}`, plan_name: input.planName, customer_id: `customer_demo_${id}`, customer_email: input.customerEmail, amount_paise: Math.round(input.amountRupees * 100), subscription_link: '/demo', next_due_on: new Date(Date.now() + 30 * 86400000).toISOString(), created_at: new Date().toISOString(), status: 'active', dataSource: 'local_fallback' };
  list.unshift(subscription);
  return NextResponse.json({ success: true, source: 'DEMO', subscription }, { status: 201 });
});
export const PATCH = route(async (request) => {
  const list = records(); limit();
  const parsed = z.object({ subscriptionId: z.string().min(1).max(100), action: z.enum(['halt', 'cancel']) }).safeParse(await request.json());
  if (!parsed.success) throw new ApiError(400, 'Choose a valid sample subscription and action.');
  const record = list.find((item) => item.subscription_id === parsed.data.subscriptionId);
  if (!record) throw new ApiError(404, 'Sample subscription not found.');
  if (record.status !== 'active') throw new ApiError(409, 'This sample subscription is no longer active.');
  record.status = parsed.data.action === 'halt' ? 'halted' : 'cancelled';
  return NextResponse.json({ success: true, source: 'DEMO', subscription: record });
});
