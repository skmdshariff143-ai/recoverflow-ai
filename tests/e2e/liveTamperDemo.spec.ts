import { test, expect } from '@playwright/test';

test.describe('PayBack AI — Live Tamper Demo ("Try to Break It")', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header');

    // Switch to Audit Trail tab
    await page.getByRole('button', { name: /Audit Trail/i }).click();
    await page.waitForSelector('[data-testid="tamper-demo-panel"]');
  });

  test('tampering a record invalidates SHA-256 hash chain and reset restores cryptographic verification', async ({ page }) => {
    // 1. Initial State: Ledger integrity banner is green and verified
    const integrityBanner = page.getByTestId('ledger-integrity-banner');
    await expect(integrityBanner).toBeVisible();
    await expect(integrityBanner).toContainText(/Cryptographic Verification Passed/i);

    // 2. Locate tamper panel elements
    const tamperPanel = page.getByTestId('tamper-demo-panel');
    await expect(tamperPanel).toBeVisible();
    await expect(tamperPanel).toContainText(/Try to Break It/i);

    // 3. Click "Tamper & Verify" button
    const tamperBtn = page.getByTestId('tamper-submit-btn');
    await tamperBtn.click();

    // 4. Verify cryptographic chain breaks: red alert banner & TAMPERED / CHAIN INVALID indicators
    await expect(integrityBanner).toContainText(/INTEGRITY BREACH DETECTED/i);
    await expect(integrityBanner).toContainText(/CHAIN INVALID/i);

    // Verify at least one tampered row is highlighted in red
    const tamperedRows = page.locator('[data-testid="tampered-row"]');
    await expect(tamperedRows.first()).toBeVisible();
    await expect(page.getByText(/HASH BREAK/i).first()).toBeVisible();

    // 5. Verify "Reset Demo" button appears and restores clean state
    const resetBtn = page.getByTestId('tamper-reset-btn');
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();

    // 6. Verify clean state is restored
    await expect(integrityBanner).toContainText(/Cryptographic Verification Passed/i);
    await expect(page.getByTestId('chain-invalid-badge')).not.toBeVisible();
  });
});
