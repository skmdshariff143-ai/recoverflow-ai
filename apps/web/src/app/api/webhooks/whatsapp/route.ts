import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { db, globalSuppressionService, getRuntimeMode, type Merchant } from '@recoverflow/core';
import { runConciergeAgent } from '@recoverflow/agents';
import { sendWhatsAppMessage } from '@recoverflow/jobs';
import { internalErrorResponse } from '@/lib/http';

// In-memory conversation history cache for context continuity (max 5 turns per cart)
const conversationHistoryCache = new Map<string, Array<{ role: 'user' | 'assistant'; content: string }>>();

/**
 * Validates Meta's SHA256 HMAC signature in `X-Hub-Signature-256`.
 */
export function verifyWhatsAppSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader || !appSecret) return false;
  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') return false;

  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody, 'utf8')
    .digest('hex');

  const expectedBuf = Buffer.from(expectedSignature, 'utf8');
  const providedBuf = Buffer.from(parts[1], 'utf8');

  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Meta WhatsApp Webhook Verification Handshake (GET).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

  // Fail closed: Webhook verification MUST fail if verify token is unconfigured
  if (!expectedToken) {
    console.error('[WhatsApp Webhook] WHATSAPP_VERIFY_TOKEN is unset. Failing closed.');
    return new Response('Forbidden: Webhook verify token unconfigured', { status: 403 });
  }

  if (mode === 'subscribe' && token === expectedToken) {
    return new Response(challenge || '', { status: 200 });
  }

  return new Response('Forbidden', { status: 403 });
}

