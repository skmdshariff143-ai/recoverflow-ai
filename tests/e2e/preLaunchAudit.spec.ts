import { test, expect } from '@playwright/test';

test.describe('RecoverFlow AI — 20-Point Pre-Launch Master Audit Verification', () => {

  test('01, 02, 06 — Privacy Policy & Terms of Service public routes and metadata', async ({ page }) => {
    // 1. Privacy Policy
    const privRes = await page.goto('/privacy');
    expect(privRes?.status()).toBe(200);
    await expect(page).toHaveTitle(/Privacy Policy · RecoverFlow AI/i);
    await expect(page.getByRole('heading', { level: 1, name: /Privacy Policy/i })).toBeVisible();
    await expect(page.getByText(/Operational Data Privacy Statement/i)).toBeVisible();
    await expect(page.getByText(/Zero Float Arithmetic/i)).toBeVisible();
    await expect(page.getByText(/Bounded AI Advisory/i)).toBeVisible();
    await expect(page.getByText(/recoverflow_session/i)).toBeVisible();

    // 2. Terms of Service
    const termsRes = await page.goto('/terms');
    expect(termsRes?.status()).toBe(200);
    await expect(page).toHaveTitle(/Terms of Service · RecoverFlow AI/i);
    await expect(page.getByRole('heading', { level: 1, name: /Terms of Service/i })).toBeVisible();
    await expect(page.getByText(/Merchant Service Agreement/i)).toBeVisible();
    await expect(page.getByText(/Dual-Custody and Human Operator Responsibility/i)).toBeVisible();
    await expect(page.getByText(/No Warranty of Payment Clearance/i)).toBeVisible();
  });

  test('04 — HTTPS and Security Headers enforcement', async ({ page }) => {
    const res = await page.goto('/');
    expect(res).not.toBeNull();
    const headers = res!.headers();

    expect(headers['x-frame-options']?.toLowerCase()).toBe('deny');
    expect(headers['x-content-type-options']?.toLowerCase()).toBe('nosniff');
    expect(headers['referrer-policy']?.toLowerCase()).toBe('strict-origin-when-cross-origin');
    expect(headers['permissions-policy']).toBeDefined();
    expect(headers['content-security-policy-report-only'] || headers['content-security-policy']).toBeDefined();
  });

  test('07, 08 — Social preview images, favicon, apple-icon, and manifest', async ({ request }) => {
    // OpenGraph image
    const ogRes = await request.get('/opengraph-image');
    expect(ogRes.status()).toBe(200);
    expect(ogRes.headers()['content-type']).toContain('image/png');

    // Twitter image
    const twRes = await request.get('/twitter-image');
    expect(twRes.status()).toBe(200);
    expect(twRes.headers()['content-type']).toContain('image/png');

    // App icon
    const iconRes = await request.get('/icon');
    expect(iconRes.status()).toBe(200);
    expect(iconRes.headers()['content-type']).toContain('image/png');

    // Apple touch icon
    const appleRes = await request.get('/apple-icon');
    expect(appleRes.status()).toBe(200);
    expect(appleRes.headers()['content-type']).toContain('image/png');

    // Manifest
    const manifestRes = await request.get('/manifest.webmanifest');
    expect(manifestRes.status()).toBe(200);
    const manifestJson = await manifestRes.json();
    expect(manifestJson.name).toContain('RecoverFlow AI');
    expect(manifestJson.icons.length).toBeGreaterThanOrEqual(2);
  });

  test('09 — Sitemap and Robots.txt validation', async ({ request }) => {
    // Robots.txt
    const robotsRes = await request.get('/robots.txt');
    expect(robotsRes.status()).toBe(200);
    const robotsText = await robotsRes.text();
    expect(robotsText).toMatch(/User-agent: \*/i);
    expect(robotsText).toContain('Allow: /privacy');
    expect(robotsText).toContain('Allow: /terms');
    expect(robotsText).toContain('Disallow: /api/');
    expect(robotsText).toContain('Disallow: /overview');
    expect(robotsText).toContain('sitemap.xml');

    // Sitemap.xml
    const sitemapRes = await request.get('/sitemap.xml');
    expect(sitemapRes.status()).toBe(200);
    const sitemapText = await sitemapRes.text();
    expect(sitemapText).toContain('/demo');
    expect(sitemapText).toContain('/privacy');
    expect(sitemapText).toContain('/terms');
    expect(sitemapText).not.toContain('/api/');
    expect(sitemapText).not.toContain('/overview');
  });

  test('15 — Branded Custom 404 page preserves HTTP 404 status', async ({ page }) => {
    const res = await page.goto('/this-route-definitely-does-not-exist-404');
    expect(res?.status()).toBe(404);
    await expect(page.getByText('404 / PAGE NOT FOUND')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: /This page isn’t available/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Return to Home/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Open Workspace/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Benchmark Lab/i })).toBeVisible();
  });

  test('16 — Navigation and footer links integrity on landing page', async ({ page }) => {
    await page.goto('/');

    // Verify all footer navigation targets
    const privacyLink = page.getByRole('link', { name: /Privacy Policy/i });
    await expect(privacyLink).toBeVisible();
    await expect(privacyLink).toHaveAttribute('href', '/privacy');

    const termsLink = page.getByRole('link', { name: /Terms of Service/i });
    await expect(termsLink).toBeVisible();
    await expect(termsLink).toHaveAttribute('href', '/terms');

    const demoLink = page.getByRole('link', { name: /Benchmark Lab/i }).first();
    await expect(demoLink).toBeVisible();
    await expect(demoLink).toHaveAttribute('href', '/demo');

    const workspaceLink = page.getByRole('link', { name: /Workspace/i }).first();
    await expect(workspaceLink).toBeVisible();
    await expect(workspaceLink).toHaveAttribute('href', '/login');
  });

  test('14 — Multi-device responsive viewport check across 7 screen widths', async ({ page }) => {
    const viewports = [
      { width: 320, height: 600, name: '320px (Mobile Mini)' },
      { width: 360, height: 740, name: '360px (Standard Mobile)' },
      { width: 390, height: 844, name: '390px (iPhone 14)' },
      { width: 768, height: 1024, name: '768px (Tablet)' },
      { width: 1024, height: 768, name: '1024px (Small Laptop)' },
      { width: 1440, height: 900, name: '1440px (Desktop)' },
      { width: 1920, height: 1080, name: '1920px (Large Screen)' },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Assert no horizontal scrollbar overflow
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth <= window.innerWidth;
      });
      expect(overflow, `Horizontal overflow detected at ${vp.name}`).toBe(true);

      // Verify essential CTA is visible and clickable
      const cta = page.getByRole('link', { name: /Guide Me \(Interactive Tour\)/i }).first();
      await expect(cta).toBeVisible();
    }
  });
});
