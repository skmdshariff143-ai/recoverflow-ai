import { test, expect } from '@playwright/test';

test.describe('PayBack AI — Smoke', () => {
  test('landing page renders title and milestone progress', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'PayBack AI' })).toBeVisible();
    await expect(page.getByText('Predictive Revenue Recovery')).toBeVisible();
    await expect(page.getByText('Milestone 1')).toBeVisible();
  });
});
