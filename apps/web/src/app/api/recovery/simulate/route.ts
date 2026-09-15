import { NextRequest, NextResponse } from 'next/server';
import { db, type CartEvent, type AbandonmentType } from '@recoverflow/core';
import { globalRecoveryQueue } from '@recoverflow/jobs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const type: AbandonmentType = body.type || 'PAYMENT_FAILED';
    const merchant = await db.getMerchant('merchant_default_01');

    if (!merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    const randomId = Math.random().toString(36).slice(2, 7);
    const names = ['Liam Gallagher', 'Sophia Martinez', 'David Chen', 'Chloe Kensington', 'Alexander Wright'];
    const selectedName = names[Math.floor(Math.random() * names.length)];

    const sampleProducts = [
      {
        id: `prod_${randomId}_1`,
        title: 'Merino Wool Structured Blazer',
        variantTitle: 'Midnight Navy / 40R',
        price: 340.0,
        quantity: 1,
        imageUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400',
      },
      {
        id: `prod_${randomId}_2`,
        title: 'Handcrafted Vegetable-Tanned Cardholder',
        variantTitle: 'Saddle Tan',
        price: 75.0,
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

    // Trigger immediate recovery for simulation
    const result = await globalRecoveryQueue.executePrimaryRecovery(syntheticCart.id);

    return NextResponse.json({
      success: true,
      cartEvent: syntheticCart,
      recoveryResult: result,
    });
  } catch (err: unknown) {
    console.error('Simulation error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Simulation failed' },
      { status: 500 }
    );
  }
}
