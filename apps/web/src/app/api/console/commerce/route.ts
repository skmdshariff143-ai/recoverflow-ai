import { NextResponse } from 'next/server';
import { db } from '@/lib/server/database';
import { route, requireSession } from '@/lib/server/access';
import { maskIdentifier } from '@/lib/console-types';

export const GET = route(async (request) => {
  const session = await requireSession(request, 'financials:view');
  const [carts, metrics] = await Promise.all([db.getCartEventsByMerchant(session.activeMerchantId), db.getExperimentMetrics(session.activeMerchantId)]);
  return NextResponse.json({
    totalCarts: carts.length,
    carts: carts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 200).map((cart) => ({
      id: cart.id, customer: maskIdentifier(cart.customerEmail || cart.customerPhone), status: cart.status, stage: cart.recoveryStage,
      // Do not silently round historical decimal-only records.
      amountMinor: cart.totalAmountMinor === undefined ? null : String(cart.totalAmountMinor), currency: cart.currency,
      items: cart.items.map((item) => ({ title: item.title, quantity: item.quantity })), updatedAt: new Date(cart.updatedAt).toISOString(),
    })),
    experiments: metrics.map(({ armId, strategyName, impressions, conversions, conversionRateBps }) => ({ armId, strategyName, impressions, conversions, conversionRateBps })),
  });
});
