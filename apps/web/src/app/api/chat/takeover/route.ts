import { NextRequest, NextResponse } from 'next/server';
import { db } from '@recoverflow/core';
import { sendWhatsAppMessage } from '@recoverflow/jobs';
import { authorizeRequest } from '@/lib/routeAuth';
import { enforceRateLimit, requireServiceToken } from '@/lib/apiGuards';
import { internalErrorResponse } from '@/lib/http';
import { z } from 'zod';

const TakeoverBodySchema = z.object({
  cartId: z.string().trim().min(1).max(100),
  isTakenOver: z.boolean().optional(),
  manualMessage: z.string().trim().max(1000).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const rateLimitRes = await enforceRateLimit(req, 30, 60000);
    if (rateLimitRes) return rateLimitRes;

    const authRes = await authorizeRequest(req, 'support:intervene', { allowAnonymousDemo: true });
    if (!authRes.authorized) return authRes.response;
    const { session } = authRes;

    const { searchParams } = new URL(req.url);
    const cartId = (searchParams.get('cartId') || '').trim();

    if (!cartId || cartId.length > 100) {
      return NextResponse.json({ error: 'cartId is required' }, { status: 400 });
    }

    const cart = await db.getCartById(cartId);
    if (!cart || cart.merchantId !== session.activeMerchantId) {
      return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
    }

    const isTakenOver = db.isAdminTakenOver(cartId);
    return NextResponse.json({
      cartId,
      isTakenOver,
      remainingMs: isTakenOver ? (db.getAdminTakeoverRemainingMs ? db.getAdminTakeoverRemainingMs(cartId) : 0) : 0,
    });
  } catch (err: unknown) {
    return internalErrorResponse('chat/takeover', err, 'Failed to retrieve takeover state');
  }
}

export async function POST(req: NextRequest) {
  try {
    const rateLimitRes = await enforceRateLimit(req, 20, 60000);
    if (rateLimitRes) return rateLimitRes;

    const hasServiceTokenHeader = Boolean(req.headers.get('x-admin-token'));
    let activeMerchantId: string | null = null;
    let isServiceAuthorized = false;

    if (hasServiceTokenHeader) {
      const serviceTokenErr = requireServiceToken(req);
      if (serviceTokenErr) return serviceTokenErr;
      isServiceAuthorized = true;
    } else {
      const authRes = await authorizeRequest(req, 'support:intervene', {
        allowAnonymousDemo: true,
      });
      if (!authRes.authorized) return authRes.response;
      activeMerchantId = authRes.session.activeMerchantId;
    }

    let bodyRaw: unknown = {};
    try {
      bodyRaw = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validated = TakeoverBodySchema.safeParse(bodyRaw);
    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid takeover request payload', issues: validated.error.issues },
        { status: 400 }
      );
    }

    const { cartId, isTakenOver, manualMessage } = validated.data;

    // Manual message dispatch requires either:
    // 1. A real authenticated operator session (never demo fallback), OR
    // 2. An authorized service token (via requireServiceToken).
    if (manualMessage) {
      if (isServiceAuthorized) {
        // Service token caller authorized
      } else {
        const realAuthRes = await authorizeRequest(req, 'support:intervene', {
          allowAnonymousDemo: false,
        });
        if (!realAuthRes.authorized) return realAuthRes.response;
        if (realAuthRes.session) {
          activeMerchantId = realAuthRes.session.activeMerchantId;
        }
      }
    }

    const cart = await db.getCartById(cartId);
    if (!cart) {
      return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
    }

    if (activeMerchantId && cart.merchantId !== activeMerchantId) {
      return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
    }

    if (isTakenOver) {
      // Engage 60-minute lock (3,600,000 ms)
      db.setAdminTakeover(cartId, 3600000);
    } else if (isTakenOver === false) {
      db.removeAdminTakeover(cartId);
    }

    const targetMerchantId = activeMerchantId || cart.merchantId;
    const merchant = await db.getMerchant(targetMerchantId);

    // If manual message is provided by the admin, dispatch it
    if (manualMessage && cart.customerPhone && merchant) {
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
    return internalErrorResponse('chat/takeover', err, 'Failed to update takeover state');
  }
}
