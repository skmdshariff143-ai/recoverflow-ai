import { z } from 'zod';
import type { FailureCategory } from '@recoverflow/core';

export const DiagnosticResponseSchema = z.object({
  normalizedCategory: z.string(),
  isRecoverable: z.boolean(),
  confidenceScore: z.number().min(0).max(1),
  plainExplanation: z.string(),
  suggestedAction: z.enum(['retry', 'reminder', 'both', 'none']),
  provider: z.string().optional(),
});

export type DiagnosticResponse = z.infer<typeof DiagnosticResponseSchema>;

export const CustomerMessageResponseSchema = z.object({
  messageBody: z.string(),
  tone: z.enum(['gentle_reminder', 'urgent_action', 'empathetic_support', 'technical_instruction']),
  suggestedChannel: z.enum(['whatsapp', 'sms', 'email']),
  complianceNotice: z.string(),
});

export type CustomerMessageResponse = z.infer<typeof CustomerMessageResponseSchema>;

export function deterministicDiagnosticFallback(errorString: string, categoryHint?: FailureCategory): DiagnosticResponse {
  const lower = (errorString || '').toLowerCase();
  
  if (lower.includes('dispute') || lower.includes('cancelled') || lower.includes('stop')) {
    return {
      normalizedCategory: 'customer_cancellation',
      isRecoverable: false,
      confidenceScore: 0.99,
      plainExplanation: 'Customer cancellation or dispute raised. Outreach halted per compliance.',
      suggestedAction: 'none',
      provider: 'deterministic_fallback',
    };
  }
  if (lower.includes('closed') || lower.includes('blocked') || lower.includes('freeze')) {
    return {
      normalizedCategory: 'permanent_account_closure',
      isRecoverable: false,
      confidenceScore: 0.98,
      plainExplanation: 'Customer account is permanently inactive or closed. Recovery stopped.',
      suggestedAction: 'none',
      provider: 'deterministic_fallback',
    };
  }
  if (lower.includes('otp') || lower.includes('pin') || lower.includes('3d') || lower.includes('auth')) {
    return {
      normalizedCategory: 'auth_failure',
      isRecoverable: true,
      confidenceScore: 0.85,
      plainExplanation: 'Authentication step failed or timed out during 3D Secure / OTP verification.',
      suggestedAction: 'reminder',
      provider: 'deterministic_fallback',
    };
  }
  if (lower.includes('insufficient') || lower.includes('balance') || lower.includes('low funds')) {
    return {
      normalizedCategory: 'insufficient_funds',
      isRecoverable: true,
      confidenceScore: 0.95,
      plainExplanation: 'Payment declined due to insufficient available balance on customer account.',
      suggestedAction: 'both',
      provider: 'deterministic_fallback',
    };
  }
  if (lower.includes('503') || lower.includes('unavailable') || lower.includes('downtime') || lower.includes('degraded') || lower.includes('timeout') || lower.includes('banking')) {
    return {
      normalizedCategory: 'bank_downtime',
      isRecoverable: true,
      confidenceScore: 0.90,
      plainExplanation: 'Issuing bank or payment switch temporary network timeout or downtime.',
      suggestedAction: 'retry',
      provider: 'deterministic_fallback',
    };
  }
  
  return {
    normalizedCategory: categoryHint || 'auth_failure',
    isRecoverable: true,
    confidenceScore: 0.75,
    plainExplanation: 'Authentication step failed during 3D Secure / UPI PIN verification.',
    suggestedAction: 'reminder',
    provider: 'deterministic_fallback',
  };
}

export async function diagnoseGatewayErrorWithGemini(
  errorString: string,
  categoryHint?: FailureCategory,
  _merchantName?: string,
  _apiKey?: string,
): Promise<DiagnosticResponse> {
  return deterministicDiagnosticFallback(errorString, categoryHint);
}

export async function draftCustomerCommunicationWithGemini(
  customerName: string,
  amountINR: string,
  category: string,
  paymentLinkUrl?: string,
  _brandTone?: string,
  _apiKey?: string,
): Promise<CustomerMessageResponse> {
  const linkText = paymentLinkUrl ? ` Complete your transaction securely here: ${paymentLinkUrl}` : '';
  return {
    messageBody: `Hi ${customerName}, your recent payment of ${amountINR} could not be completed. We saved your order.${linkText}`,
    tone: 'gentle_reminder',
    suggestedChannel: 'whatsapp',
    complianceNotice: 'Standard TRAI/RBI compliance: Policy-constrained prototype communication requiring merchant compliance review.',
  };
}
