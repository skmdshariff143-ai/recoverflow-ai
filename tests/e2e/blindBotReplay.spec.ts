import { test, expect } from '@playwright/test';

test.describe('PayBack AI — Blind-Bot vs PayBack AI Replay Arena', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header');
  });

  test('opens replay modal, runs or skips to completion, flags naive bot safety violations and shows final scorecard', async ({ page }) => {
    // 1. Open Replay Arena via header button
    const replayBtn = page.getByTestId('open-replay-arena-btn');
    await expect(replayBtn).toBeVisible();
    await replayBtn.click();

    // 2. Verify Replay Arena Modal is visible
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/Blind-Bot vs PayBack AI/i)).toBeVisible();

    // 3. Verify naive violations are flagged on the left
    const violationBadge = page.locator('[data-testid="naive-violation-badge"]');
    await expect(violationBadge.first()).toBeVisible();
    await expect(violationBadge.first()).toContainText(/CRITICAL|WASTED/i);

    // 4. Click "Skip to Scorecard"
    const skipBtn = page.getByTestId('skip-replay-btn');
    await expect(skipBtn).toBeVisible();
    await skipBtn.click();

    // 5. Verify final head-to-head scorecard displays
    const scorecard = page.getByTestId('replay-final-scorecard');
    await expect(scorecard).toBeVisible();
    await expect(scorecard).toContainText(/Final Head-to-Head Outcome Scorecard/i);
    await expect(scorecard).toContainText(/0 Violations/i);
    await expect(scorecard).toContainText(/3 Critical Breaches/i);

    // 6. Close Modal
    await page.getByTestId('close-replay-modal').click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});
