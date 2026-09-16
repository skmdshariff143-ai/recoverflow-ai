/**
 * RecoverFlow Autonomous WISMO (Where Is My Order) Resolver Agent
 * Principles: Accurate real-time logistics lookup, carrier tracking link synthesis, and brand-tone delivery estimates.
 */

import {
  db,
  type Merchant,
  type OrderRecord,
  type FulfillmentRecord,
  type FulfillmentTransitStatus,
} from '@recoverflow/core';
import { getGeminiClient } from './gemini';

export interface WismoAgentInput {
  customerIdentifier?: string; // Phone number, email, or name
  incomingMessage: string;
  merchant: Merchant;
  orderNumberOrTracking?: string;
}

export interface WismoAgentOutput {
  reply: string;
  foundOrder: boolean;
  orderNumber?: string;
  trackingCompany?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  transitStatus?: FulfillmentTransitStatus;
  estimatedDeliveryDate?: string;
  latestLocation?: string;
}

/**
 * Extracts potential order numbers or tracking codes from customer text using regex patterns.
 */
export function extractOrderOrTrackingToken(text: string): { orderNumber?: string; trackingNumber?: string } {
  if (!text) return {};

  // Pattern for Order Number: #1234, #12345, ORD-1002, order 1042
  const orderRegex = /(?:#|order\s*(?:no\.?|number)?\s*|ord-?)([0-9]{3,8})/i;
  const orderMatch = text.match(orderRegex);

  // Pattern for Tracking Number: TRK123456, 1Z99999999, standard alphanumeric tracking codes
  const trackingRegex = /\b(TRK[0-9A-Z]{4,16}|1Z[0-9A-Z]{16}|[0-9]{12,22})\b/i;
  const trackingMatch = text.match(trackingRegex);

  return {
    orderNumber: orderMatch ? `#${orderMatch[1]}` : undefined,
    trackingNumber: trackingMatch ? trackingMatch[1] : undefined,
  };
}

/**
 * Formats a date into a friendly customer-facing delivery string (e.g. "Thursday, Sep 18").
 */
export function formatFriendlyDeliveryDate(date: Date | string | null | undefined): string {
  if (!date) return 'within 2-3 business days';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'within 2-3 business days';

  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Deterministic fallback generator for order tracking queries.
 */
export function generateDeterministicWismoReply(
  order: OrderRecord | null,
  fulfillment: FulfillmentRecord | null,
  merchant: Merchant
): WismoAgentOutput {
  if (!order) {
    return {
      reply: `Hi! Thank you for contacting ${merchant.storeName}. We'd love to check your shipping status. Could you please reply with your Order Number (e.g. #1042) or the email address used during checkout?`,
      foundOrder: false,
    };
  }

  const itemsSummary = order.items.map((i) => i.title).join(', ') || 'your ordered items';
  const estDate = fulfillment?.estimatedDeliveryAt ? formatFriendlyDeliveryDate(fulfillment.estimatedDeliveryAt) : 'within 2-3 business days';
  const carrier = fulfillment?.trackingCompany || 'our express shipping carrier';
  const trkUrl = fulfillment?.trackingUrl || `https://track.recoverflow.ai/status?order=${order.orderNumber}`;
  const status = fulfillment?.status || 'IN_TRANSIT';

  let reply = '';
  switch (status) {
    case 'DELIVERED':
      reply = `Great news! Your order ${order.orderNumber} (${itemsSummary}) was marked as DELIVERED by ${carrier}. If you haven't received it yet, please check your doorstep or secure mailbox, or view details here: ${trkUrl}`;
      break;
    case 'OUT_FOR_DELIVERY':
      reply = `Exciting news! Your order ${order.orderNumber} is OUT FOR DELIVERY today with ${carrier} and should arrive by end of day. Live tracking: ${trkUrl}`;
      break;
    case 'EXCEPTION':
      reply = `We noticed a slight carrier delay for your order ${order.orderNumber} with ${carrier}. Our logistics team is actively monitoring it. Track live updates here: ${trkUrl}`;
      break;
    case 'INFO_RECEIVED':
      reply = `Your order ${order.orderNumber} (${itemsSummary}) has been carefully prepared and packaged. It is awaiting courier pickup with ${carrier}. Expected delivery: ${estDate}. Track: ${trkUrl}`;
      break;
    case 'IN_TRANSIT':
    default:
      reply = `Your order ${order.orderNumber} (${itemsSummary}) is currently IN TRANSIT via ${carrier}. It is on track to arrive on ${estDate}. View real-time tracking here: ${trkUrl}`;
      break;
  }

  return {
    reply,
    foundOrder: true,
    orderNumber: order.orderNumber,
    trackingCompany: carrier,
    trackingNumber: fulfillment?.trackingNumber,
    trackingUrl: trkUrl,
    transitStatus: status,
    estimatedDeliveryDate: estDate,
    latestLocation: fulfillment?.latestLocation || undefined,
  };
}

/**
 * Runs the Autonomous WISMO Resolver Agent.
 */
export async function runWismoAgent(input: WismoAgentInput): Promise<WismoAgentOutput> {
  const { incomingMessage, customerIdentifier, merchant, orderNumberOrTracking } = input;

  // 1. Extract potential tokens
  const tokens = extractOrderOrTrackingToken(incomingMessage);
  const targetOrderNumber = orderNumberOrTracking || tokens.orderNumber;
  const targetTrackingNumber = tokens.trackingNumber;

  let matchedOrder: OrderRecord | null = null;
  let matchedFulfillment: FulfillmentRecord | null = null;

  // 2. Query DB by Order Number
  if (targetOrderNumber) {
    matchedOrder = await db.getOrderByOrderNumber(merchant.id, targetOrderNumber);
  }

  // 3. Query DB by Tracking Number
  if (!matchedOrder && targetTrackingNumber) {
    matchedFulfillment = await db.findFulfillmentByTracking(merchant.id, targetTrackingNumber);
    if (matchedFulfillment) {
      matchedOrder = await db.getOrder(matchedFulfillment.orderId);
    }
  }

  // 4. Query DB by Customer Phone / Email
  if (!matchedOrder && customerIdentifier) {
    const customerOrders = await db.findOrdersByCustomer(merchant.id, customerIdentifier);
    if (customerOrders.length > 0) {
      // Pick most recent order
      matchedOrder = customerOrders.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
    }
  }

  // 5. Fetch fulfillments for the order if not already fetched
  if (matchedOrder && !matchedFulfillment) {
    const orderFulfillments = await db.getFulfillmentsByOrderId(matchedOrder.id);
    if (orderFulfillments.length > 0) {
      matchedFulfillment = orderFulfillments[0];
    }
  }

  // If no order is found, return deterministic prompt for order number
  if (!matchedOrder) {
    return generateDeterministicWismoReply(null, null, merchant);
  }

  // 6. Generate reply with Gemini or deterministic fallback
  const gemini = getGeminiClient();
  if (!gemini) {
    return generateDeterministicWismoReply(matchedOrder, matchedFulfillment, merchant);
  }

  const estDate = matchedFulfillment?.estimatedDeliveryAt
    ? formatFriendlyDeliveryDate(matchedFulfillment.estimatedDeliveryAt)
    : 'within 2-3 business days';
  const carrier = matchedFulfillment?.trackingCompany || 'Express Courier';
  const trkUrl = matchedFulfillment?.trackingUrl || `https://track.recoverflow.ai/status?order=${matchedOrder.orderNumber}`;
  const status = matchedFulfillment?.status || 'IN_TRANSIT';

  const prompt = `You are the shipping & logistics customer concierge for "${merchant.storeName}".
Brand Guidelines: "${merchant.brandToneGuidelines}"

The customer has asked about their order status:
Customer Message: "${incomingMessage}"

Order Details:
- Order Number: ${matchedOrder.orderNumber}
- Items: ${matchedOrder.items.map((i) => i.title).join(', ')}
- Carrier: ${carrier}
- Tracking Number: ${matchedFulfillment?.trackingNumber || 'Available in link'}
- Transit Status: ${status}
- Estimated Delivery Date: ${estDate}
- Latest Location: ${matchedFulfillment?.latestLocation || 'In Transit'}
- Live Tracking Link: ${trkUrl}

Instructions:
1. Provide a direct, reassuring, and concise response addressing their delivery question.
2. Always include the estimated delivery date, carrier name, and live tracking link.
3. Match the merchant's tone (formal/luxury vs casual/friendly).
4. Return ONLY valid JSON:
{
  "reply": "Your message with tracking link",
  "transitStatus": "${status}",
  "estimatedDeliveryDate": "${estDate}"
}`;

  try {
    const response = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      reply: parsed.reply || generateDeterministicWismoReply(matchedOrder, matchedFulfillment, merchant).reply,
      foundOrder: true,
      orderNumber: matchedOrder.orderNumber,
      trackingCompany: carrier,
      trackingNumber: matchedFulfillment?.trackingNumber,
      trackingUrl: trkUrl,
      transitStatus: status,
      estimatedDeliveryDate: estDate,
      latestLocation: matchedFulfillment?.latestLocation || undefined,
    };
  } catch {
    return generateDeterministicWismoReply(matchedOrder, matchedFulfillment, merchant);
  }
}
