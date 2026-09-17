import { NextRequest, NextResponse } from 'next/server';
import { db } from '@recoverflow/core';
import { sendWhatsAppMessage } from '@recoverflow/jobs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cartId = searchParams.get('cartId');

  if (!cartId) {
    return NextResponse.json({ error: 'cartId is required' }, { status: 400 });
  }

  const isTakenOver = db.isAdminTakenOver(cartId);
  return NextResponse.json({
    cartId,
    isTakenOver,
    remainingMs: isTakenOver ? (db.getAdminTakeoverRemainingMs ? db.getAdminTakeoverRemainingMs(cartId) : 0) : 0,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { cartId, isTakenOver, manualMessage } = body;

    if (!cartId) {
      return NextResponse.json({ error: 'cartId is required' }, { status: 400 });
    }

    if (isTakenOver) {
      // Engage 60-minute lock (3,600,000 ms)
      db.setAdminTakeover(cartId, 3600000);
    } else {
      db.removeAdminTakeover(cartId);
    }

    const cart = await db.getCartById(cartId);
    const merchant = await db.getMerchant('merchant_default_01');

    // If manual message is provided by the admin, dispatch it
    if (manualMessage && cart?.customerPhone && merchant) {
      await sendWhatsAppMessage({
        to: cart.customerPhone,
        bodyText: manualMessage,
        token: merchant.whatsappToken,
        phoneNumberId: merchant.whatsappPhoneId,
      });

      await db.logMessage({
        id: `msg_admin_${Date.now()}`,
        cartEventId: cart.id,
        merchantId: merchant.id,
        channel: 'WHATSAPP',
        direction: 'OUTBOUND',
        content: `[Human Agent] ${manualMessage}`,
        deliveryStatus: 'DELIVERED',
        createdAt: new Date(),
      });
    }

    return NextResponse.json({
      success: true,
      cartId,
      isTakenOver: db.isAdminTakenOver(cartId),
      messageSent: Boolean(manualMessage),
    });
  } catch (err: unknown) {
    console.error('Takeover route error:', err);
    return NextResponse.json({ error: 'Failed to update takeover state' }, { status: 500 });
  }
}
