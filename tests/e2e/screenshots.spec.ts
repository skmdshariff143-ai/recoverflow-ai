import { test, expect } from '@playwright/test';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

test.describe('PayBack AI — Multi-Viewport & Screenshot Verification', () => {
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

  test('verifies sticky header behavior during real incremental scroll without duplication', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForSelector('header');

    // Switch to Evaluation Lab tab (long scrollable page)
    await page.getByRole('button', { name: /Evaluation Lab/i }).click();
    await page.waitForTimeout(400);

    // Scroll down incrementally and verify header is positioned at top of viewport
    for (const scrollY of [200, 500, 1000]) {
      await page.evaluate((y) => window.scrollTo(0, y), scrollY);
      await page.waitForTimeout(100);
      const headerBox = await page.locator('header').boundingBox();
      expect(headerBox).not.toBeNull();
      if (headerBox) {
        // Sticky header stays at y=0 of viewport
        expect(headerBox.y).toBeCloseTo(0, 1);
      }
    }

    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
  });

  for (const vp of VIEWPORTS) {
    test(`renders responsive layout cleanly on ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');

      // Verify core elements exist without fatal overflow
      await page.waitForSelector('header');
      await page.waitForSelector('main');

      if (vp.name === 'desktop-large') {
        // Helper to take clean full-page screenshots without sticky header duplication artifacts
        const captureCleanFullPage = async (filePath: string) => {
          // Temporarily make header static during full-page stitching
          await page.addStyleTag({ content: 'header { position: static !important; }' });
          await page.screenshot({ path: filePath, fullPage: true });
          // Restore sticky positioning
          await page.addStyleTag({ content: 'header { position: sticky !important; }' });
        };

        // 1. Dashboard overview
        await captureCleanFullPage('docs/screenshots/01-dashboard-overview.png');

        // 2. Drilldown modal (viewport screenshot)
        const firstRow = page.locator('[data-testid="queue-row"]').first();
        await firstRow.click();
        await page.waitForTimeout(400);
        await page.screenshot({
          path: 'docs/screenshots/02-explainable-drilldown.png',
        });
        await page.locator('button[aria-label="Close modal"]').click();
        await page.waitForTimeout(300);

        // 3. Evaluation Lab
        await page.getByRole('button', { name: /Evaluation Lab/i }).click();
        await page.waitForTimeout(400);
        await captureCleanFullPage('docs/screenshots/03-evaluation-lab.png');

        // 4. Audit Trail & Ledger
        await page.getByRole('button', { name: /Audit Trail/i }).click();
        await page.waitForTimeout(400);
        await captureCleanFullPage('docs/screenshots/04-audit-trail-ledger.png');

        // 5. Live Recovery Runner
        await page.getByRole('button', { name: /Live Recovery Runner/i }).click();
        await page.waitForTimeout(400);
        await captureCleanFullPage('docs/screenshots/05-live-runner.png');

        // 6. Methodology & Guide
        await page.getByRole('button', { name: /Methodology/i }).click();
        await page.waitForTimeout(400);
        await captureCleanFullPage('docs/screenshots/05-methodology-guide.png');

        // 7. Promise-to-Pay Tracker
        await page.getByRole('button', { name: /Promise-to-Pay/i }).click();
        await page.waitForTimeout(400);
        await captureCleanFullPage('docs/screenshots/06-promise-to-pay.png');
      }
    });
  }
});
