import { test, expect } from '@playwright/test';

test.describe('PayBack AI — Regulatory Footprint Compliance Badge', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('payback_spotlight_dismissed_v1', 'true');
    });
    await page.goto('/');
    await page.waitForSelector('header');
  });

  test('renders regulatory footprint badge and reveals code-mapped compliance popover on click', async ({ page }) => {
    // 1. Verify regulatory footprint badge is visible near Trust Score
    const badge = page.getByTestId('regulatory-footprint-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText(/RBI Quiet-Hours · DPDP Opt-Out Enforced/i);

    // 2. Click the badge to open popover
    await badge.click();

    // 3. Verify popover is visible with verified rules count
    const popover = page.getByTestId('regulatory-footprint-popover');
    await expect(popover).toBeVisible();
    await expect(popover).toContainText(/Verified Regulatory Footprint/i);
    await expect(popover).toContainText(/5 Rules Enforced/i);

    // 4. Verify specific verified regulation rules are rendered with file mappings
    const ruleItems = page.getByTestId('compliance-rule-item');
    await expect(ruleItems).toHaveCount(5);

    // Check specific file mappings
    await expect(popover).toContainText('quietHours.ts');
    await expect(popover).toContainText('safetyFilter.ts');
    await expect(popover).toContainText('approvalGate.ts');
    await expect(popover).toContainText('hashChainLedger.ts');
  });
});
