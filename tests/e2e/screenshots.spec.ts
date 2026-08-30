import { test } from '@playwright/test';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

test.describe('RecoverFlow AI — Multi-Viewport & Screenshot Verification', () => {
  test.beforeAll(() => {
    mkdirSync(resolve(process.cwd(), 'docs/screenshots'), { recursive: true });
  });

  const VIEWPORTS = [
    { name: 'desktop-large', width: 1440, height: 900 },
    { name: 'laptop', width: 1280, height: 800 },
    { name: 'tablet-landscape', width: 1024, height: 768 },
    { name: 'tablet-portrait', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 },
  ];

  for (const vp of VIEWPORTS) {
    test(`renders responsive layout cleanly on ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');

      // Verify core elements exist without fatal overflow
      await page.waitForSelector('header');
      await page.waitForSelector('main');

      if (vp.name === 'desktop-large') {
        // Capture submission screenshots
        await page.screenshot({
          path: 'docs/screenshots/01-dashboard-overview.png',
          fullPage: true,
        });

        // Drilldown
        const firstRow = page.locator('[data-testid="queue-row"]').first();
        await firstRow.click();
        await page.waitForTimeout(400);
        await page.screenshot({
          path: 'docs/screenshots/02-explainable-drilldown.png',
        });
        const closeBtn = page.getByRole('button', { name: /Close Drill-Down/i }).or(page.locator('button[aria-label="Close modal"]'));
        await closeBtn.first().click();
        await page.waitForTimeout(300);

        // Evaluation Lab
        await page.getByRole('button', { name: /Evaluation Lab/i }).click();
        await page.waitForTimeout(400);
        await page.screenshot({
          path: 'docs/screenshots/03-evaluation-lab.png',
          fullPage: true,
        });

        // Audit Trail
        await page.getByRole('button', { name: /Audit Trail/i }).click();
        await page.waitForTimeout(400);
        await page.screenshot({
          path: 'docs/screenshots/04-audit-trail-ledger.png',
          fullPage: true,
        });

        // Live Runner
        await page.getByRole('button', { name: /Live Recovery Runner/i }).click();
        await page.waitForTimeout(400);
        await page.screenshot({
          path: 'docs/screenshots/05-live-runner.png',
          fullPage: true,
        });
      }
    });
  }
});
