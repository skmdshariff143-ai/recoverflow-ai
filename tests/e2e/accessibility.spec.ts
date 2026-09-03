import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('PayBack AI — Accessibility & ARIA Compliance Audit', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('header');
  });

  test('runs automated axe-core accessibility audit with 0 critical or serious violations', async ({ page }) => {
    // Wait for network and DOM to settle
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    if (accessibilityScanResults.violations.length > 0) {
      console.log('--- ALL AXE VIOLATIONS ---');
      for (const v of accessibilityScanResults.violations) {
        console.log(`VIOLATION: ${v.id} [${v.impact}] - ${v.description}`);
        for (const n of v.nodes) {
          console.log(`  Selector: ${n.target.join(', ')}`);
          console.log(`  HTML: ${n.html}`);
          console.log(`  Summary: ${n.failureSummary}`);
        }
      }
    }

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
