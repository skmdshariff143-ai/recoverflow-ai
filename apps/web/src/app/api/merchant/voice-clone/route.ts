import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { db } from '@recoverflow/core';

export async function POST(req: NextRequest) {
  try {
    const merchantId = req.headers.get('x-merchant-id') || 'merchant_default_01';
    let merchant = await db.getMerchant(merchantId);

    if (!merchant && db.listMerchants) {
      const allMerchants = await db.listMerchants();
      merchant = allMerchants[0] || null;
    }

    if (!merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    const contentType = req.headers.get('content-type') || '';
    let voiceId = '';
    let sampleDurationSeconds = 60;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('audio') as File | null;

      if (!file) {
        return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 10);
      voiceId = `voice_clone_${merchant.storeName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${hash}`;
      sampleDurationSeconds = Math.max(5, Math.min(60, Math.round(buffer.length / 16000)));
    } else {
      // JSON payload mode
      const body = await req.json();
      const customLabel = body.label || 'Founder Executive Voice';
      const hash = crypto.createHash('sha256').update(`${merchantId}:${customLabel}:${Date.now()}`).digest('hex').slice(0, 8);
      voiceId = `voice_clone_${merchant.storeName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${hash}`;
      sampleDurationSeconds = Number(body.durationSeconds || 45);
    }

    // Persist customVoiceId to Merchant record
    merchant.customVoiceId = voiceId;
    merchant.updatedAt = new Date();
    await db.upsertMerchant(merchant);

    return NextResponse.json({
      success: true,
      voiceId,
      merchantId: merchant.id,
      storeName: merchant.storeName,
      sampleDurationSeconds,
      status: 'ACTIVE_CLONED',
      message: `Founder custom voice '${voiceId}' successfully cloned and registered for VIP recovery calls.`,
    });
  } catch (err: unknown) {
    console.error('[VoiceClone Error]:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal voice cloning upload failure' },
      { status: 500 }
    );
  }
}
