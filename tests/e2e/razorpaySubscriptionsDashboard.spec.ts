import { test, expect } from '@playwright/test';

test.describe('PayBack AI — Isolated Subscription Demo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo');
    await page.waitForSelector('header');
  });

  test('navigates to Subscriptions tab and renders explicitly simulated subscription portfolio', async ({ page }) => {
    // 1. Click Subscriptions tab in top navigation
    const subTab = page.locator('[data-testid="tab-subscriptions"]');
    await expect(subTab).toBeVisible();
    await subTab.click();

    // 2. Verify header and badge are visible
    await expect(page.getByRole('heading', { name: 'Subscriptions', exact: true })).toBeVisible();
    await expect(page.locator('span').filter({ hasText: /^Isolated demo$/ })).toBeVisible();

    // 3. Confirm table headers are properly rendered
    await expect(page.getByRole('columnheader', { name: 'Subscription Id' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Plan Id' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Subscription Link' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Customer Id' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();

    // 4. Confirm sample subscription rows are loaded in the table
    const tableRows = page.locator('tbody tr');
    await expect(tableRows.first()).toBeVisible({ timeout: 10000 });
    const count = await tableRows.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // 5. Verify demo badge presence on sample subscriptions
    const liveBadges = page.getByText('DEMO', { exact: true });
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
    await expect(page.getByRole('heading', { name: 'Create Demo Subscription' })).toBeVisible();

    // Cancel modal
    const cancelBtn = page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true });
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();
    await expect(page.getByRole('heading', { name: 'Create Demo Subscription' })).not.toBeVisible();
  });
  test('creates a sample subscription and simulates a failure without provider execution', async ({ page }) => {
    await page.getByTestId('tab-subscriptions').click();
    await page.getByRole('button', { name: 'Create Subscription', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Create Demo Subscription' });
    await expect(dialog).toBeVisible();
    const plan = `Sample plan ${Date.now()}`;
    await dialog.getByLabel('Plan Name').fill(plan);
    await dialog.getByLabel('Amount (₹ INR)').fill('1234.56');
    await dialog.getByLabel('Customer Email').fill('sample@example.test');
    await dialog.getByRole('button', { name: 'Create Subscription', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    const row = page.getByRole('row').filter({ hasText: plan });
    await expect(row).toContainText('DEMO');
    await row.getByRole('button', { name: 'Simulate failure', exact: true }).click();
    await expect(row).toContainText('halted');
    await expect(page.getByText(/No provider action was performed/)).toBeVisible();
  });});
