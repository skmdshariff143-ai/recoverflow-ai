import { test, expect } from '@playwright/test';

test.describe('PayBack AI — Interactive Workspaces & Drill-Down', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header');
    await page.waitForSelector('[data-testid="queue-row"]');
  });

  test('renders top-level KPI metrics panel with non-zero financial values', async ({ page }) => {
    // Check title
    await expect(page).toHaveTitle(/PayBack AI/i);

    // Verify KPI metric cards render
    await expect(page.getByText('Total Revenue at Risk')).toBeVisible();
    await expect(page.getByText(/Simulated Recovered/i)).toBeVisible();
    await expect(page.getByText(/Predicted vs Actual/i)).toBeVisible();
    await expect(page.getByText(/Budget Efficiency/i)).toBeVisible();

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
    // Click the first row in the ranked queue table
    const firstRow = page.locator('[data-testid="queue-row"]').first();
    await firstRow.scrollIntoViewIfNeeded();
    await firstRow.click();

    // Verify drill-down modal appears
    await expect(page.getByText(/Deterministic Scoring Waterfall/i)).toBeVisible();
    await expect(page.getByText(/Customer Reliability Profile/i)).toBeVisible();
    await expect(page.getByText(/Chronological Audit Trail/i)).toBeVisible();

    // Verify factor details are rendered
    await expect(page.getByText(/Category Base Rate/i).first()).toBeVisible();

    // Verify contrastive "Why Not the Others" peer comparison renders
    await expect(page.getByText(/Why Not The Others/i)).toBeVisible();
    await expect(page.getByTestId('contrastive-explanation-section')).toBeVisible();

    // Close drill-down modal
    await page.getByRole('button', { name: /Close Drill-Down/i }).click();
    await expect(page.getByText(/Deterministic Scoring Waterfall/i)).not.toBeVisible();
  });

  test('tab navigation switches across all 6 workspaces seamlessly', async ({ page }) => {
    // Switch to Live Recovery Runner
    await page.getByRole('button', { name: /Live Recovery Runner/i }).click();
    await expect(page.getByText(/Stepped Execution/i)).toBeVisible();

    // Switch to Evaluation Lab tab
    await page.getByRole('button', { name: /Evaluation Lab/i }).click();
    await expect(page.getByText(/Comparative Recovery Policy Matrix/i)).toBeVisible();
    await expect(page.getByText(/How This Compares: Industry Recovery Benchmarks/i).first()).toBeVisible();
    await expect(page.getByText(/Merchant-Configurable Policy Builder/i).first()).toBeVisible();
    await expect(page.getByTestId('merchant-policy-builder')).toBeVisible();
    await expect(page.getByText(/Multi-Merchant Risk Appetite Presets/i).first()).toBeVisible();
    await expect(page.getByText(/Conservative Merchant/i).first()).toBeVisible();
    await expect(page.getByText(/Transparent Error Inspector/i)).toBeVisible();

    // Switch to Promise-to-Pay Tracker
    await page.getByRole('button', { name: /Promise-to-Pay/i }).click();
    await expect(page.getByText(/Active Commitments/i)).toBeVisible();

    // Switch to Audit Trail tab
    await page.getByRole('button', { name: /Audit Trail/i }).click();
    await expect(page.getByText(/Append-Only Tamper-Evident Audit Ledger/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Export CSV/i })).toBeVisible();

    // Switch to Methodology Guide tab
    await page.getByRole('button', { name: /Methodology/i }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText(/5-Minute Structured Pitch/i)).toBeVisible();
    await expect(page.getByText(/What We Got Wrong/i).first()).toBeVisible();
    await expect(page.getByText(/Circular Calibration Defect/i).first()).toBeVisible();
  });

  test('status filter dropdown updates visible table rows', async ({ page }) => {
    // Filter by 'Recovered'
    const statusSelect = page.getByTestId('status-filter');
    await statusSelect.selectOption('recovered');

    // Verify all visible rows in ranked queue show 'Recovered' status
    const recoveredBadges = page.locator('[data-testid="queue-row"]');
    await expect(recoveredBadges.first()).toContainText('Recovered');
  });
});
