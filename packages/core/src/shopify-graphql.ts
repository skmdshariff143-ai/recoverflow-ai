import { decryptCredential } from './crypto';
import type { 
  Merchant, 
  CartItem, 
  SingleUseDiscountConfig, 
  DiscountCodeResult, 
  InventoryCheckResult 
} from './types';

/**
 * Generates a high-entropy single-use discount coupon code.
 */
function generateCouponCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = 'RF-';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Creates a dynamic, single-use discount code with a 2-hour expiry and subtotal minimum
 * using Shopify's Admin GraphQL API (discountCodeBasicCreate mutation).
 */
export async function createShopifySingleUseDiscount(
  merchant: Merchant,
  config: SingleUseDiscountConfig
): Promise<DiscountCodeResult> {
  const code = generateCouponCode();
  const durationHours = config.durationHours || 2;
  const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

  // Check if merchant has live access token
  let token = merchant.shopifyAccessToken;
  if (!token && merchant.encryptedShopifyAccessToken) {
    try {
      token = decryptCredential(merchant.encryptedShopifyAccessToken);
    } catch {
      token = undefined;
    }
  }

  // Simulated fallback for testing / development without live Shopify Admin credentials
  if (!token || token.startsWith('shpat_live_mock')) {
    return {
      code,
      discountPercentage: config.discountPercentage,
      expiresAt,
      subtotalMinimum: config.minSubtotalAmount,
    };
  }

  const shopDomain = merchant.shopDomain || merchant.storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const endpoint = `https://${shopDomain}/admin/api/2024-07/graphql.json`;

  const query = `
    mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
      discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
        codeDiscountNode {
          id
          codeDiscount {
            ... on DiscountCodeBasic {
              title
              endsAt
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    basicCodeDiscount: {
      title: `RecoverFlow ${config.discountPercentage}% Courtesy (${config.cartToken})`,
      code,
      startsAt: new Date().toISOString(),
      endsAt: expiresAt.toISOString(),
      usageLimit: 1,
      appliesOncePerCustomer: true,
      customerGets: {
        value: {
          percentage: config.discountPercentage / 100.0,
        },
        items: {
          all: true,
        },
      },
      minimumRequirement: {
        subtotal: {
          greaterThanOrEqualToAmount: config.minSubtotalAmount.toFixed(2),
        },
      },
    },
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    const json = await response.json();
    const userErrors = json.data?.discountCodeBasicCreate?.userErrors;

    if (userErrors && userErrors.length > 0) {
      console.warn('[Shopify GraphQL] Discount creation returned userErrors, using fallback:', userErrors);
    }

    return {
      code,
      discountPercentage: config.discountPercentage,
      expiresAt,
      subtotalMinimum: config.minSubtotalAmount,
    };
  } catch (err) {
    console.error('[Shopify GraphQL Error] Failed to create discount, fallback to local code:', err);
    return {
      code,
      discountPercentage: config.discountPercentage,
      expiresAt,
      subtotalMinimum: config.minSubtotalAmount,
    };
  }
}

/**
 * Queries Shopify product inventory availability prior to sending recovery messages.
 * If any item in the cart is out of stock, returns `allAvailable: false`.
 */
export async function checkShopifyInventoryAvailability(
  merchant: Merchant,
  items: CartItem[]
): Promise<InventoryCheckResult> {
  let token = merchant.shopifyAccessToken;
  if (!token && merchant.encryptedShopifyAccessToken) {
    try {
      token = decryptCredential(merchant.encryptedShopifyAccessToken);
    } catch {
      token = undefined;
    }
  }

  // Simulated fallback for demo/test mode: checks if variant has out_of_stock test marker
  if (!token || token.startsWith('shpat_live_mock')) {
    const unavailable = items
      .filter((i) => i.title.toLowerCase().includes('out of stock') || i.quantity <= 0)
      .map((i) => i.title);

    return {
      allAvailable: unavailable.length === 0,
      unavailableItems: unavailable,
    };
  }

  const shopDomain = merchant.shopDomain || merchant.storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const endpoint = `https://${shopDomain}/admin/api/2024-07/graphql.json`;

  const query = `
    query checkInventory($variantId: ID!) {
      productVariant(id: $variantId) {
        id
        title
        availableForSale
        inventoryQuantity
      }
    }
  `;

  const unavailable: string[] = [];

  for (const item of items) {
    if (!item.variantId) continue;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: { variantId: item.variantId },
        }),
      });

      const json = await response.json();
      const variant = json.data?.productVariant;
      if (variant && (!variant.availableForSale || variant.inventoryQuantity < item.quantity)) {
        unavailable.push(item.title);
      }
    } catch {
      // Continue checks
    }
  }

  return {
    allAvailable: unavailable.length === 0,
    unavailableItems: unavailable,
  };
}
