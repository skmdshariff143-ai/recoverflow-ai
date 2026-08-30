import { test, expect } from '@playwright/test';

test.describe('PayBack AI — Smoke', () => {
  test('landing page renders title, subtitle, and top KPI metrics', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /PayBack AI/i })).toBeVisible();
    await expect(page.getByText(/Bounded, Explainable Recovery Orchestration/i)).toBeVisible();
    await expect(page.getByText(/Total Revenue at Risk/i)).toBeVisible();
  });
});
