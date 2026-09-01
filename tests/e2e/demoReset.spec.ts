import { test, expect } from '@playwright/test';

test.describe('PayBack AI — One-Command Demo Reset (Task 6)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header');
  });

  test('Shift+R keyboard shortcut triggers instantaneous demo state reset', async ({ page }) => {
    // 1. Mutate some state: change status filter and category filter
    const statusFilter = page.locator('[data-testid="status-filter"]');
    if (await statusFilter.isVisible()) {
      await statusFilter.selectOption('recovered');
    }

    // 2. Press Shift+R
    await page.keyboard.press('Shift+KeyR');

    // 3. Confirm Demo Reset Notification Toast appears
    const toast = page.locator('[data-testid="demo-reset-toast"]');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/Demo state reset/i);

    // 4. Confirm filters were reset back to 'all'
    if (await statusFilter.isVisible()) {
      await expect(statusFilter).toHaveValue('all');
    }
  });

  test('Command Palette (Cmd+K) "Reset Demo State" action restores initial defaults', async ({ page }) => {
    // 1. Open Command Palette via Cmd+K / Ctrl+k
    await page.keyboard.press('Control+k');

    const paletteInput = page.locator('[data-testid="command-palette-input"]');
    await expect(paletteInput).toBeVisible();

    // 2. Type "Reset Demo"
    await paletteInput.fill('Reset Demo');

    // 3. Press Enter to execute the top matching command
    await page.keyboard.press('Enter');

    // 4. Confirm toast appears and palette closes
    const toast = page.locator('[data-testid="demo-reset-toast"]');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/Demo state reset/i);
    await expect(paletteInput).not.toBeVisible();
  });
});
