/**
 * RecoverFlow AI — Razorpay Webhook Ingestion & Verification Endpoint.
 *
 * Security Invariants & Fail-Closed Behavior:
 * 1. Missing RAZORPAY_WEBHOOK_SECRET fails closed with HTTP 500. No fallback secrets exist.
 * 2. Constant-time HMAC-SHA256 signature verification over the raw body before JSON parsing.
 * 3. Allowlisted event types and strict Zod payload validation.
 * 4. Currency must be INR; amounts must be valid integer paise.
 * 5. Deduplication and idempotent replay acknowledgment.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyRazorpayWebhookSignature } from '@/lib/adapters/recoveryAdapter';
import { idempotencyStore } from '@/lib/server/idempotencyStore';

// ─── Supported Webhook Events & Schemas ───────────────────────────────

export const ALLOWED_WEBHOOK_EVENTS = [
  'payment_link.paid',
  'payment.captured',
  'payment_link.cancelled',
  'payment_link.expired',
  'payment.failed',
] as const;

const WebhookEntitySchema = z.object({
  id: z.string().min(1),
  amount: z.number().int().positive().max(100_000_000), // Max ₹10,00,000
  currency: z.literal('INR'),
  status: z.string(),
  amount_paid: z.number().int().nonnegative().optional(),
});

const WebhookPayloadSchema = z.object({
  entity: z.string(),
  account_id: z.string().optional(),
  event: z.enum(ALLOWED_WEBHOOK_EVENTS),
  contains: z.array(z.string()).optional(),
  payload: z.object({
    payment: z.object({ entity: WebhookEntitySchema }).optional(),
    payment_link: z.object({ entity: WebhookEntitySchema }).optional(),
  }),
  event_id: z.string().optional(),
  created_at: z.number().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // ── 1. Fail-Closed Secret Configuration Check ────────────────────
    if (!webhookSecret || webhookSecret.trim() === '') {
      return NextResponse.json(
        {
          error:
            'Server Configuration Error: RAZORPAY_WEBHOOK_SECRET is not configured. Webhook verification failed closed.',
        },
        { status: 500 },
      );
    }

    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature');

    // ── 2. Missing or Invalid Signature Check ────────────────────────
    if (!signature || signature.trim() === '') {
      return NextResponse.json(
        { error: 'Webhook verification failed: Missing X-Razorpay-Signature header.' },
        { status: 400 },
      );
    }

    const isValidSignature = verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret);
    if (!isValidSignature) {
      return NextResponse.json(
        { error: 'Webhook verification failed: Invalid X-Razorpay-Signature.' },
        { status: 400 },
      );
    }

    // ── 3. Parse and Validate JSON Structure ─────────────────────────
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: 'Webhook payload error: Invalid JSON.' },
        { status: 400 },
      );
    }

    const parseResult = WebhookPayloadSchema.safeParse(parsedJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Webhook payload validation failed: Unsupported event or schema mismatch.',
          details: parseResult.error.format(),
        },
        { status: 400 },
      );
    }

    const data = parseResult.data;
    const eventType = data.event;

    // Extract entity and unique event identifier
    const paymentEntity = data.payload.payment?.entity ?? data.payload.payment_link?.entity;
    if (!paymentEntity) {
      return NextResponse.json(
        { error: 'Webhook validation failed: Missing payment or payment_link entity.' },
        { status: 400 },
      );
    }

    const uniqueEventId = data.event_id ?? `${eventType}_${paymentEntity.id}`;

    // ── 4. Deduplication & Idempotency Check ─────────────────────────
    const isNewEvent = idempotencyStore.recordWebhookEvent(uniqueEventId);
    if (!isNewEvent) {
      return NextResponse.json({
        success: true,
        eventId: uniqueEventId,
        event: eventType,
        status: 'duplicate_acknowledged_idempotent',
        message: 'Event was already processed previously.',
      });
    }

    // ── 5. Settlement Amount Extraction ──────────────────────────────
    let recoveryObserved = false;
    let settledAmountPaise = 0;

    if (eventType === 'payment_link.paid') {
      recoveryObserved = true;
      settledAmountPaise = paymentEntity.amount_paid ?? paymentEntity.amount;
    } else if (eventType === 'payment.captured') {
      recoveryObserved = true;
      settledAmountPaise = paymentEntity.amount;
    }

    return NextResponse.json({
      success: true,
      eventId: uniqueEventId,
      event: eventType,
      recoveryObserved,
      settledAmountPaise,
      status: 'processed',
      timestamp: new Date().toISOString(),
      note: 'Prototype operates on in-memory audit trail; cross-request durable persistence requires database backend.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal webhook error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
