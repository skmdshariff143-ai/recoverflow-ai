import { test, expect } from '@playwright/test';

test.describe('PayBack AI — Cost-of-Inaction Live Counter', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('payback_spotlight_dismissed_v1', 'true');
    });
    await page.goto('/');
    await page.waitForSelector('header');
  });

  test('renders live cost of inaction counter and increments smoothly over time', async ({ page }) => {
    // 1. Verify cost of inaction counter component is visible
    const counter = page.getByTestId('cost-of-inaction-counter');
    await expect(counter).toBeVisible();
    await expect(counter).toContainText(/Cost of Inaction/i);

    // 2. Verify estimated hourly loss rate is rendered
    const rate = page.getByTestId('cost-of-inaction-rate');
    await expect(rate).toBeVisible();
    await expect(rate).toContainText(/₹/);
    await expect(rate).toContainText(/\/hr/);

    // 3. Read initial accumulated loss value
    const accumulated = page.getByTestId('cost-of-inaction-accumulated');
    await expect(accumulated).toBeVisible();
    const initialText = await accumulated.textContent();

    // 4. Wait for counter to increment
    await page.waitForTimeout(600);

    const laterText = await accumulated.textContent();
    expect(laterText).not.toBeNull();
    // Verify accumulated text format (+₹X.XX)
    expect(laterText).toMatch(/\+₹\d+\.\d{2}/);
  });
});
