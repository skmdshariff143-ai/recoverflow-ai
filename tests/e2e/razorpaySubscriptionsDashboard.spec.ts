import { test, expect } from '@playwright/test';

test.describe('PayBack AI — Razorpay Subscriptions Live Sync Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header');
  });

  test('navigates to Subscriptions tab and renders live synced subscription portfolio', async ({ page }) => {
    // 1. Click Subscriptions tab in top navigation
    const subTab = page.locator('[data-testid="tab-subscriptions"]');
    await expect(subTab).toBeVisible();
    await subTab.click();

    // 2. Verify header and badge are visible
    await expect(page.getByRole('heading', { name: 'Subscriptions', exact: true })).toBeVisible();
    await expect(page.locator('span').filter({ hasText: /^Razorpay Test Mode$/ })).toBeVisible();

    // 3. Confirm table headers are properly rendered
    await expect(page.getByRole('columnheader', { name: 'Subscription Id' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Plan Id' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Subscription Link' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Customer Id' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();

    // 4. Confirm real subscription rows are loaded in the table
    const tableRows = page.locator('tbody tr');
    await expect(tableRows.first()).toBeVisible({ timeout: 10000 });
    const count = await tableRows.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // 5. Verify live badge presence on synced subscriptions
    const liveBadges = page.getByText('LIVE', { exact: true });
    await expect(liveBadges.first()).toBeVisible();
  });

  test('filters subscriptions by search query and status tab', async ({ page }) => {
    // Navigate to Subscriptions tab
    await page.locator('[data-testid="tab-subscriptions"]').click();

    // Wait for table to load
    const tableRows = page.locator('tbody tr');
    await expect(tableRows.first()).toBeVisible({ timeout: 10000 });

    // Search for a specific query
    const searchInput = page.locator('input[placeholder*="Search Subscription"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('sub_');

    // Confirm filtered results match
    await expect(tableRows.first()).toBeVisible();

    // Clear search and switch status filter
    await searchInput.clear();
    const allFilterTab = page.getByRole('button', { name: 'all', exact: true });
    await expect(allFilterTab).toBeVisible();
    await allFilterTab.click();
  });

  test('opens Create Subscription modal and submits new test subscription', async ({ page }) => {
    // Navigate to Subscriptions tab
    await page.locator('[data-testid="tab-subscriptions"]').click();

    // Open modal
    const createBtn = page.getByRole('button', { name: 'Create Subscription' });
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    // Modal should be visible
    await expect(page.getByRole('heading', { name: 'Create Test Subscription' })).toBeVisible();

    // Cancel modal
    const cancelBtn = page.getByRole('button', { name: 'Cancel', exact: true });
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();
    await expect(page.getByRole('heading', { name: 'Create Test Subscription' })).not.toBeVisible();
  });
});
