import { describe, it, expect, beforeEach } from 'vitest';
import { SuppressionService } from '@recoverflow/core';

describe('Suppression & Opt-Out Enforcement', () => {
  let suppressionService: SuppressionService;
  const merchantId = 'merchant_test_store';

  beforeEach(() => {
    suppressionService = new SuppressionService();
  });

  it('blocks communications to suppressed phone numbers', async () => {
    const rawPhone = '+14155559988';
    await suppressionService.suppress(merchantId, rawPhone, 'PHONE', 'USER_UNSUBSCRIBE');

    const isBlocked = await suppressionService.isSuppressed(merchantId, rawPhone, 'PHONE');
    expect(isBlocked).toBe(true);
  });

  it('allows un-suppressed numbers to proceed', async () => {
    const isBlocked = await suppressionService.isSuppressed(merchantId, '+12065551234', 'PHONE');
    expect(isBlocked).toBe(false);
  });

  it('normalizes formatting differences when verifying suppression', async () => {
    // Add formatted phone
    await suppressionService.suppress(merchantId, '(555) 234-5678', 'PHONE', 'USER_UNSUBSCRIBE');

    // Query unformatted phone
    const isBlocked = await suppressionService.isSuppressed(merchantId, '+15552345678', 'PHONE');
    expect(isBlocked).toBe(true);
  });

  it('blocks communications to suppressed email addresses regardless of casing', async () => {
    await suppressionService.suppress(merchantId, 'OptOutCustomer@Example.com', 'EMAIL', 'COMPLAINT');

    const isBlocked = await suppressionService.isSuppressed(merchantId, 'optoutcustomer@example.com', 'EMAIL');
    expect(isBlocked).toBe(true);
  });

  it('supports removal from the suppression list', async () => {
    const phone = '+14155550011';
    await suppressionService.suppress(merchantId, phone, 'PHONE', 'MANUAL');
    expect(await suppressionService.isSuppressed(merchantId, phone, 'PHONE')).toBe(true);

    await suppressionService.removeSuppression(merchantId, phone, 'PHONE');
    expect(await suppressionService.isSuppressed(merchantId, phone, 'PHONE')).toBe(false);
  });
});
