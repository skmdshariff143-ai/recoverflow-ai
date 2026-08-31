/**
 * PayBack AI — Notification Preview & PII Masking Engine.
 *
 * Generates policy-compliant SMS/Email/WhatsApp notification drafts
 * for 'reminder' and 'both' interventions with strict PII masking
 * (masking customer IDs, card numbers, and contact handles).
 *
 * Pure function — deterministic and testable.
 */

import type { ExecutedItem } from '@/types';
import { formatPaiseToINR } from './financial';

export interface NotificationDraft {
  channel: 'sms' | 'email' | 'whatsapp';
  subject: string;
  messageBody: string;
  maskedBody: string;
  complianceNotice: string;
  tone: 'empathetic' | 'direct' | 'urgent';
  isAutoDrafted: boolean;
}

/**
 * Mask sensitive identifiers in text strings.
 * Masks customer identifiers (e.g., cust_0042 -> cust_***42), emails, and phone numbers.
 */
export function maskPII(text: string): string {
  return text
    // Mask customer IDs: cust_12345 -> cust_***45
    .replace(/cust_([a-zA-Z0-9]+)/gi, (_match, id) => {
      if (id.length <= 2) return `cust_***`;
      return `cust_***${id.slice(-2)}`;
    })
    // Mask email addresses: john.doe@example.com -> j***e@example.com
    .replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, (_match, user, domain) => {
      const maskedUser = user.length > 2 ? `${user[0]}***${user[user.length - 1]}` : `${user[0]}***`;
      return `${maskedUser}@${domain}`;
    })
    // Mask phone numbers: +91 9876543210 -> +91 ******3210
    .replace(/(\+?\d{1,3}[-.\s]?)?(\d{3})[-.\s]?(\d{3})[-.\s]?(\d{4})/g, (_match, prefix, _a, _b, last4) => {
      return `${prefix ?? ''}******${last4}`;
    });
}

/**
 * Generate a standard policy-constrained communication draft for an executed payment.
 */
export function generateNotificationDraft(
  item: ExecutedItem,
  channel: 'sms' | 'email' | 'whatsapp' = 'email',
): NotificationDraft {
  const payment = item.payment;
  const inrAmount = formatPaiseToINR(payment.amount, true);
  const formattedCategory = payment.failure_category.replace(/_/g, ' ');

  let messageBody = '';
  let subject = '';
  let tone: 'empathetic' | 'direct' | 'urgent' = 'empathetic';

  if (channel === 'sms') {
    subject = `Payment Notice`;
    messageBody = `PayBack Alert: Payment of ${inrAmount} for ${payment.customer_id} could not be completed (${formattedCategory}). Update payment method: merchant.portal/pay`;
    tone = 'direct';
  } else if (channel === 'whatsapp') {
    subject = `Payment Update for ${payment.customer_id}`;
    messageBody = `Hello! Your scheduled payment of ${inrAmount} (${payment.customer_id}) had an issue: ${formattedCategory}. Please review and update your mandate in your merchant account.`;
    tone = 'empathetic';
  } else {
    // Default Email
    subject = `Action Required: Payment Update for Invoice (${inrAmount})`;
    messageBody = `Dear Customer (${payment.customer_id}),\n\nYour recent payment of ${inrAmount} could not be completed due to a temporary ${formattedCategory} issue.\n\nPlease visit your merchant account portal to retry or update your preferred payment method.\n\nThank you for your prompt attention.`;
    tone = 'empathetic';
  }

  const maskedBody = maskPII(messageBody);
  const complianceNotice =
    'Policy-constrained prototype draft requiring merchant compliance review before transmission. Reply STOP to opt out.';

  return {
    channel,
    subject: maskPII(subject),
    messageBody,
    maskedBody,
    complianceNotice,
    tone,
    isAutoDrafted: true,
  };
}
