import { test, expect } from '@playwright/test';

test.describe('PayBack AI — Command Palette (Cmd/Ctrl+K)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header');
  });

  test('opens with Ctrl+K, searches payment_id, selects to open drill-down', async ({ page }) => {
    // Command palette should not be visible initially
    await expect(page.getByTestId('command-palette')).not.toBeVisible();

    // Open via keyboard shortcut
    await page.keyboard.press('Control+k');
    await expect(page.getByTestId('command-palette')).toBeVisible();
    await expect(page.getByTestId('command-palette-input')).toBeFocused();

    // Search for a payment ID
    await page.getByTestId('command-palette-input').fill('pay_0000');
    await page.waitForTimeout(100);

    // Results should contain payment items
    const items = page.getByTestId('command-palette-item');
    await expect(items.first()).toBeVisible();

    // Select the first result with Enter
    await page.keyboard.press('Enter');

    // Command palette should close
    await expect(page.getByTestId('command-palette')).not.toBeVisible();

    // Drill-down modal should appear
    await expect(page.getByText(/Deterministic Scoring Waterfall/i)).toBeVisible();
  });

  test('navigates tabs via command palette', async ({ page }) => {
    // Open palette
    await page.keyboard.press('Control+k');
    await expect(page.getByTestId('command-palette')).toBeVisible();

    // Type "Evaluation"
    await page.getByTestId('command-palette-input').fill('Evaluation');
    await page.waitForTimeout(100);

    // Select the first match
    await page.keyboard.press('Enter');

    // Should navigate to Evaluation Lab
    await expect(page.getByText(/Comparative Recovery Policy Matrix/i)).toBeVisible();
  });

  test('closes with Escape key', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await expect(page.getByTestId('command-palette')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('command-palette')).not.toBeVisible();
  });

  test('arrow keys navigate results', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await expect(page.getByTestId('command-palette')).toBeVisible();

    // Type something that returns multiple results
    await page.getByTestId('command-palette-input').fill('pay_0000');
    await page.waitForTimeout(100);

    // Arrow down should move selection
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');

    // Second item should now be selected
    const selectedItems = page.locator('[data-selected="true"]');
    await expect(selectedItems).toHaveCount(1);
  });
});
