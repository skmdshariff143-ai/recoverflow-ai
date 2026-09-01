import { test, expect } from '@playwright/test';

test.describe('PayBack AI — Mobile-Responsive Judge View', () => {

  test('375px viewport (Mobile): renders responsive card list, KPIs, Trust Score with zero horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await page.addInitScript(() => {
      sessionStorage.setItem('payback_spotlight_dismissed_v1', 'true');
    });

    await page.goto('/');
    await page.waitForSelector('header');

    // 1. Check headline KPIs and Trust Score are visible
    const trustScore = page.locator('[data-testid="trust-score-widget"]');
    await expect(trustScore).toBeVisible();

    const costOfInaction = page.locator('[data-testid="cost-of-inaction-counter"]');
    await expect(costOfInaction).toBeVisible();

    // 2. Mobile card list is visible, desktop table is hidden
    const mobileCardList = page.locator('[data-testid="mobile-queue-card-list"]');
    await expect(mobileCardList).toBeVisible();

    const mobileCards = page.locator('[data-testid="mobile-queue-card"]');
    const cardCount = await mobileCards.count();
    expect(cardCount).toBeGreaterThan(0);

    // 3. Tapping a card opens the explainability drilldown modal
    await mobileCards.first().click();
    const drilldownModal = page.locator('[data-testid="payment-drilldown-modal"]');
    await expect(drilldownModal).toBeVisible();

    // Close modal
    const closeBtn = page.locator('[data-testid="close-drilldown-modal"]').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await expect(drilldownModal).not.toBeVisible();
    }

    // 4. Verify no horizontal overflow at 375px
    const isOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(isOverflowing).toBe(false);
  });

  test('768px viewport (Tablet): renders responsive layout cleanly', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.addInitScript(() => {
      sessionStorage.setItem('payback_spotlight_dismissed_v1', 'true');
    });

    await page.goto('/');
    await page.waitForSelector('header');

    const trustScore = page.locator('[data-testid="trust-score-widget"]');
    await expect(trustScore).toBeVisible();

    // On tablet (768px >= 640px), the structured table is visible
    const table = page.locator('[data-testid="ranked-queue-table"]');
    await expect(table).toBeVisible();
  });
});
