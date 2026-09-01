import { test, expect } from '@playwright/test';

test.describe('PayBack AI — Collapsible Calibration Detail on Command Center', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header');

    // Dismiss spotlight if present
    const skipSpotlight = page.getByTestId('skip-spotlight-btn');
    if (await skipSpotlight.isVisible()) {
      await skipSpotlight.click();
    }
  });

  test('calibration detail tables start collapsed by default and toggle expand/collapse on click', async ({ page }) => {
    // 1. Verify toggle button is visible
    const toggleBtn = page.getByTestId('toggle-calibration-detail-btn');
    await expect(toggleBtn).toBeVisible();
    await expect(toggleBtn).toContainText(/Show Full Calibration Detail/i);

    // 2. Verify detail section is NOT visible on initial load
    const detailSection = page.getByTestId('calibration-detail-section');
    await expect(detailSection).not.toBeVisible();

    // 3. Click to expand
    await toggleBtn.click();
    await expect(detailSection).toBeVisible();
    await expect(toggleBtn).toContainText(/Hide Full Calibration Detail/i);
    await expect(detailSection).toContainText(/5-Bin Probability Reliability Diagram/i);
    await expect(detailSection).toContainText(/Category-Level Calibration Breakdown/i);

    // 4. Click to collapse again
    await toggleBtn.click();
    await expect(detailSection).not.toBeVisible();
    await expect(toggleBtn).toContainText(/Show Full Calibration Detail/i);
  });
});
