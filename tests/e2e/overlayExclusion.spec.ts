import { test, expect } from '@playwright/test';

test.describe('PayBack AI — Overlay Mutual Exclusion & Centered Compliance Modal', () => {

  test('spotlight is suppressed when Regulatory Footprint modal opens, and only the modal is visible', async ({ page }) => {
    // 1. Fresh page load without dismissed spotlight
    await page.goto('/');
    await page.waitForSelector('header');

    // 2. Wait for First-Time Visitor Spotlight to appear
    const spotlightOverlay = page.getByTestId('spotlight-overlay');
    await expect(spotlightOverlay).toBeVisible({ timeout: 5000 });

    // 3. Click the Regulatory Footprint badge in Trust Score card
    const badge = page.getByTestId('regulatory-footprint-badge');
    await expect(badge).toBeVisible();
    await badge.click();

    // 4. Verify Regulatory Footprint modal is open
    const modal = page.getByTestId('regulatory-footprint-popover');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(/Verified Regulatory Footprint/i);
    await expect(modal).toContainText(/5 Rules Enforced/i);

    // 5. CRITICAL ASSERTION: Spotlight overlay MUST be suppressed / not visible while modal is open
    await expect(spotlightOverlay).not.toBeVisible();

    // 6. Verify centered modal layout and rules count
    const ruleItems = page.getByTestId('compliance-rule-item');
    await expect(ruleItems).toHaveCount(5);

    // Capture visual screenshot of the clean centered modal
    await page.screenshot({ path: 'test-results/regulatory-footprint-modal-clean.png', fullPage: false });

    // 7. Close the modal via its close button
    const closeBtn = modal.getByRole('button', { name: /close/i });
    await closeBtn.click();
    await expect(modal).not.toBeVisible();

    // 8. Spotlight should re-appear since it was not explicitly dismissed
    await expect(spotlightOverlay).toBeVisible();
  });

  test('opening Regulatory Footprint modal before spotlight fires prevents spotlight from stacking on top', async ({ page }) => {
    // 1. Fresh page load
    await page.goto('/');
    await page.waitForSelector('header');

    // 2. Immediately click Regulatory Footprint badge
    const badge = page.getByTestId('regulatory-footprint-badge');
    await expect(badge).toBeVisible();
    await badge.click();

    const modal = page.getByTestId('regulatory-footprint-popover');
    await expect(modal).toBeVisible();

    // 3. Wait past the spotlight mount delay (300ms + buffer)
    await page.waitForTimeout(600);

    // 4. Assert spotlight is NOT visible while modal is active
    const spotlightOverlay = page.getByTestId('spotlight-overlay');
    await expect(spotlightOverlay).not.toBeVisible();

    // 5. Press Escape to close modal
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();

    // 6. Now spotlight can appear cleanly
    await expect(spotlightOverlay).toBeVisible();
  });

  test('opening Command Palette (Cmd/Ctrl+K) suppresses spotlight', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header');

    const spotlightOverlay = page.getByTestId('spotlight-overlay');
    await expect(spotlightOverlay).toBeVisible({ timeout: 5000 });

    // Trigger Command Palette
    await page.keyboard.press('Control+k');
    const commandPalette = page.getByTestId('command-palette');
    await expect(commandPalette).toBeVisible();

    // Spotlight must be suppressed
    await expect(spotlightOverlay).not.toBeVisible();

    // Close command palette
    await page.keyboard.press('Escape');
    await expect(commandPalette).not.toBeVisible();

    // Spotlight resumes
    await expect(spotlightOverlay).toBeVisible();
  });

  test('opening Judge Mode modal suppresses spotlight', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header');

    const spotlightOverlay = page.getByTestId('spotlight-overlay');
    await expect(spotlightOverlay).toBeVisible({ timeout: 5000 });

    // Click Judge Mode button
    const judgeBtn = page.getByRole('button', { name: /judge mode/i });
    await judgeBtn.click();

    const judgeModal = page.getByRole('dialog').filter({ hasText: /Judge Mode/i });
    await expect(judgeModal).toBeVisible();

    // Spotlight must be suppressed
    await expect(spotlightOverlay).not.toBeVisible();

    // Close Judge Mode modal
    const closeBtn = judgeModal.getByRole('button', { name: /close/i });
    await closeBtn.click();
    await expect(judgeModal).not.toBeVisible();

    // Spotlight resumes
    await expect(spotlightOverlay).toBeVisible();
  });
});
