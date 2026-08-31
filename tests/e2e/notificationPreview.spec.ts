import { test, expect } from '@playwright/test';

test.describe('PayBack AI — Notification Preview in Drill-Down', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header');
  });

  test('opening drill-down displays non-empty, PII-masked notification preview', async ({ page }) => {
    // Click the first row in ranked queue table
    const firstRow = page.locator('[data-testid="queue-row"]').first();
    await firstRow.click();

    // Verify drill-down is open
    await expect(page.getByText(/Deterministic Scoring Waterfall/i)).toBeVisible();

    // Verify PII-masked notification preview card exists
    await expect(page.getByTestId('notification-preview-card')).toBeVisible();
    await expect(page.getByText(/PII-MASKED PREVIEW/i)).toBeVisible();

    // Verify message body is non-empty and has masked customer ID
    const messageBody = page.getByTestId('notification-message-body');
    await expect(messageBody).toBeVisible();
    const text = await messageBody.textContent();
    expect(text).toBeTruthy();
    expect(text?.length).toBeGreaterThan(20);
    // Must contain masked handle
    expect(text).toContain('cust_***');

    // Close drill-down modal
    await page.getByRole('button', { name: /Close Drill-Down/i }).click();
  });
});
