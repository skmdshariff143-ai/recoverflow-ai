import { NextRequest, NextResponse } from 'next/server';
import { runRecoveryAgent } from '@recoverflow/agents';
import { db, type AbandonmentType, type CartItem } from '@recoverflow/core';
import { buildResponsiveCartEmailHtml } from '@recoverflow/jobs';
import { z } from 'zod';

const TonePreviewSchema = z.object({
  brandVoiceCasualVsFormal: z.number().min(0).max(1).optional(),
  brandVoiceUrgencyVsGentle: z.number().min(0).max(1).optional(),
  discountCeilingPercentage: z.number().min(0).max(100).optional(),
  brandToneGuidelines: z.string().trim().max(1000).optional(),
  dropOffReason: z.string().trim().max(100).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => ({}));
    const validated = TonePreviewSchema.safeParse(rawBody);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid tone preview parameters', issues: validated.error.issues },
        { status: 400 }
      );
    }

    const body = validated.data;
    const merchant = await db.getMerchant('merchant_default_01');

    const brandVoiceCasualVsFormal = body.brandVoiceCasualVsFormal ?? 0.5;
    const brandVoiceUrgencyVsGentle = body.brandVoiceUrgencyVsGentle ?? 0.5;
    const discountCeilingPercentage = body.discountCeilingPercentage ?? 15.0;
    const guidelines = body.brandToneGuidelines || merchant?.brandToneGuidelines || 'Polite, clear, and reassuring.';
    const dropOffReason: AbandonmentType = (body.dropOffReason as AbandonmentType) || 'CHECKOUT_STEP';

    const sampleItems: CartItem[] = [
      {
        id: 'sample_preview_01',
        title: 'Minimalist Italian Leather Tote',
        variantTitle: 'Caramel Brown / Large',
        price: 260.0,
        quantity: 1,
        imageUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400',
      },
    ];

    const storeName = merchant?.storeName || 'Aurora Atelier';
    const checkoutUrl = `${merchant?.storeUrl || 'https://aurora-apparel.myshopify.com'}/checkouts/preview`;

    const recoveryOutput = await runRecoveryAgent({
      customerName: 'Alex Morgan',
      items: sampleItems,
      totalValue: 260.0,
      currency: 'USD',
      dropOffReason,
      checkoutUrl,
      merchantTone: {
        brandName: storeName,
        guidelines,
        casualVsFormal: brandVoiceCasualVsFormal,
        urgencyVsGentle: brandVoiceUrgencyVsGentle,
        discountCeilingPercentage,
      },
    });

    const emailHtmlPreview = buildResponsiveCartEmailHtml({
      to: 'alex.morgan@example.com',
      customerName: 'Alex Morgan',
      storeName,
      items: sampleItems,
      totalPrice: 260.0,
      currency: 'USD',
      discountCode: recoveryOutput.suggestedDiscountCode,
      checkoutUrl,
      messageBody: recoveryOutput.messageBody,
    });

    return NextResponse.json({
      success: true,
      recoveryOutput,
      emailHtmlPreview,
      guidelinesUsed: guidelines,
      discountOffered: recoveryOutput.suggestedDiscountCode ? discountCeilingPercentage : 0,
      offerCode: recoveryOutput.suggestedDiscountCode,
    });
  } catch (err: unknown) {
    console.error('Tone preview error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Tone preview failed' },
      { status: 500 }
    );
  }
}
