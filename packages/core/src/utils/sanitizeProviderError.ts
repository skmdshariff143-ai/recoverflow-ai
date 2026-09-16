/**
 * PayBack AI — Provider Error Sanitization & PII Redaction Utility.
 *
 * Implements strict allowlist parsing and field-level redaction for external gateway responses.
 * Prevents credential leaks, authorization header leakage, cardholder PII, and customer numbers from entering logs.
 */

export interface SanitizedProviderError {
  gatewayErrorCode: string;
  gatewayDescription: string;
  httpStatus?: number;
  category: 'AUTHENTICATION' | 'RATE_LIMIT' | 'NETWORK' | 'GATEWAY_ERROR' | 'INVALID_REQUEST' | 'UNKNOWN';
  safeSummary: string;
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(\+?91[\-\s]?)?[6-9]\d{9}/g;
const BEARER_TOKEN_REGEX = /Bearer\s+[a-zA-Z0-9_\-\.]+/gi;
const BASIC_AUTH_REGEX = /Basic\s+[a-zA-Z0-9=+/]+/gi;
const CARD_REGEX = /\b(?:\d[ -]*?){13,16}\b/g;

/**
 * Scrub sensitive strings and regex patterns from text.
 */
export function redactSensitivePatterns(text: string): string {
  if (!text) return '';
  return text
    .replace(BEARER_TOKEN_REGEX, 'Bearer [REDACTED_TOKEN]')
    .replace(BASIC_AUTH_REGEX, 'Basic [REDACTED_CREDENTIALS]')
    .replace(CARD_REGEX, '[REDACTED_CARD_NUMBER]')
    .replace(EMAIL_REGEX, '[REDACTED_EMAIL]')
    .replace(PHONE_REGEX, '[REDACTED_PHONE]');
}

/**
 * Extract safe allowlisted diagnostic fields from unknown provider errors.
 */
export function sanitizeProviderError(rawError: unknown, statusCode?: number): SanitizedProviderError {
  if (!rawError) {
    return {
      gatewayErrorCode: 'UNKNOWN_EMPTY_ERROR',
      gatewayDescription: 'Empty provider response received',
      httpStatus: statusCode ?? 500,
      category: 'UNKNOWN',
      safeSummary: 'Provider returned an empty error response.',
    };
  }

  // Handle standard Error instances
  if (rawError instanceof Error) {
    const cleanMessage = redactSensitivePatterns(rawError.message);
    const lower = cleanMessage.toLowerCase();
    let category: SanitizedProviderError['category'] = 'GATEWAY_ERROR';
    if (lower.includes('timeout') || lower.includes('etimedout') || lower.includes('econnreset') || statusCode === 504 || statusCode === 503) {
      category = 'NETWORK';
    } else if (lower.includes('auth') || lower.includes('unauthorized') || statusCode === 401 || statusCode === 403) {
      category = 'AUTHENTICATION';
    } else if (statusCode === 429 || lower.includes('rate limit')) {
      category = 'RATE_LIMIT';
    }

    return {
      gatewayErrorCode: rawError.name || 'GATEWAY_EXCEPTION',
      gatewayDescription: cleanMessage,
      httpStatus: statusCode ?? 502,
      category,
      safeSummary: `Gateway reported: ${cleanMessage.slice(0, 160)}`,
    };
  }

  // Handle structured object from Axios/Fetch/Razorpay JSON
  if (typeof rawError === 'object' && rawError !== null) {
    const record = rawError as Record<string, unknown>;
    const errorObj = (record.error as Record<string, unknown>) || record;

    const rawCode = String(errorObj.code || errorObj.error_code || 'GATEWAY_ERROR');
    const rawDesc = String(errorObj.description || errorObj.message || errorObj.error_description || 'Unknown provider error');
    const cleanCode = redactSensitivePatterns(rawCode).replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanDesc = redactSensitivePatterns(rawDesc);

    let category: SanitizedProviderError['category'] = 'GATEWAY_ERROR';
    if (statusCode === 401 || statusCode === 403 || cleanCode.includes('AUTH')) {
      category = 'AUTHENTICATION';
    } else if (statusCode === 429 || cleanCode.includes('RATE_LIMIT')) {
      category = 'RATE_LIMIT';
    } else if (statusCode === 400 || cleanCode.includes('BAD_REQUEST')) {
      category = 'INVALID_REQUEST';
    } else if (statusCode === 504 || statusCode === 503) {
      category = 'NETWORK';
    }

    return {
      gatewayErrorCode: cleanCode.slice(0, 64),
      gatewayDescription: cleanDesc.slice(0, 256),
      httpStatus: statusCode ?? (typeof record.status === 'number' ? record.status : 502),
      category,
      safeSummary: `[${category}] ${cleanCode}: ${cleanDesc.slice(0, 160)}`,
    };
  }

  // Handle raw string
  const cleanStr = redactSensitivePatterns(String(rawError)).slice(0, 256);
  return {
    gatewayErrorCode: 'UNSTRUCTURED_GATEWAY_ERROR',
    gatewayDescription: cleanStr,
    httpStatus: statusCode ?? 502,
    category: 'GATEWAY_ERROR',
    safeSummary: `Gateway returned unstructured error: ${cleanStr}`,
  };
}
