import { test } from '@playwright/test';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

test.describe('RecoverFlow AI — Pre-Launch Visual QA Screenshots', () => {
  const outputDir = resolve(process.cwd(), 'docs/qa');

  test.beforeAll(() => {
    mkdirSync(outputDir, { recursive: true });
  });

  test('captures public pre-launch pages and responsive viewports', async ({ page }) => {
    // 1. Seven viewports for Landing Page (Item 14 Responsive QA)
    const viewports = [
      { width: 320, height: 600, name: 'viewport-320-mobile-mini' },
      { width: 360, height: 740, name: 'viewport-360-standard-mobile' },
      { width: 390, height: 844, name: 'viewport-390-iphone-14' },
      { width: 768, height: 1024, name: 'viewport-768-tablet' },
      { width: 1024, height: 768, name: 'viewport-1024-laptop' },
      { width: 1440, height: 900, name: 'viewport-1440-desktop' },
      { width: 1920, height: 1080, name: 'viewport-1920-large' },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: resolve(outputDir, `${vp.name}.png`), fullPage: false });
    }

    // 2. Desktop (1440x900) views for key pages
    await page.setViewportSize({ width: 1440, height: 900 });

    // Landing Page Desktop Full
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: resolve(outputDir, '01-landing-page-desktop.png'), fullPage: false });

    // Privacy Policy Desktop
    await page.goto('/privacy');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: resolve(outputDir, '02-privacy-policy-desktop.png'), fullPage: false });

    // Terms of Service Desktop
    await page.goto('/terms');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: resolve(outputDir, '03-terms-of-service-desktop.png'), fullPage: false });

    // Custom 404 Page Desktop
    await page.goto('/non-existent-sample-page-404');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: resolve(outputDir, '04-custom-404-desktop.png'), fullPage: false });

    // Operator Login Page Desktop
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: resolve(outputDir, '05-login-page-desktop.png'), fullPage: false });
  });
});
