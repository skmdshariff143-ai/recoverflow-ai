/**
 * RecoverFlow Omni-Lifecycle Post-Purchase Upsell Agent (Track 4)
 * Principles: 2-hour post-purchase trigger, high-margin bundle addition, and headless Shopify GraphQL orderEditAddVariant mutation.
 */

import { getGeminiClient } from '../gemini';
import type { OrderRecord, Merchant } from '@recoverflow/core';

export interface CatalogVariant {
  variantId: string;
  title: string;
  price: number;
  marginPercentage: number;
}

export interface UpsellAgentInput {
  order: OrderRecord;
  merchant: Merchant;
  availableCatalogItems?: CatalogVariant[];
  targetDiscountPercentage?: number; // e.g. 10%
}

export interface UpsellAgentOutput {
  recommendedItem: CatalogVariant;
  upsellMessage: string;
  addVariantMutationGql: string;
  originalPrice: number;
  discountedPrice: number;
  channel: 'WHATSAPP' | 'EMAIL';
}

const DEFAULT_UPSELL_CATALOG: CatalogVariant[] = [
  {
    variantId: 'gid://shopify/ProductVariant/9910248101',
    title: 'Silk Finishing Care Spray & Polish Kit',
    price: 35.0,
    marginPercentage: 75.0,
  },
  {
    variantId: 'gid://shopify/ProductVariant/9910248102',
    title: 'Handcrafted Italian Leather Cardholder',
    price: 65.0,
    marginPercentage: 68.0,
  },
  {
    variantId: 'gid://shopify/ProductVariant/9910248103',
    title: 'Signature Cashmere Garment Bag & Cedar Block Set',
    price: 45.0,
    marginPercentage: 80.0,
  },
];

/**
 * Builds the Shopify GraphQL orderEditAddVariant mutation string.
 */
export function buildOrderEditAddVariantMutation(
  orderId: string,
  variantId: string,
  quantity = 1
): string {
  return `mutation AddUpsellToOrder {
  orderEditBegin(id: "gid://shopify/Order/${orderId.replace(/^gid:\/\/shopify\/Order\//, '')}") {
    calculatedOrder {
      id
    }
    userErrors {
      field
      message
    }
  }
  orderEditAddVariant(
    id: "gid://shopify/CalculatedOrder/${orderId.replace(/^gid:\/\/shopify\/Order\//, '')}",
    variantId: "${variantId}",
    quantity: ${quantity}
  ) {
    calculatedLineItem {
      id
      title
    }
    userErrors {
      field
      message
    }
  }
  orderEditCommit(
    id: "gid://shopify/CalculatedOrder/${orderId.replace(/^gid:\/\/shopify\/Order\//, '')}",
    notifyCustomer: true
  ) {
    order {
      id
    }
    userErrors {
      field
      message
    }
  }
}`;
}

/**
 * Runs the Post-Purchase Upsell Agent.
 */
export async function runUpsellAgent(input: UpsellAgentInput): Promise<UpsellAgentOutput> {
  const { order, merchant, availableCatalogItems = DEFAULT_UPSELL_CATALOG, targetDiscountPercentage = 10 } = input;

  // Pick highest-margin item from available catalog
  const recommendedItem = [...availableCatalogItems].sort((a, b) => b.marginPercentage - a.marginPercentage)[0] || DEFAULT_UPSELL_CATALOG[0];

  const discountFraction = Math.min(targetDiscountPercentage, merchant.discountCeilingPercentage) / 100;
  const discountedPrice = Math.round(recommendedItem.price * (1 - discountFraction) * 100) / 100;

  const firstPurchasedItem = order.items[0]?.title || 'your recent order';
  const mutationGql = buildOrderEditAddVariantMutation(order.shopifyOrderId, recommendedItem.variantId, 1);

  const gemini = getGeminiClient();
  if (!gemini) {
    return {
      recommendedItem,
      upsellMessage: `Hi ${order.customerName || 'there'}! Thank you for ordering ${firstPurchasedItem} at ${merchant.storeName}. As an exclusive perk, add the ${recommendedItem.title} to your parcel for just ${order.currency} ${discountedPrice.toFixed(2)} (${targetDiscountPercentage}% off) before it ships! Reply YES to add.`,
      addVariantMutationGql: mutationGql,
      originalPrice: recommendedItem.price,
      discountedPrice,
      channel: order.customerPhone ? 'WHATSAPP' : 'EMAIL',
    };
  }

  const prompt = `You are the VIP post-purchase stylist for "${merchant.storeName}".
Brand Guidelines: "${merchant.brandToneGuidelines}"
Customer Name: ${order.customerName || 'Shopper'}
Purchased Items: ${order.items.map((i) => i.title).join(', ')}
Recommended Bundle Add-on: ${recommendedItem.title} (Original: ${order.currency} ${recommendedItem.price}, Discounted: ${order.currency} ${discountedPrice})

Write a natural, non-pushy WhatsApp message (under 3 sentences) offering to seamlessly combine this complementary accessory into their existing shipment before the warehouse dispatches it. Inform them they can reply "ADD" to confirm.`;

  try {
    const response = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { temperature: 0.3 },
    });

    return {
      recommendedItem,
      upsellMessage: response.text?.trim() || `Hi ${order.customerName || 'there'}! Add ${recommendedItem.title} to your shipment for only ${order.currency} ${discountedPrice.toFixed(2)}. Reply YES to include it!`,
      addVariantMutationGql: mutationGql,
      originalPrice: recommendedItem.price,
      discountedPrice,
      channel: order.customerPhone ? 'WHATSAPP' : 'EMAIL',
    };
  } catch {
    return {
      recommendedItem,
      upsellMessage: `Hi ${order.customerName || 'there'}! Add the ${recommendedItem.title} to your order ${order.orderNumber} for only ${order.currency} ${discountedPrice.toFixed(2)}. Reply YES to combine into your shipment!`,
      addVariantMutationGql: mutationGql,
      originalPrice: recommendedItem.price,
      discountedPrice,
      channel: order.customerPhone ? 'WHATSAPP' : 'EMAIL',
    };
  }
}
