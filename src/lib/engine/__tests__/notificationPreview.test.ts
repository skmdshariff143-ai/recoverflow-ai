/**
 * PayBack AI — Unit Tests for Notification Preview & PII Masking.
 */

import { describe, test, expect } from 'vitest';
import { maskPII, generateNotificationDraft } from '@/lib/engine/notificationPreview';
import { generateSyntheticPayments } from '@/lib/engine/generateData';
import { runRecoveryBatch } from '@/lib/engine/runBatch';

describe('maskPII', () => {
  test('masks customer IDs correctly', () => {
    expect(maskPII('cust_0042')).toBe('cust_***42');
    expect(maskPII('Contacting cust_99999 for retry')).toBe('Contacting cust_***99 for retry');
  });

  test('masks email addresses', () => {
    expect(maskPII('user@example.com')).toBe('u***r@example.com');
    expect(maskPII('contact john.doe@merchant.com now')).toBe('contact j***e@merchant.com now');
  });

  test('masks phone numbers', () => {
    expect(maskPII('+91 9876543210')).toContain('******3210');
  });
});

describe('generateNotificationDraft', () => {
  const payments = generateSyntheticPayments({ seed: 42, totalRecords: 100 });
  const batchResult = runRecoveryBatch(payments, { budget: 40 });
  const reminderItem = batchResult.executed_items.find(
    (i) => i.suggested_intervention === 'reminder' || i.suggested_intervention === 'both',
  );

  test('generates non-empty masked draft for reminder or both intervention', () => {
    expect(reminderItem).toBeDefined();
    if (!reminderItem) return;

    const emailDraft = generateNotificationDraft(reminderItem, 'email');
    expect(emailDraft.subject).toBeTruthy();
    expect(emailDraft.messageBody).toBeTruthy();
    expect(emailDraft.maskedBody).toBeTruthy();
    expect(emailDraft.complianceNotice).toContain('merchant compliance review');

    // Customer ID in masked body must be masked
    expect(emailDraft.maskedBody).toContain('cust_***');
    expect(emailDraft.maskedBody).not.toContain(reminderItem.payment.customer_id);

    const smsDraft = generateNotificationDraft(reminderItem, 'sms');
    expect(smsDraft.channel).toBe('sms');
    expect(smsDraft.maskedBody).toContain('cust_***');
  });
});
