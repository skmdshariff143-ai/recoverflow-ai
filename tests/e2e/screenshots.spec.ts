import { test } from '@playwright/test';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

test.describe('PayBack AI — Screenshot Generation for Submission', () => {
  test.beforeAll(() => {
    mkdirSync(resolve(process.cwd(), 'docs/screenshots'), { recursive: true });
  });

  test('captures full suite of high-resolution UI screenshots', async ({ page }) => {
    // Set 1080p viewport
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // 1. Dashboard Overview & Ranked Queue
    await page.screenshot({
      path: 'docs/screenshots/01-dashboard-overview.png',
      fullPage: true,
    });

    // 2. Decision Drill-down Modal (Click Rank #1)
    const firstRow = page.locator('tbody tr').first();
    await firstRow.click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: 'docs/screenshots/02-explainable-drilldown.png',
    });

    // Close modal
    await page.getByRole('button', { name: /Close Drill-Down/i }).click();
    await page.waitForTimeout(300);

    // 3. Probabilistic Calibration Visualizer Tab
    await page.getByRole('button', { name: /Probabilistic Calibration Report/i }).click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: 'docs/screenshots/03-calibration-report.png',
      fullPage: true,
    });

    // 4. Immutable Audit Trail Explorer Tab
    await page.getByRole('button', { name: /Audit Trail Explorer/i }).click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: 'docs/screenshots/04-audit-trail-explorer.png',
      fullPage: true,
    });
  });
});
