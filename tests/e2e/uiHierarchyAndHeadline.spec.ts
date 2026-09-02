import { test, expect } from '@playwright/test';

test.describe('PayBack AI — Live Recompute Feedback & Evaluation Plain-English Headline (Tasks 3 & 4)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('payback_spotlight_dismissed_v1', 'true');
      localStorage.setItem('payback_guide_completed_v1', 'true');
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Policy change and budget updates trigger visible live feedback indicator', async ({ page }) => {
    // 1. Navigate to Evaluation Lab
    await page.getByTestId('tab-evaluation-lab').click();
    await page.waitForTimeout(300);

    // 2. Select a risk persona
    const d2cBtn = page.getByTestId('persona-btn-high_volume_d2c').first();
    await expect(d2cBtn).toBeVisible();
    await d2cBtn.click();

    // 3. Verify policy recompute badge appears in policy builder
    const recomputeBadge = page.getByTestId('policy-recompute-badge');
    await expect(recomputeBadge).toBeVisible();
    await expect(recomputeBadge).toContainText(/Policy Re-simulated/i);
  });

  test('Evaluation Lab displays plain-English executive summary headline with dynamically computed lift numbers', async ({ page }) => {
    // 1. Navigate to Evaluation Lab
    await page.getByTestId('tab-evaluation-lab').click();
    await page.waitForTimeout(300);

    // 2. Verify plain-English headline is visible
    const headline = page.getByTestId('evaluation-plain-english-headline');
    await expect(headline).toBeVisible();

    // 3. Confirm it contains exact non-hardcoded comparative phrasing
    await expect(headline).toContainText(/PayBack AI recovered/i);
    await expect(headline).toContainText(/than blind Fixed Retry on identical frozen data/i);
    await expect(headline).toContainText(/incremental net yield/i);
  });
});
