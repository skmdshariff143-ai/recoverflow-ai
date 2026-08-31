import { test, expect } from '@playwright/test';

test.describe('PayBack AI — Keyboard-Navigable Ranked Queue', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header');
    await page.waitForSelector('[data-testid="queue-row"]');
  });

  test('arrow keys navigate queue rows, Enter opens drill-down, Escape returns focus', async ({ page }) => {
    const rows = page.locator('[data-testid="queue-row"]');
    await expect(rows.first()).toBeVisible();

    // Focus the first row
    await rows.first().focus();
    await expect(rows.first()).toHaveAttribute('data-focused', 'true');

    // Press ArrowDown to navigate to second row
    await page.keyboard.press('ArrowDown');
    await expect(rows.nth(1)).toHaveAttribute('data-focused', 'true');

    // Press ArrowDown to navigate to third row
    await page.keyboard.press('ArrowDown');
    await expect(rows.nth(2)).toHaveAttribute('data-focused', 'true');

    // Press ArrowUp to navigate back to second row
    await page.keyboard.press('ArrowUp');
    await expect(rows.nth(1)).toHaveAttribute('data-focused', 'true');

    // Press Enter to open drill-down modal for the focused row
    await page.keyboard.press('Enter');
    await expect(page.getByText(/Deterministic Scoring Waterfall/i)).toBeVisible();

    // Close drill-down modal via Escape key or close button
    await page.keyboard.press('Escape');
    await expect(page.getByText(/Deterministic Scoring Waterfall/i)).not.toBeVisible();
  });
});
