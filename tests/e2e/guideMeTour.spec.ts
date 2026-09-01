import { test, expect } from '@playwright/test';

test.describe('PayBack AI — Self-Playing Guided Tour Mode ("Guide Me")', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header');

    // Dismiss first-time spotlight if present so it doesn't overlap
    const skipSpotlight = page.getByTestId('skip-spotlight-btn');
    if (await skipSpotlight.isVisible()) {
      await skipSpotlight.click();
    }
  });

  test('activating Guide Me opens tour, steps through multiple highlights, toggles auto-play, and exits cleanly', async ({ page }) => {
    // 1. Click "Guide Me" button in header
    const guideBtn = page.getByTestId('open-guide-tour-btn');
    await expect(guideBtn).toBeVisible();
    await guideBtn.click();

    // 2. Verify tour modal appears
    const tourModal = page.getByTestId('guide-me-tour-modal');
    await expect(tourModal).toBeVisible();

    const caption = page.getByTestId('guide-tour-caption');
    await expect(caption).toBeVisible();
    await expect(caption).toContainText(/composite trust index/i);

    // 3. Step forward to Step 2 (Logistic Calibration)
    const nextBtn = page.getByTestId('next-tour-step-btn');
    await nextBtn.click();
    await expect(caption).toContainText(/logistic probability/i);

    // 4. Step forward to Step 3 (Reliability Diagram)
    await nextBtn.click();
    await expect(caption).toContainText(/Reliability/i);

    // 5. Toggle auto-play pause / resume
    const autoplayToggle = page.getByTestId('toggle-tour-autoplay-btn');
    await expect(autoplayToggle).toContainText(/Pause/i);
    await autoplayToggle.click();
    await expect(autoplayToggle).toContainText(/Auto-Play/i);

    // 6. Exit tour
    const exitBtn = page.getByTestId('exit-guide-tour-btn');
    await exitBtn.click();
    await expect(tourModal).not.toBeVisible();
  });
});
