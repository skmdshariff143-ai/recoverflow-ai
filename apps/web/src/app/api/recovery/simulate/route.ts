import { NextRequest, NextResponse } from 'next/server';
import { db, type CartEvent, type AbandonmentType } from '@recoverflow/core';
import { globalRecoveryQueue } from '@recoverflow/jobs';
import { enforceRateLimit } from '@/lib/apiGuards';
import { authorizeRequest } from '@/lib/routeAuth';
import { internalErrorResponse } from '@/lib/http';
import { z } from 'zod';

const SimulateRequestSchema = z.object({
  type: z.enum(['PAYMENT_FAILED', 'CART_ABANDONED', 'CHECKOUT_DROPOFF', 'EXIT_INTENT', 'CHECKOUT_STEP']).optional(),
  customerName: z.string().trim().max(100).optional(),
  amount: z.number().positive().max(1000000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rateLimitRes = await enforceRateLimit(req, 20, 60000);
    if (rateLimitRes) return rateLimitRes;

    const authRes = await authorizeRequest(req, 'recovery:execute', { allowAnonymousDemo: true });
    if (!authRes.authorized) return authRes.response;
    const { session } = authRes;

    let rawBody: unknown = {};
    try {
      rawBody = await req.json();
    } catch {
      rawBody = {};
    }

    const validated = SimulateRequestSchema.safeParse(rawBody);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid simulation payload', issues: validated.error.issues },
        { status: 400 }
      );
    }

    const body = validated.data;
    const type: AbandonmentType = (body.type as AbandonmentType) || 'PAYMENT_FAILED';

    let merchant = await db.getMerchant(session.activeMerchantId);
    if (!merchant && db.listMerchants) {
      const all = await db.listMerchants();
      merchant = all.find((m) => m.id === session.activeMerchantId) || all[0] || null;
    }

    if (!merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    const randomId = Math.random().toString(36).slice(2, 7);
    const names = ['Liam Gallagher', 'Sophia Martinez', 'David Chen', 'Chloe Kensington', 'Alexander Wright'];
    const selectedName = body.customerName || names[Math.floor(Math.random() * names.length)];

    const sampleProducts = [
      {
        id: `prod_${randomId}_1`,
        title: 'Merino Wool Structured Blazer',
        variantTitle: 'Midnight Navy / 40R',
        price: body.amount ? body.amount * 0.8 : 340.0,
        quantity: 1,
        imageUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400',
      },
      {
        id: `prod_${randomId}_2`,
        title: 'Handcrafted Vegetable-Tanned Cardholder',
        variantTitle: 'Saddle Tan',
        price: body.amount ? body.amount * 0.2 : 75.0,
        quantity: 1,
        imageUrl: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=400',
      },
    ];

    const totalPrice = sampleProducts.reduce((acc, item) => acc + item.price * item.quantity, 0);

    const syntheticCart: CartEvent = {
      id: `cart_sim_${Date.now()}_${randomId}`,
      cartToken: `tok_sim_${Date.now()}`,
      merchantId: merchant.id,
      customerName: selectedName,
      customerPhone: `+1415${Math.floor(1000000 + Math.random() * 9000000)}`,
      customerEmail: `${selectedName.toLowerCase().replace(' ', '.')}@example.com`,
      currency: 'USD',
      totalPrice,
      items: sampleProducts,
      status: 'ABANDONED',
      abandonmentType: type,
      recoveryStage: 'QUEUED',
      checkoutUrl: `${merchant.storeUrl}/checkouts/c/tok_sim_${Date.now()}/recover`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.upsertCartEvent(syntheticCart);

    // Schedule immediate recovery for simulation
    await globalRecoveryQueue.scheduleRecovery(syntheticCart.id, type, 0);

    return NextResponse.json({
      success: true,
      cart: syntheticCart,
      message: `Simulated cart abandonment [${type}] for ${selectedName} ingested into recovery loop.`,
    });
  } catch (err: unknown) {
    return internalErrorResponse('recovery/simulate', err, 'Failed to simulate cart abandonment');
  }
}
