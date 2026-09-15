import crypto from 'node:crypto';

/**
 * Verifies the Shopify Webhook HMAC-SHA256 signature.
 * 
 * @param rawBody - Raw body buffer or string from the HTTP request
 * @param hmacHeader - Header value from 'x-shopify-hmac-sha256'
 * @param secret - Merchant webhook secret
 * @returns boolean indicating if the signature is authentic
 */
export function verifyShopifyHmac(
  rawBody: string | Buffer,
  hmacHeader: string | null | undefined,
  secret: string
): boolean {
  if (!hmacHeader || !secret) {
    return false;
  }

  try {
    const calculatedHmac = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64');

    const calculatedBuffer = Buffer.from(calculatedHmac, 'utf8');
    const providedBuffer = Buffer.from(hmacHeader, 'utf8');

    if (calculatedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(calculatedBuffer, providedBuffer);
  } catch {
    return false;
  }
}

/**
 * Verifies Meta WhatsApp Cloud API Webhook signature (X-Hub-Signature-256).
 * 
 * @param rawBody - Raw body buffer or string
 * @param signatureHeader - Header value from 'x-hub-signature-256' ('sha256=...')
 * @param appSecret - Meta App Secret
 * @returns boolean indicating authenticity
 */
export function verifyWhatsAppSignature(
  rawBody: string | Buffer,
  signatureHeader: string | null | undefined,
  appSecret: string
): boolean {
  if (!signatureHeader || !appSecret) {
    return false;
  }

  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    return false;
  }

  try {
    const calculatedHash = crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');

    const expectedBuffer = Buffer.from(calculatedHash, 'utf8');
    const actualBuffer = Buffer.from(parts[1], 'utf8');

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  } catch {
    return false;
  }
}

/**
 * Normalizes phone numbers to standard E.164 format.
 */
export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }
  return `+${cleaned}`;
}

/**
 * Normalizes email addresses.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
