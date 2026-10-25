import { NextRequest, NextResponse } from 'next/server';
import { db, globalSuppressionService } from '@recoverflow/core';
import { authorizeRequest } from '@/lib/routeAuth';
import { internalErrorResponse } from '@/lib/http';
import { toPublicMerchant } from '@/lib/publicMerchant';
import { z } from 'zod';

const UpdateMerchantToneSchema = z.object({
  brandVoiceCasualVsFormal: z.number().min(0).max(1).optional(),
  brandVoiceUrgencyVsGentle: z.number().min(0).max(1).optional(),
  discountCeilingPercentage: z.number().min(0).max(100).optional(),
  brandToneGuidelines: z.string().trim().max(1000).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const authRes = await authorizeRequest(req, 'policy:view', { allowAnonymousDemo: true });
    if (!authRes.authorized) return authRes.response;
    const { session } = authRes;

    let merchant = await db.getMerchant(session.activeMerchantId);

    if (!merchant) {
      merchant = {
        id: session.activeMerchantId,
        storeUrl: 'https://aurora-apparel.myshopify.com',
        storeName: 'Aurora Luxury Apparel',
        webhookSecret: 'shpss_test_secret_key_99182',
        brandToneGuidelines: 'Helpful, conversational, and direct. Focus on product value.',
        brandVoiceCasualVsFormal: 0.7,
        brandVoiceUrgencyVsGentle: 0.35,
        discountCeilingPercentage: 15.0,
        minMarginPercentage: 20.0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    const carts = await db.listCartEvents(session.activeMerchantId);
    const messages = await db.listMessageLogs(session.activeMerchantId);
    const suppressions = await globalSuppressionService.listSuppressions(session.activeMerchantId);

    // Compute live metrics from real records
    let recoveredGmv = 0;
    let abandonedGmv = 0;
    let recoveredCount = 0;
    const resolutionTimesMs: number[] = [];
    const recoveredCartIds = new Set<string>();

    for (const c of carts) {
      if (c.status === 'RECOVERED') {
        recoveredGmv += c.totalPrice;
        recoveredCount++;
        recoveredCartIds.add(c.id);

        const createdMs = c.createdAt ? new Date(c.createdAt).getTime() : 0;
        const resolvedMs = c.recoveredAt
          ? new Date(c.recoveredAt).getTime()
          : c.updatedAt
          ? new Date(c.updatedAt).getTime()
          : 0;
        if (createdMs > 0 && resolvedMs > createdMs) {
          resolutionTimesMs.push(resolvedMs - createdMs);
        }
      } else {
        abandonedGmv += c.totalPrice;
      }
    }

    const totalCarts = carts.length;
    const recoveryRatePercent = totalCarts > 0 ? parseFloat(((recoveredCount / totalCarts) * 100).toFixed(1)) : 0;

    const avgResolutionMinutes = resolutionTimesMs.length > 0
      ? Math.round(resolutionTimesMs.reduce((sum, v) => sum + v, 0) / (resolutionTimesMs.length * 60000))
      : null;

    // Real Channel Attribution from message logs
    const outboundMessages = messages.filter((m) => m.direction === 'OUTBOUND');
    const whatsappMessages = outboundMessages.filter((m) => m.channel === 'WHATSAPP');
    const emailMessages = outboundMessages.filter((m) => m.channel === 'EMAIL');

    const whatsappSent = whatsappMessages.length;
    const emailSent = emailMessages.length;

    const whatsappRecoveredCarts = new Set<string>();
    for (const m of whatsappMessages) {
      const cid = m.cartEventId || m.cartId;
      if (cid && recoveredCartIds.has(cid)) {
        whatsappRecoveredCarts.add(cid);
      }
    }

    const emailRecoveredCarts = new Set<string>();
    for (const m of emailMessages) {
      const cid = m.cartEventId || m.cartId;
      if (cid && recoveredCartIds.has(cid)) {
        emailRecoveredCarts.add(cid);
      }
    }

    const whatsappRecovered = whatsappRecoveredCarts.size;
    const emailRecovered = emailRecoveredCarts.size;

    const whatsappGmv = carts.filter((c) => whatsappRecoveredCarts.has(c.id)).reduce((s, c) => s + c.totalPrice, 0);
    const emailGmv = carts.filter((c) => emailRecoveredCarts.has(c.id)).reduce((s, c) => s + c.totalPrice, 0);

    const whatsappCost = whatsappSent * 0.05;
    const emailCost = emailSent * 0.001;

    const whatsappRoiMultiplier = whatsappCost > 0 && whatsappGmv > 0
      ? parseFloat((whatsappGmv / whatsappCost).toFixed(1))
      : null;
    const emailRoiMultiplier = emailCost > 0 && emailGmv > 0
      ? parseFloat((emailGmv / emailCost).toFixed(1))
      : null;

    const channelRoi = {
      whatsapp: whatsappSent > 0
        ? {
            sent: whatsappSent,
            recovered: whatsappRecovered,
            conversionRate: parseFloat(((whatsappRecovered / whatsappSent) * 100).toFixed(1)),
            roiMultiplier: whatsappRoiMultiplier,
          }
        : null,
      email: emailSent > 0
        ? {
            sent: emailSent,
            recovered: emailRecovered,
            conversionRate: parseFloat(((emailRecovered / emailSent) * 100).toFixed(1)),
            roiMultiplier: emailRoiMultiplier,
          }
        : null,
    };

    return NextResponse.json({
      source: 'DEMO',
      merchant: toPublicMerchant(merchant),
      carts,
      messages,
      suppressions,
      stats: {
        totalCarts,
        recoveredCount,
        recoveredGmv,
        abandonedGmv: abandonedGmv + recoveredGmv,
        recoveryRatePercent,
        channelRoi,
        avgResolutionMinutes,
      },
    });
  } catch (err: unknown) {
    return internalErrorResponse('recovery/events:GET', err, 'Failed to fetch events');
  }
}

export async function POST(req: NextRequest) {
  try {
    const authRes = await authorizeRequest(req, 'policy:modify', { allowAnonymousDemo: true });
    if (!authRes.authorized) return authRes.response;
    const { session } = authRes;

    const rawBody = await req.json().catch(() => ({}));
    const validated = UpdateMerchantToneSchema.safeParse(rawBody);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid merchant tone payload', issues: validated.error.issues },
        { status: 400 }
      );
    }

    const body = validated.data;
    const updated = await db.updateMerchantTone(session.activeMerchantId, {
      brandVoiceCasualVsFormal: body.brandVoiceCasualVsFormal,
      brandVoiceUrgencyVsGentle: body.brandVoiceUrgencyVsGentle,
      discountCeilingPercentage: body.discountCeilingPercentage,
      brandToneGuidelines: body.brandToneGuidelines,
    });

    return NextResponse.json({
      success: Boolean(updated),
      source: 'DEMO',
      merchant: toPublicMerchant(updated),
    });
  } catch (err: unknown) {
    return internalErrorResponse('recovery/events:POST', err, 'Failed to update merchant settings');
  }
}
