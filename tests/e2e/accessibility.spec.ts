import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('PayBack AI — Accessibility & ARIA Compliance Audit', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('payback_spotlight_dismissed_v1', 'true');
    });
    await page.goto('/');
    await page.waitForSelector('header');
  });

  test('runs automated axe-core accessibility audit with 0 critical or serious violations', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalViolations).toEqual([]);
  });

  test('ensures status badges have meaningful ARIA labels instead of color-only indicators', async ({ page }) => {
    const statusBadges = page.locator('tbody tr td span[role="status"]');
    const count = await statusBadges.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < Math.min(count, 10); i++) {
      const badge = statusBadges.nth(i);
      const ariaLabel = await badge.getAttribute('aria-label');
      expect(ariaLabel).not.toBeNull();
      expect(ariaLabel!.length).toBeGreaterThan(3);
      expect(ariaLabel).toMatch(/Status:/i);
    }
  });

  test('ensures dynamic live regions (aria-live="polite") are mounted for assistive technologies', async ({ page }) => {
    const liveRegions = page.locator('[aria-live="polite"]');
    const liveCount = await liveRegions.count();
    expect(liveCount).toBeGreaterThanOrEqual(2);
  });
});
