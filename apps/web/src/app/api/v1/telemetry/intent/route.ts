import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/apiGuards';
import { internalErrorResponse } from '@/lib/http';
import { z } from 'zod';

export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***';
  const [user, domain] = email.split('@');
  if (user.length <= 2) return `${user[0]}***@${domain}`;
  return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

export function maskPhone(phone: string): string {
  if (!phone) return '***';
  const clean = phone.trim();
  if (clean.length <= 4) return '****';
  return `${clean.slice(0, 3)}****${clean.slice(-2)}`;
}

export interface IntentSession {
  cartToken: string;
  shopDomain: string;
  events: Array<{ eventType: string; velocityVector?: unknown; timestamp: number }>;
  linkedIdentity: { email?: string; phone?: string };
  preDropRisk: 'HIGH' | 'MED' | 'LOW';
  lastSeenAt: number;
}

export function redactTelemetrySession(session: IntentSession | null | undefined) {
  if (!session) return null;
  return {
    ...session,
    linkedIdentity: {
      email: session.linkedIdentity?.email ? maskEmail(session.linkedIdentity.email) : undefined,
      phone: session.linkedIdentity?.phone ? maskPhone(session.linkedIdentity.phone) : undefined,
    },
  };
}

const IntentPayloadSchema = z.object({
  cartToken: z.string().trim().min(1).max(128),
  shopDomain: z.string().trim().max(100).optional(),
  eventType: z.string().trim().max(50).optional(),
  customerEmail: z.string().trim().max(254).optional(),
  customerPhone: z.string().trim().max(50).optional(),
  velocityVector: z.unknown().optional(),
});

// In-memory pre-abandonment session intent store (cartToken -> intent snapshots)
const intentSessions = new Map<string, IntentSession>();

export async function POST(req: NextRequest) {
  try {
    const rateLimitRes = await enforceRateLimit(req, 60, 60000);
    if (rateLimitRes) return rateLimitRes;

    const rawText = await req.text();
    if (rawText.length > 16384) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    const validated = IntentPayloadSchema.safeParse(parsedJson);
    if (!validated.success) {
      return NextResponse.json({ error: 'Invalid telemetry payload', issues: validated.error.issues }, { status: 400 });
    }

    const { cartToken, shopDomain, eventType, customerEmail, customerPhone, velocityVector } = validated.data;

    let session = intentSessions.get(cartToken);
    if (!session) {
      session = {
        cartToken,
        shopDomain: shopDomain || 'unknown',
        events: [],
        linkedIdentity: {},
        preDropRisk: 'LOW',
        lastSeenAt: Date.now(),
      };
      intentSessions.set(cartToken, session);
    }

    session.lastSeenAt = Date.now();
    session.events.push({
      eventType: eventType || 'GENERIC_PULSE',
      velocityVector,
      timestamp: Date.now(),
    });

    // Identity Graph Linking: bind early captured email/phone to cart session with redacted logs
    if (customerEmail && !session.linkedIdentity.email) {
      session.linkedIdentity.email = customerEmail;
      console.log(`[Identity Graph] Linked email ${maskEmail(customerEmail)} to anonymous cart ${cartToken}`);
    }
    if (customerPhone && !session.linkedIdentity.phone) {
      session.linkedIdentity.phone = customerPhone;
      console.log(`[Identity Graph] Linked phone ${maskPhone(customerPhone)} to anonymous cart ${cartToken}`);
    }

    // Risk Assessment
    if (eventType === 'EXIT_VELOCITY_TRIGGER' || eventType === 'TAB_BLUR_TRIGGER') {
      session.preDropRisk = 'HIGH';
    } else if (eventType === 'DISCOUNT_FAILURE_TRIGGER') {
      session.preDropRisk = 'MED';
    }

    // Lazily clean up entries older than 2 hours (7200s)
    if (intentSessions.size > 1000) {
      const cutoff = Date.now() - 7200000;
      for (const [k, v] of intentSessions.entries()) {
        if (v.lastSeenAt < cutoff) intentSessions.delete(k);
      }
    }

    return NextResponse.json({
      status: 'ingested',
      sessionLinked: Boolean(session.linkedIdentity.email || session.linkedIdentity.phone),
      preDropRisk: session.preDropRisk,
      eventsCount: session.events.length,
    }, { status: 200 });
  } catch (err: unknown) {
    return internalErrorResponse('telemetry/intent', err, 'Telemetry ingestion error');
  }
}

export async function GET(req: NextRequest) {
  const rateLimitRes = await enforceRateLimit(req, 60, 60000);
  if (rateLimitRes) return rateLimitRes;

  const { searchParams } = new URL(req.url);
  const cartToken = (searchParams.get('cartToken') || '').slice(0, 128);

  if (cartToken) {
    const session = intentSessions.get(cartToken);
    return NextResponse.json({ session: redactTelemetrySession(session || null) });
  }

  return NextResponse.json({
    activeSessionsCount: intentSessions.size,
    recentSessions: Array.from(intentSessions.values()).slice(-10).map(redactTelemetrySession),
  });
}
