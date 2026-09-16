/**
 * Programmatic Web Pixel Extension Registration via Shopify Admin GraphQL API (2026-01)
 */

export interface RegisterWebPixelParams {
  shopDomain: string;
  accessToken: string;
  accountID: string;
  endpointUrl?: string;
}

export interface WebPixelCreateResult {
  success: boolean;
  pixelId?: string;
  userErrors?: Array<{ field: string[]; message: string }>;
  error?: string;
}

export const WEB_PIXEL_CREATE_MUTATION = `
  mutation webPixelCreate($webPixel: WebPixelInput!) {
    webPixelCreate(webPixel: $webPixel) {
      userErrors {
        field
        message
      }
      webPixel {
        id
        settings
      }
    }
  }
`;

export async function registerShopifyWebPixel(params: RegisterWebPixelParams): Promise<WebPixelCreateResult> {
  const { shopDomain, accessToken, accountID, endpointUrl } = params;
  const endpoint = `https://${shopDomain}/admin/api/2026-01/graphql.json`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({
        query: WEB_PIXEL_CREATE_MUTATION,
        variables: {
          webPixel: {
            settings: JSON.stringify({
              accountID,
              endpointUrl: endpointUrl || 'https://recoverflow-ai-kohl.vercel.app/api/v1/telemetry/intent',
            }),
          },
        },
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const json = (await response.json()) as {
      data?: {
        webPixelCreate?: {
          userErrors?: Array<{ field: string[]; message: string }>;
          webPixel?: { id: string };
        };
      };
      errors?: Array<{ message: string }>;
    };

    if (json.errors && json.errors.length > 0) {
      return {
        success: false,
        error: json.errors.map((e) => e.message).join(', '),
      };
    }

    const payload = json.data?.webPixelCreate;
    if (payload?.userErrors && payload.userErrors.length > 0) {
      return {
        success: false,
        userErrors: payload.userErrors,
      };
    }

    return {
      success: true,
      pixelId: payload?.webPixel?.id,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown network error',
    };
  }
}
