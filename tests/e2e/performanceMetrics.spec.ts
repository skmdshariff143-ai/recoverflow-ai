import { test, expect } from '@playwright/test';

test.describe('RecoverFlow AI — Performance & Core Web Vitals Profile', () => {
  test('evaluates mobile performance and transfer size on landing page (/)', async ({ page }) => {
    // Emulate Mobile Device (iPhone 14 / Pixel 7 class)
    await page.setViewportSize({ width: 390, height: 844 });

    let jsTransferBytes = 0;
    let cssTransferBytes = 0;
    let totalTransferBytes = 0;
    const assetCount = { js: 0, css: 0, img: 0, other: 0 };

    page.on('response', async (res) => {
      try {
        const url = res.url();
        const headers = res.headers();
        const contentType = headers['content-type'] || '';
        const body = await res.body();
        const size = body.length;
        totalTransferBytes += size;

        if (contentType.includes('javascript') || url.endsWith('.js')) {
          jsTransferBytes += size;
          assetCount.js++;
        } else if (contentType.includes('css') || url.endsWith('.css')) {
          cssTransferBytes += size;
          assetCount.css++;
        } else if (contentType.includes('image') || url.endsWith('.svg') || url.endsWith('.png')) {
          assetCount.img++;
        } else {
          assetCount.other++;
        }
      } catch {
        // ignore data urls or aborted
      }
    });

    const startTime = Date.now();
    await page.goto('/', { waitUntil: 'networkidle' });
    const fullLoadTimeMs = Date.now() - startTime;

    // Collect Navigation and Web Vitals metrics from browser
    const metrics = await page.evaluate(async () => {
      const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paintEntries = performance.getEntriesByType('paint');

      const fcpEntry = paintEntries.find((p) => p.name === 'first-contentful-paint');
      const fcp = fcpEntry ? fcpEntry.startTime : null;

      // Estimate LCP from PerformanceObserver if available
      let lcp = fcp;
      try {
        const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
        if (lcpEntries.length > 0) {
          lcp = lcpEntries[lcpEntries.length - 1].startTime;
        }
      } catch {
        // fallback
      }

      // Estimate Cumulative Layout Shift (CLS)
      let cls = 0;
      try {
        const layoutShifts = performance.getEntriesByType('layout-shift') as any[];
        for (const entry of layoutShifts) {
          if (!entry.hadRecentInput) {
            cls += entry.value;
          }
        }
      } catch {
        // fallback
      }

      return {
        ttfb: navEntry ? navEntry.responseStart - navEntry.requestStart : 0,
        domInteractive: navEntry ? navEntry.domInteractive - navEntry.startTime : 0,
        domContentLoaded: navEntry ? navEntry.domContentLoadedEventEnd - navEntry.startTime : 0,
        fcp,
        lcp,
        cls,
      };
    });

    console.log('--- MOBILE PERFORMANCE AUDIT REPORT ---');
    console.log(`Full Load Time: ${fullLoadTimeMs}ms`);
    console.log(`TTFB: ${metrics.ttfb.toFixed(1)}ms`);
    console.log(`DOM Content Loaded: ${metrics.domContentLoaded.toFixed(1)}ms`);
    console.log(`First Contentful Paint (FCP): ${metrics.fcp ? metrics.fcp.toFixed(1) + 'ms' : 'N/A'}`);
    console.log(`Largest Contentful Paint (LCP): ${metrics.lcp ? metrics.lcp.toFixed(1) + 'ms' : 'N/A'}`);
    console.log(`Cumulative Layout Shift (CLS): ${metrics.cls.toFixed(4)}`);
    console.log(`Total Transfer Size: ${(totalTransferBytes / 1024).toFixed(1)} KB`);
    console.log(`JavaScript Transfer: ${(jsTransferBytes / 1024).toFixed(1)} KB (${assetCount.js} files)`);
    console.log(`CSS Transfer: ${(cssTransferBytes / 1024).toFixed(1)} KB (${assetCount.css} files)`);

    // Guard assertions
    expect(metrics.cls).toBeLessThan(0.1); // Google Web Vitals Good threshold: < 0.1
    expect(fullLoadTimeMs).toBeLessThan(10000); // Responsive under 10s even in cold local dev
  });
});
