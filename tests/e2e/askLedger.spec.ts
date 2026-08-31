import { test, expect } from '@playwright/test';

test.describe('PayBack AI — "Ask the Ledger" Natural Language Query', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header');

    // Switch to Audit Trail tab
    await page.getByRole('button', { name: /Audit Trail/i }).click();
    await page.waitForSelector('[data-testid="ask-ledger-panel"]');
  });

  test('submitting a natural language query produces a grounded response citing real audit records', async ({ page }) => {
    // 1. Verify Ask the Ledger panel is visible
    const panel = page.getByTestId('ask-ledger-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(/Ask the Ledger/i);

    // 2. Type query into input
    const input = page.getByTestId('ask-ledger-input');
    await input.fill('Which payments had quiet-hours delays?');

    // 3. Submit query
    const submitBtn = page.getByTestId('ask-ledger-submit-btn');
    await submitBtn.click();

    // 4. Verify grounded response card appears
    const responseCard = page.getByTestId('ask-ledger-response');
    await expect(responseCard).toBeVisible();
    await expect(responseCard).toContainText(/quiet-hours/i);
    await expect(responseCard).toContainText(/Verified Citations/i);
    await expect(responseCard).toContainText(/Record #/i);
  });
});
