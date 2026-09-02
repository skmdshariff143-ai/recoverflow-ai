import { test, expect } from '@playwright/test';

test.describe('PayBack AI — Command Center Visual Hierarchy & Tamper CTA (Tasks 1 & 2)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('payback_spotlight_dismissed_v1', 'true');
      localStorage.setItem('payback_guide_completed_v1', 'true');
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Ranked Queue Table is visually dominant on initial load, leading directly to payment drill-down', async ({ page }) => {
    // 1. Verify Ranked Queue is mounted and labeled as PRIMARY WORKSPACE
    const queueWorkspace = page.getByTestId('ranked-queue-workspace');
    await expect(queueWorkspace).toBeVisible();
    await expect(queueWorkspace.getByText('PRIMARY WORKSPACE')).toBeVisible();
    await expect(queueWorkspace.getByText(/Prioritized Recovery Queue/i)).toBeVisible();

    // 2. Click a payment row directly
    const firstRow = queueWorkspace.locator('tbody tr').first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();

    // 3. Verify Payment Drill-Down Drawer opens cleanly
    await expect(page.getByText('Recovery Journey')).toBeVisible();
    await expect(page.getByText(/Category Base Rate/i)).toBeVisible();

    // Close drawer
    const closeBtn = page.locator('button[aria-label="Close modal"]').or(page.getByRole('button', { name: /Close/i })).first();
    await closeBtn.click();
    await page.waitForTimeout(300);
  });

  test('Prominent "Try to Break It" CTA on Command Center navigates directly to live tamper demo', async ({ page }) => {
    // 1. Verify "Try to Break It" CTA exists on the Command Center Trust Score widget
    const tamperCTA = page.getByTestId('jump-to-tamper-demo-btn');
    await expect(tamperCTA).toBeVisible();
    await expect(tamperCTA).toContainText(/Try to Break It/i);

    // 2. Click the CTA
    await tamperCTA.click();

    // 3. Verify page navigated to Audit Ledger tab with Live Tamper Demo and Integrity Banner
    await expect(page.getByTestId('tamper-submit-btn')).toBeVisible();
    const integrityBanner = page.getByTestId('ledger-integrity-banner');
    await expect(integrityBanner).toBeVisible();
    await expect(integrityBanner).toContainText(/Cryptographic Verification Passed/i);
  });

  test('Supporting architectural sections (Control Room and Calibration) remain accessible on Command Center', async ({ page }) => {
    // Both supporting sections exist and function
    await expect(page.getByTestId('autonomous-control-room')).toBeVisible();
    const toggleCalib = page.getByTestId('toggle-calibration-detail-btn');
    await expect(toggleCalib).toBeVisible();
    
    // Toggle calibration detail
    await toggleCalib.click();
    await expect(page.getByTestId('calibration-detail-section')).toBeVisible();
  });
});
