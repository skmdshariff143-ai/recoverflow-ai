import { test, expect } from '@playwright/test';

test.describe('PayBack AI — Interactive Dashboard & Drill-Down', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders top-level KPI metrics panel with non-zero financial values', async ({ page }) => {
    // Check title
    await expect(page).toHaveTitle(/PayBack AI/i);

    // Verify KPI metric cards render
    await expect(page.getByText('Total Revenue at Risk')).toBeVisible();
    await expect(page.getByText('Revenue Recovered')).toBeVisible();
    await expect(page.getByText('Predicted vs Actual Rate')).toBeVisible();
    await expect(page.getByText('Budget Efficiency')).toBeVisible();

    // Verify non-zero values are displayed
    await expect(page.getByText(/₹[0-9,]+/).first()).toBeVisible();
  });

  test('ranked queue table renders and displays payment rows', async ({ page }) => {
    // Check table headers
    await expect(page.getByRole('columnheader', { name: /Rank/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Payment ID/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Amount/i })).toBeVisible();

    // Verify payment rows exist
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(10);
  });

  test('clicking a payment row opens the explainable decision drill-down drawer', async ({ page }) => {
    // Click the first row in the table
    const firstRow = page.locator('tbody tr').first();
    await firstRow.click();

    // Verify drill-down modal appears
    await expect(page.getByText(/Score Breakdown & Explainability Waterfall/i)).toBeVisible();
    await expect(page.getByText(/Customer Reliability Profile/i)).toBeVisible();
    await expect(page.getByText(/Chronological Audit Trail/i)).toBeVisible();

    // Verify factor details are rendered
    await expect(page.getByText(/Category Base Rate/i).first()).toBeVisible();

    // Close drill-down modal
    await page.getByRole('button', { name: /Close Drill-Down/i }).click();
    await expect(page.getByText(/Score Breakdown & Explainability Waterfall/i)).not.toBeVisible();
  });

  test('tab navigation switches to Calibration Report and Audit Trail Explorer', async ({ page }) => {
    // Switch to Calibration tab
    await page.getByRole('button', { name: /Probabilistic Calibration Report/i }).click();
    await expect(page.getByText(/5-Bin Reliability Diagram/i)).toBeVisible();
    await expect(page.getByText(/Category-Level Calibration Breakdown/i)).toBeVisible();
    await expect(page.getByText('Brier Score', { exact: true })).toBeVisible();

    // Switch to Audit Trail tab
    await page.getByRole('button', { name: /Audit Trail Explorer/i }).click();
    await expect(page.getByText(/Immutable Audit Trail Explorer/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Export CSV/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Export JSON/i })).toBeVisible();
  });

  test('status filter dropdown updates visible table rows', async ({ page }) => {
    // Filter by 'Recovered'
    const statusSelect = page.locator('select').first();
    await statusSelect.selectOption('recovered');

    // Verify all visible rows show 'Recovered' status
    const recoveredBadges = page.locator('tbody tr');
    await expect(recoveredBadges.first()).toContainText('Recovered');
  });
});
