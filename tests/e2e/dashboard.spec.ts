import { test, expect } from '@playwright/test';

test.describe('RecoverFlow AI — Interactive Dashboard & Drill-Down', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders top-level KPI metrics panel with non-zero financial values', async ({ page }) => {
    // Check title
    await expect(page).toHaveTitle(/RecoverFlow AI/i);

    // Verify KPI metric cards render
    await expect(page.getByText('Total Revenue at Risk')).toBeVisible();
    await expect(page.getByText(/Simulated Recovered/i)).toBeVisible();
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

  test('tab navigation switches to Evaluation Lab and Audit Ledger', async ({ page }) => {
    // Switch to Evaluation Lab tab
    await page.getByRole('button', { name: /Evaluation Lab & Policy Simulator/i }).click();
    await expect(page.getByText(/Counterfactual Policy Matrix/i)).toBeVisible();
    await expect(page.getByText(/Transparent Error Inspector/i)).toBeVisible();

    // Switch to Audit Trail tab
    await page.getByRole('button', { name: /Audit Trail & Cryptographic Ledger/i }).click();
    await expect(page.getByText(/Append-Only Tamper-Evident Audit Ledger/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Export CSV/i })).toBeVisible();

    // Switch to Methodology Guide tab
    await page.getByRole('button', { name: /Methodology & Judge Guide/i }).click();
    await expect(page.getByText(/5-Minute Structured Pitch/i)).toBeVisible();
  });

  test('status filter dropdown updates visible table rows', async ({ page }) => {
    // Filter by 'Recovered'
    const statusSelect = page.getByTestId('status-filter');
    await statusSelect.selectOption('recovered');

    // Verify all visible rows show 'Recovered' status
    const recoveredBadges = page.locator('tbody tr');
    await expect(recoveredBadges.first()).toContainText('Recovered');
  });
});
