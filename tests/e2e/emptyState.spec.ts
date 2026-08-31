import { test, expect } from '@playwright/test';

test.describe('PayBack AI — Deliberate Empty & Filter Clear States', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header');
    await page.waitForSelector('[data-testid="queue-row"]');
  });

  test('filter combination matching zero records shows designed empty state, clear-filters restores full queue', async ({ page }) => {
    // Initial state: queue rows exist
    const rows = page.locator('[data-testid="queue-row"]');
    const initialCount = await rows.count();
    expect(initialCount).toBeGreaterThanOrEqual(10);

    // Type a query guaranteed to match zero records
    const searchInput = page.getByPlaceholder(/Search ID, customer, error/i);
    await searchInput.fill('non_existent_payment_query_xyz_999');

    // Designed empty state should be visible
    await expect(page.getByTestId('empty-queue-state')).toBeVisible();
    await expect(page.getByText(/No payments match your filters/i)).toBeVisible();
    await expect(page.getByTestId('clear-filters-btn')).toBeVisible();

    // Click "Clear All Filters" button
    await page.getByTestId('clear-filters-btn').click();

    // Queue rows should be restored
    await expect(page.getByTestId('empty-queue-state')).not.toBeVisible();
    const restoredCount = await rows.count();
    expect(restoredCount).toBe(initialCount);
  });
});
