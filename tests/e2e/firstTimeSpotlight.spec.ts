import { test, expect } from '@playwright/test';

test.describe('PayBack AI — First-Time Visitor Spotlight Sequence', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header');
  });

  test('spotlight appears on first visit, steps through tooltips, and does not appear after dismissal in same session', async ({ page }) => {
    // 1. Verify spotlight overlay is rendered on first load
    const overlay = page.getByTestId('spotlight-overlay');
    await expect(overlay).toBeVisible();

    const caption = page.getByTestId('spotlight-caption');
    await expect(caption).toContainText(/Cmd\/Ctrl\+K/i);

    // 2. Click "Next" to advance to Step 2 (Judge Mode)
    const nextBtn = page.getByTestId('next-spotlight-btn');
    await nextBtn.click();
    await expect(caption).toContainText(/Judge Mode/i);

    // 3. Click "Next" to advance to Step 3 (Trust Score)
    await nextBtn.click();
    await expect(caption).toContainText(/Trust Score/i);

    // 4. Click "Got it!" to finish tour
    await nextBtn.click();
    await expect(overlay).not.toBeVisible();

    // 5. Reload page in the same session context: verify it remains dismissed
    await page.reload();
    await page.waitForSelector('header');

    // Wait a brief moment to ensure timer doesn't pop it up
    await page.waitForTimeout(500);
    await expect(page.getByTestId('spotlight-overlay')).not.toBeVisible();
  });

  test('spotlight can be immediately dismissed with Skip button', async ({ page }) => {
    const overlay = page.getByTestId('spotlight-overlay');
    await expect(overlay).toBeVisible();

    const skipBtn = page.getByTestId('skip-spotlight-btn');
    await skipBtn.click();
    await expect(overlay).not.toBeVisible();
  });
});
