import { test, expect } from '@playwright/test';

test.describe('PayBack AI — Sound Design on Live Recovery Runner', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header');

    // Switch to Live Runner tab
    await page.getByRole('button', { name: /Live Recovery Runner/i }).click();
    await page.waitForSelector('[data-testid="toggle-sound-btn"]');
  });

  test('sound toggle starts muted by default and flips state on user interaction', async ({ page }) => {
    // 1. Locate sound toggle button
    const soundBtn = page.getByTestId('toggle-sound-btn');
    await expect(soundBtn).toBeVisible();

    // 2. Starts muted by default
    await expect(soundBtn).toContainText(/Sound: Muted/i);

    // 3. Click to unmute
    await soundBtn.click();
    await expect(soundBtn).toContainText(/Sound: On/i);

    // 4. Click to mute again
    await soundBtn.click();
    await expect(soundBtn).toContainText(/Sound: Muted/i);
  });
});
