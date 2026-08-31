import { test, expect } from '@playwright/test';

test.describe('PayBack AI — Printable Judge Cheat Sheet Modal & QR Code Reference', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header');
  });

  test('cheat sheet modal opens, contains QR codes, print trigger button, and north-star sentence', async ({ page }) => {
    // 1. Locate and click "Cheat Sheet" button in Header
    const cheatSheetBtn = page.getByTestId('open-cheat-sheet-btn');
    await expect(cheatSheetBtn).toBeVisible();
    await cheatSheetBtn.click();

    // 2. Verify Cheat Sheet modal appears
    const modal = page.getByTestId('judge-cheat-sheet-modal');
    await expect(modal).toBeVisible();

    // 3. Verify North Star sentence is present
    const northStar = page.getByTestId('cheat-sheet-north-star');
    await expect(northStar).toBeVisible();
    await expect(northStar).toContainText(/PayBack AI is the only entry that proves its own calibration is real, not just claimed/i);

    // 4. Verify QR code images are rendered
    const qrCodes = page.getByTestId('qr-code-img');
    await expect(qrCodes).toHaveCount(2);

    // 5. Verify Print / Save PDF button exists
    const printBtn = page.getByTestId('print-cheat-sheet-btn');
    await expect(printBtn).toBeVisible();

    // 6. Close modal
    const closeBtn = page.getByTestId('close-cheat-sheet-btn');
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });
});
