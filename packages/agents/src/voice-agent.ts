
export interface VIPVoiceContext {
  cartId: string;
  cartToken: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  totalPrice: number;
  currency: string;
  items: Array<{ title: string; price: number; quantity: number }>;
  storeName: string;
  checkoutUrl: string;
  discountCeilingPercentage?: number;
  streamUrl?: string;
}

export interface TwilioVoiceCallResult {
  success: boolean;
  callSid?: string;
  twiml: string;
  smsRescueDispatched?: boolean;
  smsMessageId?: string;
  simulated: boolean;
  error?: string;
}

/**
 * Evaluates whether a cart qualifies for VIP white-glove voice outreach.
 * Threshold: total value >= $1,000 and dropped due to payment failure or explicit high-value intent.
 */
export function isVipVoiceEligible(totalPrice: number, abandonmentType?: string, threshold: number = 1000): boolean {
  if (totalPrice < threshold) return false;
  if (abandonmentType && abandonmentType !== 'PAYMENT_FAILED' && abandonmentType !== 'CHECKOUT_ABANDONED') {
    return false;
  }
  return true;
}

/**
 * Generates the Gemini Live system instructions for the luxury white-glove AI concierge.
 */
export function buildGeminiLiveVIPSystemPrompt(context: VIPVoiceContext): string {
  const name = context.customerName ? context.customerName.split(' ')[0] : 'there';
  const itemList = context.items.map((i) => `${i.quantity}x ${i.title} (${context.currency} ${i.price})`).join(', ');

  return `You are an elite, white-glove customer concierge calling from ${context.storeName}.
You are speaking directly with ${name}.

CONTEXT:
- Customer was attempting to purchase: ${itemList}
- Total Order Value: ${context.currency} ${context.totalPrice.toFixed(2)}
- Reason for Call: The payment attempt failed at final checkout.
- Objective: Assist the customer immediately with empathy, reassurance, and white-glove support.

GUARDRAILS & OPERATING RULES:
1. Tone: Warm, poised, courteous, respectful, and articulate.
2. Empathy First: Acknowledge that payment gateway glitches happen and confirm that their items (${itemList}) are safely held in reserve.
3. Solutions: Offer alternative payment options (Apple Pay, Google Pay, Razorpay UPI, or alternative card).
4. Direct SMS Checkout: Offer to send an instantaneous 1-tap secure checkout link directly to their phone.
5. Discount Ceiling: You may NOT offer any discount exceeding ${context.discountCeilingPercentage || 10}%.
6. Zero Hallucination: Never invent products, store policies, or fake shipment delivery dates.
7. Brevity: Keep conversational turns brief and natural (under 25 words per turn for smooth WebRTC audio latency).`;
}

/**
 * Constructs standard valid TwiML XML payload for Twilio WebRTC media streaming.
 */
export function generateVIPVoiceTwiml(context: VIPVoiceContext): string {
  const name = context.customerName ? context.customerName.split(' ')[0] : 'Valued Client';
  const streamUrl = context.streamUrl || 'wss://recoverflow-ai-kohl.vercel.app/api/voice/media-stream';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural" language="en-US">
    Hello ${escapeXml(name)}, this is your dedicated concierge from ${escapeXml(context.storeName)}. We noticed an issue while securing your order of ${escapeXml(context.currency)} ${context.totalPrice.toFixed(2)}. Please hold while I connect you with our live VIP support assistant.
  </Say>
  <Connect>
    <Stream url="${escapeXml(streamUrl)}">
      <Parameter name="cartId" value="${escapeXml(context.cartId)}" />
      <Parameter name="cartToken" value="${escapeXml(context.cartToken)}" />
      <Parameter name="customerName" value="${escapeXml(name)}" />
      <Parameter name="totalPrice" value="${escapeXml(String(context.totalPrice))}" />
      <Parameter name="currency" value="${escapeXml(context.currency)}" />
      <Parameter name="storeName" value="${escapeXml(context.storeName)}" />
      <Parameter name="checkoutUrl" value="${escapeXml(context.checkoutUrl)}" />
    </Stream>
  </Connect>
</Response>`.trim();
}

/**
 * Builds a 1-tap SMS rescue message with express checkout link.
 */
export function generate1TapSmsRescue(context: VIPVoiceContext, discountCode?: string): string {
  const name = context.customerName ? context.customerName.split(' ')[0] : 'there';
  const discountText = discountCode ? ` Use code ${discountCode} at checkout.` : '';
  return `Hi ${name}, this is ${context.storeName} VIP Concierge. Your cart (${context.currency} ${context.totalPrice.toFixed(2)}) is reserved. Complete your secure checkout in 1-tap: ${context.checkoutUrl}${discountText}`;
}

/**
 * Dispatches VIP voice rescue call via Twilio Voice API.
 * Falls back cleanly to simulated mode if live credentials are not set.
 */
export async function dispatchVipVoiceRescue(params: {
  context: VIPVoiceContext;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromPhone?: string;
}): Promise<TwilioVoiceCallResult> {
  const { context, twilioAccountSid, twilioAuthToken, twilioFromPhone } = params;
  const twiml = generateVIPVoiceTwiml(context);

  const accountSid = twilioAccountSid || process.env.TWILIO_ACCOUNT_SID;
  const authToken = twilioAuthToken || process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = twilioFromPhone || process.env.TWILIO_PHONE_NUMBER || '+15005550006';

  if (!context.customerPhone) {
    return {
      success: false,
      twiml,
      simulated: false,
      error: 'Missing customer phone number for VIP voice outreach',
    };
  }

  // Simulated mode if missing live Twilio credentials or test account
  if (!accountSid || !authToken || accountSid.startsWith('AC_test') || authToken === 'test_token') {
    return {
      success: true,
      callSid: `CA_mock_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      twiml,
      smsRescueDispatched: true,
      smsMessageId: `SM_mock_${Date.now().toString(36)}`,
      simulated: true,
    };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
    const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;

    const formData = new URLSearchParams();
    formData.append('To', context.customerPhone);
    formData.append('From', fromNumber);
    formData.append('Twiml', twiml);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = (await response.json()) as { sid?: string; message?: string; status?: string };

    if (!response.ok) {
      return {
        success: false,
        twiml,
        simulated: false,
        error: data.message || `Twilio call dispatch failed with HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      callSid: data.sid,
      twiml,
      smsRescueDispatched: true,
      simulated: false,
    };
  } catch (err: unknown) {
    return {
      success: false,
      twiml,
      simulated: false,
      error: err instanceof Error ? err.message : 'Network error connecting to Twilio',
    };
  }
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
