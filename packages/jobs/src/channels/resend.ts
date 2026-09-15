import type { CartItem } from '@recoverflow/core';

export interface EmailRecoveryPayload {
  to: string;
  customerName?: string;
  storeName: string;
  fromEmail?: string;
  items: CartItem[];
  totalPrice: number;
  currency: string;
  checkoutUrl: string;
  discountCode?: string | null;
  messageBody?: string;
  apiKey?: string;
}

export interface EmailSendResult {
  success: boolean;
  emailId?: string;
  error?: string;
  htmlPreview?: string;
  simulated?: boolean;
}

/**
 * Builds a responsive, high-converting HTML cart recovery email.
 */
export function buildResponsiveCartEmailHtml(payload: EmailRecoveryPayload): string {
  const name = payload.customerName ? payload.customerName.split(' ')[0] : 'there';
  const itemsHtml = payload.items
    .map(
      (item) => `
    <tr style="border-bottom: 1px solid #27272a;">
      <td style="padding: 14px 8px; width: 68px;">
        <img src="${item.imageUrl || 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=120'}" alt="${item.title}" style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover; display: block;" />
      </td>
      <td style="padding: 14px 12px; color: #f4f4f5; font-size: 14px;">
        <div style="font-weight: 600;">${item.title}</div>
        ${item.variantTitle ? `<div style="font-size: 12px; color: #a1a1aa; margin-top: 2px;">${item.variantTitle}</div>` : ''}
        <div style="font-size: 12px; color: #71717a; margin-top: 2px;">Qty: ${item.quantity}</div>
      </td>
      <td style="padding: 14px 8px; color: #10b981; font-weight: 600; font-size: 14px; text-align: right;">
        ${payload.currency} ${(item.price * item.quantity).toFixed(2)}
      </td>
    </tr>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Complete your order at ${payload.storeName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #09090b; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #18181b; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; padding: 32px 24px;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <h1 style="margin: 0; color: #f4f4f5; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">${payload.storeName}</h1>
            </td>
          </tr>
          <!-- Body Text -->
          <tr>
            <td style="color: #d4d4d8; font-size: 15px; line-height: 24px; padding-bottom: 20px;">
              <p style="margin: 0 0 12px 0;">Hello ${name},</p>
              <p style="margin: 0;">${payload.messageBody || "We noticed you left something special in your cart. We've temporarily reserved your selection so you don't lose out."}</p>
            </td>
          </tr>
          ${
            payload.discountCode
              ? `
          <!-- Discount Pill -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <div style="background-color: rgba(16, 185, 129, 0.1); border: 1px dashed #10b981; border-radius: 8px; padding: 12px 20px; display: inline-block;">
                <span style="color: #a1a1aa; font-size: 13px;">Special courtesy applied:</span>
                <span style="color: #10b981; font-weight: 700; font-size: 16px; margin-left: 8px; letter-spacing: 1px;">${payload.discountCode}</span>
              </div>
            </td>
          </tr>`
              : ''
          }
          <!-- Items Table -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin-bottom: 24px;">
                ${itemsHtml}
                <tr>
                  <td colspan="2" style="padding: 16px 8px; font-weight: 600; color: #a1a1aa; font-size: 14px;">Total</td>
                  <td style="padding: 16px 8px; font-weight: 700; color: #f4f4f5; font-size: 16px; text-align: right;">${payload.currency} ${payload.totalPrice.toFixed(2)}</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding-bottom: 20px;">
              <a href="${payload.checkoutUrl}" target="_blank" style="background-color: #2563eb; color: #ffffff; padding: 14px 32px; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 10px; display: inline-block; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);">
                Complete Secure Checkout &rarr;
              </a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 16px; border-top: 1px solid #27272a; color: #71717a; font-size: 12px; line-height: 18px;">
              Need help? Reply directly to this email or reach us on WhatsApp.<br/>
              To stop receiving recovery notices, <a href="${payload.checkoutUrl}/unsubscribe" style="color: #a1a1aa; text-decoration: underline;">unsubscribe here</a>.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Dispatches an email via Resend API.
 */
export async function sendCartRecoveryEmail(payload: EmailRecoveryPayload): Promise<EmailSendResult> {
  const apiKey = payload.apiKey || process.env.RESEND_API_KEY;
  const html = buildResponsiveCartEmailHtml(payload);

  if (!apiKey || apiKey === 're_test_mock_key') {
    return {
      success: true,
      emailId: `email_mock_${Date.now().toString(36)}`,
      htmlPreview: html,
      simulated: true,
    };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: payload.fromEmail || 'RecoverFlow <recovery@recoverflow.ai>',
        to: [payload.to],
        subject: `Your reserved cart at ${payload.storeName}`,
        html,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return {
        success: false,
        error: data.message || 'Failed to dispatch email via Resend API',
        htmlPreview: html,
      };
    }

    return {
      success: true,
      emailId: data.id,
      htmlPreview: html,
      simulated: false,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error communicating with Resend',
      htmlPreview: html,
    };
  }
}
