import { test, expect } from '@playwright/test';

test.describe('PayBack AI — Build-History Gallery ("How We Built This")', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('payback_spotlight_dismissed_v1', 'true');
    });
    await page.goto('/');
    await page.waitForSelector('header');
  });

  test('Methodology & Guide tab displays 8 milestone cards in the build-history gallery', async ({ page }) => {
    // 1. Switch to Methodology & Guide tab
    const guideTab = page.getByTestId('tab-guide');
    await expect(guideTab).toBeVisible();
    await guideTab.click();

    // 2. Verify gallery section is visible
    const gallery = page.getByTestId('build-history-gallery');
    await expect(gallery).toBeVisible();
    await expect(gallery).toContainText(/Engineering Build Progression/i);
    await expect(gallery).toContainText(/How We Built This/i);

    // 3. Verify exactly 8 milestone cards exist
    const milestoneCards = page.getByTestId('build-milestone-card');
    await expect(milestoneCards).toHaveCount(8);

    // 4. Verify milestones span M1 through M8
    await expect(milestoneCards.nth(0)).toContainText(/M1 • Architecture/i);
    await expect(milestoneCards.nth(1)).toContainText(/M2 • Calibration/i);
    await expect(milestoneCards.nth(2)).toContainText(/M3 • Safety/i);
    await expect(milestoneCards.nth(3)).toContainText(/M4 • Execution/i);
    await expect(milestoneCards.nth(4)).toContainText(/M5 • Audit/i);
    await expect(milestoneCards.nth(5)).toContainText(/M6 • Workspaces/i);
    await expect(milestoneCards.nth(6)).toContainText(/M7 • UI Polish/i);
    await expect(milestoneCards.nth(7)).toContainText(/M8 • Wow & Tour/i);
  });
});
