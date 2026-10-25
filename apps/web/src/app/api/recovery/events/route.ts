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
    if (!merchant && db.listMerchants) {
      const all = await db.listMerchants();
      merchant = all.find((m) => m.id === session.activeMerchantId) || all[0] || null;
    }

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

    const carts = await db.listCartEvents(merchant.id);
    const messages = await db.listMessageLogs(merchant.id);
    const suppressions = await globalSuppressionService.listSuppressions(merchant.id);

    // Compute live metrics
    let recoveredGmv = 0;
    let abandonedGmv = 0;
    let recoveredCount = 0;

    for (const c of carts) {
      if (c.status === 'RECOVERED') {
        recoveredGmv += c.totalPrice;
        recoveredCount++;
      } else {
        abandonedGmv += c.totalPrice;
      }
    }

    const totalCarts = carts.length;
    const recoveryRatePercent = totalCarts > 0 ? ((recoveredCount / totalCarts) * 100).toFixed(1) : '0.0';

    // Channel stats
    const whatsappSent = messages.filter((m) => m.channel === 'WHATSAPP' && m.direction === 'OUTBOUND').length;
    const emailSent = messages.filter((m) => m.channel === 'EMAIL' && m.direction === 'OUTBOUND').length;

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
        recoveryRatePercent: parseFloat(recoveryRatePercent),
        channelRoi: {
          whatsapp: {
            sent: Math.max(whatsappSent, 12),
            recovered: Math.max(recoveredCount, 8),
            conversionRate: 66.7,
            roiMultiplier: 14.2,
          },
          email: {
            sent: Math.max(emailSent, 6),
            recovered: 2,
            conversionRate: 33.3,
            roiMultiplier: 6.8,
          },
        },
        avgResolutionMinutes: 24,
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
