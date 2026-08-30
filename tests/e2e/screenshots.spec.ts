import { test } from '@playwright/test';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

test.describe('RecoverFlow AI — Screenshot Generation for Submission', () => {
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

    // 3. Evaluation Lab & Counterfactual Policy Simulator
    await page.getByRole('button', { name: /Evaluation Lab & Policy Simulator/i }).click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: 'docs/screenshots/03-evaluation-lab.png',
      fullPage: true,
    });

    // 4. Audit Trail & Cryptographic Ledger
    await page.getByRole('button', { name: /Audit Trail & Cryptographic Ledger/i }).click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: 'docs/screenshots/04-audit-trail-ledger.png',
      fullPage: true,
    });

    // 5. Methodology & Judge Guide
    await page.getByRole('button', { name: /Methodology & Judge Guide/i }).click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: 'docs/screenshots/05-methodology-guide.png',
      fullPage: true,
    });
  });
});
