import { NextRequest, NextResponse } from 'next/server';

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

// In-memory pre-abandonment session intent store (cartToken -> intent snapshots)
const intentSessions = new Map<string, IntentSession>();

export async function POST(req: NextRequest) {
  try {
    const snapshot = await req.json();
    const { cartToken, shopDomain, eventType, customerEmail, customerPhone, velocityVector } = snapshot;

    if (!cartToken) {
      return NextResponse.json({ error: 'cartToken is required' }, { status: 400 });
    }

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
      eventType,
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
    console.error('Intent telemetry error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Telemetry ingestion error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cartToken = searchParams.get('cartToken');

  if (cartToken) {
    const session = intentSessions.get(cartToken);
    return NextResponse.json({ session: redactTelemetrySession(session || null) });
  }

  return NextResponse.json({
    activeSessionsCount: intentSessions.size,
    recentSessions: Array.from(intentSessions.values()).slice(-10).map(redactTelemetrySession),
  });
}
