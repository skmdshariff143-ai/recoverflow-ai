import { test, expect } from '@playwright/test';

test.describe('PayBack AI — Self-Verifiable Closing Moment (Task 3)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('payback_spotlight_dismissed_v1', 'true');
      localStorage.setItem('payback_guide_completed_v1', 'true');
    });
  });

  test('Audit Trail Explorer provides interactive, judge-operable step and auto-walk verification from genesis to latest', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to Audit Trail tab
    await page.getByTestId('tab-audit-ledger').click();

    // Verify self-verifiable panel is rendered
    const walkPanel = page.getByTestId('verify-ledger-walk-panel');
    await expect(walkPanel).toBeVisible();
    await expect(walkPanel.getByText('SELF-VERIFIABLE PROOF')).toBeVisible();

    // Step verification manually
    const stepBtn = walkPanel.getByTestId('step-ledger-walk-btn');
    await stepBtn.click();

    // Inspector appears showing Block #0
    const inspector = walkPanel.getByTestId('walk-inspector-card');
    await expect(inspector).toBeVisible();
    await expect(inspector.getByText(/Block #0/i)).toBeVisible();
    await expect(inspector.getByText(/SHA-256 MATCH/i)).toBeVisible();

    // Trigger Auto-Walk to verify the full chain
    const autoWalkBtn = walkPanel.getByTestId('auto-ledger-walk-btn');
    await autoWalkBtn.click();

    // Verify completion certificate appears with 100% confirmation
    const completionBadge = walkPanel.getByTestId('walk-completion-badge');
    await expect(completionBadge).toBeVisible({ timeout: 10000 });
    await expect(completionBadge.getByText(/Genesis-to-Latest Cryptographic Proof Confirmed/i)).toBeVisible();
    await expect(walkPanel.getByText(/100% Chain Walk Complete/i)).toBeVisible();
  });
});
