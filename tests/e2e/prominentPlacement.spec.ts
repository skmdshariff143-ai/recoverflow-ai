import { test, expect } from '@playwright/test';

test.describe('PayBack AI — Prominent Placement of Trust Score & Sound Toggle', () => {

  test.use({
    viewport: { width: 1280, height: 800 },
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header');
  });

  test('Trust Score is visible in the initial viewport on Command Center without scrolling', async ({ page }) => {
    const trustScoreCard = page.getByTestId('trust-score-card');
    await expect(trustScoreCard).toBeVisible();

    // Verify it is located within the initial viewport bounds (top < 500px)
    const box = await trustScoreCard.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.y).toBeLessThan(450);
      expect(box.height).toBeGreaterThan(50);
    }

    // Verify breakdown components exist and are visible
    await expect(trustScoreCard).toContainText(/Explainability & Safety Trust Score/i);
    await expect(trustScoreCard).toContainText(/Calibration/i);
    await expect(trustScoreCard).toContainText(/Safety Rules/i);
    await expect(trustScoreCard).toContainText(/Audit Trail/i);
  });

  test('Sound toggle is visible in the initial viewport on Live Recovery Runner tab without scrolling', async ({ page }) => {
    // Navigate to Live Runner tab
    await page.getByRole('button', { name: /Live Recovery Runner/i }).click();
    await page.waitForSelector('[data-testid="toggle-sound-btn"]');

    const soundToggle = page.getByTestId('toggle-sound-btn');
    await expect(soundToggle).toBeVisible();

    // Verify it is located within the initial viewport bounds
    const box = await soundToggle.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.y).toBeLessThan(350);
    }

    // Click toggle to verify interaction
    await expect(soundToggle).toContainText(/Muted/i);
    await soundToggle.click();
    await expect(soundToggle).toContainText(/ON/i);
  });
});
