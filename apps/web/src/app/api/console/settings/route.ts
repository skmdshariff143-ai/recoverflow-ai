import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/server/database';
import { route, requireSession, ApiError } from '@/lib/server/access';
const schema = z.object({ guidelines: z.string().trim().min(10).max(2000), discountCeiling: z.number().min(0).max(50), formality: z.number().min(0).max(1), urgency: z.number().min(0).max(1) }).strict();
export const PATCH = route(async (request) => {
  const session = await requireSession(request, 'policy:modify');
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) throw new ApiError(400, 'Check the policy values. Guidelines need at least 10 characters and discounts must be between 0% and 50%.');
  const input = parsed.data;
  const merchant = await db.updateMerchantTone(session.activeMerchantId, { brandToneGuidelines: input.guidelines, discountCeilingPercentage: input.discountCeiling, brandVoiceCasualVsFormal: input.formality, brandVoiceUrgencyVsGentle: input.urgency });
  if (!merchant) throw new ApiError(404, 'Merchant not found.');
  return NextResponse.json({ success: true });
});
