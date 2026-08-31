import { test, expect } from '@playwright/test';

test.describe('PayBack AI — Sticky Mini-Summary Bar', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header');
  });

  test('sticky bar appears after scroll past threshold, disappears when scrolled back to top', async ({ page }) => {
    // Before scrolling, sticky summary bar should not be visible in DOM or detached
    const stickyBar = page.getByTestId('sticky-summary-bar');
    await expect(stickyBar).not.toBeVisible();

    // Scroll down 400px past KPI metrics row
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(200);

    // Sticky bar should now appear
    await expect(stickyBar).toBeVisible();
    await expect(stickyBar).toContainText('PayBack AI');
    await expect(stickyBar).toContainText('At Risk:');
    await expect(stickyBar).toContainText('Recovered:');

    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);

    // Sticky bar should disappear
    await expect(stickyBar).not.toBeVisible();
  });
});
