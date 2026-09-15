import { NextRequest, NextResponse } from 'next/server';
import { runRecoveryAgent } from '@recoverflow/agents';
import { db, type AbandonmentType } from '@recoverflow/core';
import { buildResponsiveCartEmailHtml } from '@recoverflow/jobs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const merchant = await db.getMerchant('merchant_default_01');

    const brandVoiceCasualVsFormal = body.brandVoiceCasualVsFormal ?? 0.5;
    const brandVoiceUrgencyVsGentle = body.brandVoiceUrgencyVsGentle ?? 0.5;
    const discountCeilingPercentage = body.discountCeilingPercentage ?? 15.0;
    const guidelines = body.brandToneGuidelines || merchant?.brandToneGuidelines || 'Polite, clear, and reassuring.';
    const dropOffReason: AbandonmentType = body.dropOffReason || 'CHECKOUT_STEP';

    const sampleItems = [
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
      checkoutUrl,
      discountCode: recoveryOutput.suggestedDiscountCode,
      messageBody: recoveryOutput.messageBody,
    });

    return NextResponse.json({
      success: true,
      recoveryOutput,
      emailHtmlPreview,
    });
  } catch (err: unknown) {
    console.error('Tone preview error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Tone preview failed' },
      { status: 500 }
    );
  }
}
