import { test, expect } from '@playwright/test';

test.describe('PayBack AI — Explainability & Safety Trust Score', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header');
  });

  test('displays trust score gauge and expands to reveal mathematical breakdown components', async ({ page }) => {
    // 1. Verify Trust Score widget is rendered prominently
    const trustCard = page.getByTestId('trust-score-card');
    await expect(trustCard).toBeVisible();
    await expect(trustCard).toContainText(/Explainability & Safety Trust Score/i);
    await expect(trustCard).toContainText(/High Assurance/i);

    // 2. Breakdown is initially hidden
    await expect(page.getByTestId('trust-score-breakdown')).not.toBeVisible();

    // 3. Click "Breakdown" toggle button
    const toggleBtn = page.getByTestId('toggle-trust-breakdown-btn');
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();

    // 4. Verify breakdown components are visible
    const breakdown = page.getByTestId('trust-score-breakdown');
    await expect(breakdown).toBeVisible();
    await expect(breakdown).toContainText(/Model Calibration Accuracy/i);
    await expect(breakdown).toContainText(/Safety Rule Invariants/i);
    await expect(breakdown).toContainText(/Audit Trail Completeness/i);

    // 5. Verify toggle to hide
    await toggleBtn.click();
    await expect(breakdown).not.toBeVisible();
  });
});