/**
 * Meta WhatsApp v21.0 inbound messages and button clicks (POST).
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get('x-hub-signature-256');
    const appSecret = process.env.WHATSAPP_APP_SECRET;

    if (!appSecret) {
      console.error('[WhatsApp Webhook] WHATSAPP_APP_SECRET is unset. Failing closed.');
      return NextResponse.json(
        { error: 'Service Unavailable: WhatsApp webhook app secret unconfigured' },
        { status: 503 }
      );
    }

    // Verify signature
    const isAuthentic = verifyWhatsAppSignature(rawBody, signatureHeader, appSecret);
    const allowBypassForTesting = process.env.NODE_ENV !== 'production' && req.headers.get('x-test-bypass') === 'true';

    if (!isAuthentic && !allowBypassForTesting) {
      return NextResponse.json({ error: 'Invalid WhatsApp webhook signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const incomingMsg = change?.messages?.[0];

    if (!incomingMsg) {
      // Status update (delivered, read)
      return NextResponse.json({ status: 'ok' }, { status: 200 });
    }

    const phoneNumberId = change?.metadata?.phone_number_id;
    const displayPhoneNumber = change?.metadata?.display_phone_number;

    // Resolve merchant by matching WhatsApp phone number ID or support phone
    const merchants = await db.listMerchants();
    let merchant: Merchant | null = merchants.find(
      (m) =>
        (phoneNumberId && m.whatsappPhoneId === phoneNumberId) ||
        (displayPhoneNumber && m.supportPhone && m.supportPhone.includes(displayPhoneNumber))
    ) || null;

    const mode = getRuntimeMode();
    if (!merchant) {
      if (mode === 'DEMO' || mode === 'TEST') {
        merchant = await db.getMerchant('merchant_default_01');
      } else {
        console.warn('[WhatsApp Webhook] Unknown phone number in LIVE/SANDBOX mode; ignoring webhook without action');
        return NextResponse.json({ received: true, ignored: true }, { status: 200 });
      }
    }

    if (!merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    const senderPhone = `+${incomingMsg.from}`;
    let userText = '';

    // Handle Native WhatsApp Flow / Catalog Checkout Completion (Meta v21.0)
    const nfmReply = incomingMsg.interactive?.nfm_reply;
    if (incomingMsg.interactive?.type === 'nfm_reply' || nfmReply) {
      let flowData: Record<string, unknown> = {};
      try {
        flowData = nfmReply?.response_json ? JSON.parse(nfmReply.response_json) : {};
      } catch {
        flowData = {};
      }

      const allCarts = await db.listCartEvents(merchant.id);
      const cartToken = (flowData.cart_token || flowData.cartToken) as string | undefined;
      const targetCart = allCarts.find(
        (c) => (cartToken && c.cartToken === cartToken) ||
               (c.customerPhone && (c.customerPhone === senderPhone || c.customerPhone.endsWith(incomingMsg.from.slice(-10))))
      );

      if (targetCart) {
        await db.updateCartStatus(targetCart.id, 'RECOVERED', 'RECOVERED');
        const confirmationText = `Order Confirmed! Your payment for ${targetCart.items.length} item(s) (${targetCart.currency} ${targetCart.totalPrice.toFixed(2)}) has been processed successfully via WhatsApp Native Checkout. We are preparing your shipment!`;

        await sendWhatsAppMessage({
          to: senderPhone,
          bodyText: confirmationText,
          token: merchant.whatsappToken,
          phoneNumberId: merchant.whatsappPhoneId,
        });

        await db.logMessage({
          id: `msg_flow_done_${Date.now()}`,
          cartEventId: targetCart.id,
          merchantId: merchant.id,
          channel: 'WHATSAPP',
          direction: 'OUTBOUND',
          content: confirmationText,
          deliveryStatus: 'DELIVERED',
          createdAt: new Date(),
        });

        return NextResponse.json({
          status: 'flow_checkout_completed',
          cartId: targetCart.id,
          recovered: true,
        });
      }
    }

    // Extract text from text message or interactive button reply
    if (incomingMsg.text?.body) {
      userText = incomingMsg.text.body.trim();
    } else if (incomingMsg.interactive?.button_reply) {
      const buttonId = incomingMsg.interactive.button_reply.id;
      userText = incomingMsg.interactive.button_reply.title || buttonId;
    } else if (incomingMsg.interactive?.list_reply) {
      userText = incomingMsg.interactive.list_reply.title || incomingMsg.interactive.list_reply.id;
    } else {
      return NextResponse.json({ status: 'unsupported_message_type' }, { status: 200 });
    }

    // CHECK OPT-OUT TRIGGERS (STOP, UNSUBSCRIBE, CANCEL, btn_opt_out)
    const upperText = userText.toUpperCase();
    const isOptOut = upperText === 'STOP' || 
                     upperText === 'UNSUBSCRIBE' || 
                     upperText === 'CANCEL' || 
                     upperText === 'QUIT' || 
                     incomingMsg.interactive?.button_reply?.id === 'btn_opt_out';

    if (isOptOut) {
      // Add immediately to suppression list
      await globalSuppressionService.suppress(merchant.id, senderPhone, 'PHONE', 'USER_UNSUBSCRIBE');

      // Compliance acknowledgment message
      const optOutReply = "You have been successfully unsubscribed from automated recovery notices. Reply START anytime to re-subscribe.";
      await sendWhatsAppMessage({
        to: senderPhone,
        bodyText: optOutReply,
        token: merchant.whatsappToken,
        phoneNumberId: merchant.whatsappPhoneId,
      });

      await db.logMessage({
        id: `msg_optout_${Date.now()}`,
        merchantId: merchant.id,
        channel: 'WHATSAPP',
        direction: 'OUTBOUND',
        content: optOutReply,
        deliveryStatus: 'DELIVERED',
        createdAt: new Date(),
      });

      return NextResponse.json({ status: 'opted_out', phone: senderPhone });
    }

    // Find active cart for customer
    const allCarts = await db.listCartEvents(merchant.id);
    const customerCart = allCarts.find(
      (c) => c.customerPhone && (c.customerPhone === senderPhone || c.customerPhone.endsWith(incomingMsg.from.slice(-10)))
    );

    if (!customerCart) {
      await sendWhatsAppMessage({
        to: senderPhone,
        bodyText: `Thank you for contacting ${merchant.storeName}! An associate will be with you shortly.`,
        token: merchant.whatsappToken,
        phoneNumberId: merchant.whatsappPhoneId,
      });
      return NextResponse.json({ status: 'no_active_cart' }, { status: 200 });
    }

    // Check if Human Admin has taken over this chat
    const isTakenOver = db.isAdminTakenOver(customerCart.id);

    // Update conversation history (maintain last 5 turns)
    const history = conversationHistoryCache.get(customerCart.id) || [];
    history.push({ role: 'user', content: userText });
    if (history.length > 5) history.shift();
    conversationHistoryCache.set(customerCart.id, history);

    // Log inbound user message
    await db.logMessage({
      id: `msg_in_${Date.now()}`,
      cartEventId: customerCart.id,
      merchantId: merchant.id,
      channel: 'WHATSAPP',
      direction: 'INBOUND',
      content: userText,
      deliveryStatus: 'READ',
      createdAt: new Date(),
    });

    if (isTakenOver) {
      // Admin takeover active: do NOT trigger AI auto-response
      console.log(`[Takeover Active] AI reply suppressed for cart ${customerCart.id}`);
      return NextResponse.json({ status: 'takeover_active_ai_suppressed' }, { status: 200 });
    }

    // Run Concierge AI Agent with 5-turn history
    const conciergeResponse = await runConciergeAgent({
      incomingMessage: userText,
      cart: customerCart,
      merchant,
      conversationHistory: history,
    });

    history.push({ role: 'assistant', content: conciergeResponse.reply });
    if (history.length > 5) history.shift();
    conversationHistoryCache.set(customerCart.id, history);

    // Update cart stage
    await db.updateCartStatus(
      customerCart.id,
      customerCart.status,
      'CONCIERGE_ACTIVE',
      conciergeResponse.discountOffered || customerCart.suggestedDiscountCode
    );

    // If escalated to admin, engage takeover lock for 60 minutes
    if (conciergeResponse.escalateToAdmin) {
      db.setAdminTakeover(customerCart.id, 3600000); // 60 mins
      await sendWhatsAppMessage({
        to: senderPhone,
        bodyText: conciergeResponse.reply,
        token: merchant.whatsappToken,
        phoneNumberId: merchant.whatsappPhoneId,
      });
    } else {
      await sendWhatsAppMessage({
        to: senderPhone,
        bodyText: conciergeResponse.reply,
        ctaUrl: customerCart.checkoutUrl,
        discountCode: conciergeResponse.discountOffered || customerCart.suggestedDiscountCode,
        token: merchant.whatsappToken,
        phoneNumberId: merchant.whatsappPhoneId,
      });
    }

    // Log outbound message
    await db.logMessage({
      id: `msg_out_${Date.now()}`,
      cartEventId: customerCart.id,
      merchantId: merchant.id,
      channel: 'WHATSAPP',
      direction: 'OUTBOUND',
      content: conciergeResponse.reply,
      deliveryStatus: 'DELIVERED',
      createdAt: new Date(),
    });

    return NextResponse.json({
      status: 'success',
      reply: conciergeResponse.reply,
      escalated: conciergeResponse.escalateToAdmin,
      discountOffered: conciergeResponse.discountOffered,
    });
  } catch (err: unknown) {
    return internalErrorResponse('webhooks/whatsapp', err, 'Internal error processing WhatsApp webhook');
  }
}
