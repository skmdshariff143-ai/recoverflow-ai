import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Open demo workspace' }).click();
  await expect(page).toHaveURL(/\/overview$/);
  await expect(page.getByRole('heading', { name: 'A clearer view of your revenue.' })).toBeVisible();
}
test.describe('RecoverFlow merchant console', () => {
  test('public landing and protected routes', async ({ page, request }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Failed payments.');
    await page.goto('/overview');
    await expect(page).toHaveURL(/\/login$/);
    expect((await request.get('/api/console')).status()).toBe(401);
  });
  test('search, pagination, deep links, and unknown case', async ({ page }) => {
    await signIn(page);
    await page.goto('/recovery/cases');
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(10);
    const firstId = await rows.first().locator('td a').first().textContent();
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(rows.first().locator('td a').first()).not.toHaveText(firstId!);
    await page.getByLabel('Search cases').fill('no-such-case');
    await expect(page.getByText('No matching cases')).toBeVisible();
    await page.getByLabel('Search cases').fill('');
    await rows.first().locator('td a').first().click();
    await expect(page.getByText('Decision context', { exact: true })).toBeVisible();
    await page.goto('/recovery/cases/not-a-real-case');
    await expect(page.getByRole('heading', { name: 'Case unavailable' })).toBeVisible();
  });
  test('policy changes persist across reload and viewer mutations are denied', async ({ page }) => {
    await signIn(page);
    await page.goto('/policies');
    const guidelines = page.getByLabel('Brand voice guidelines');
    await expect(guidelines).toBeVisible();
    const original = await guidelines.inputValue();
    await guidelines.fill('Be thoughtful, concise, and transparent with every customer.');
    await page.getByRole('button', { name: 'Save policy' }).click();
    await expect(page.getByRole('status')).toContainText('Merchant policy saved');
    await page.reload();
    await expect(guidelines).toHaveValue('Be thoughtful, concise, and transparent with every customer.');
    await guidelines.fill(original);
    await page.getByRole('button', { name: 'Save policy' }).click();
    await expect(page.getByRole('status')).toContainText('Merchant policy saved');
    await page.getByLabel('Demo role').selectOption('VIEWER');
    await expect(page.getByRole('button', { name: 'Save policy' })).toBeDisabled();
    const response = await page.request.patch('/api/console/settings', { headers: { origin: new URL(page.url()).origin }, data: { guidelines: 'Not authorized to change', discountCeiling: 0, formality: 0, urgency: 0 } });
    expect(response.status()).toBe(403);
  });
  test('two reviewers, duplicate prevention, persisted audit, and no fabricated payment success', async ({ page }) => {
    await signIn(page);
    await page.goto('/recovery/approvals');
    await page.getByRole('button', { name: 'Add demo case' }).click();
    await expect(page.getByRole('status')).toContainText('A new sample case');
    const card = page.locator('article').first();
    const caseLabel = await card.getByRole('link').textContent();
    await card.getByRole('button', { name: 'Review & approve' }).click();
    await page.getByLabel('Reason for this decision').fill('Verified customer evidence in the demo workflow.');
    await page.getByRole('button', { name: 'Confirm decision' }).click();
    await expect(page.getByRole('status')).toContainText('First approval recorded');
    await card.getByRole('button', { name: 'Review & approve' }).click();
    await page.getByLabel('Reason for this decision').fill('Attempting the same review a second time.');
    await page.getByRole('button', { name: 'Confirm decision' }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('already reviewed');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByLabel('Demo role').selectOption('OWNER');
    await expect(page.getByLabel('Demo role')).toHaveValue('OWNER');
    const sameCard = page.locator('article').filter({ hasText: caseLabel! });
    await sameCard.getByRole('button', { name: 'Review & approve' }).click();
    await page.getByLabel('Reason for this decision').fill('Independent verification by a second demo operator.');
    await page.getByRole('button', { name: 'Confirm decision' }).click();
    await expect(page.getByRole('status')).toContainText('Both approvals recorded');
    await expect(sameCard).toHaveCount(0);
    await page.goto('/audit');
    await page.getByRole('button', { name: 'Verify ledger' }).click();
    await expect(page.getByRole('status')).toContainText('All checked hashes link correctly');
  });
  test('copilot answers from records and command palette navigates with keyboard', async ({ page }) => {
    await signIn(page);
    await page.keyboard.press('Control+k');
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    await expect(palette).toBeVisible();
    await palette.getByLabel('Search pages').fill('copilot');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/intelligence\/copilot$/);
    await page.getByRole('button', { name: 'Summarize recovered revenue' }).click();
    await expect(page.getByRole('log')).toContainText('cases marked recovered');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/overview');
    await expect(page).toHaveURL(/\/login$/);
  });
  test('console desktop accessibility and mobile navigation', async ({ page }) => {
    await signIn(page);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
    await page.getByRole('button', { name: 'Open navigation' }).click();
    const navigation = page.getByRole('dialog', { name: 'Mobile navigation' });
    await expect(navigation).toBeVisible();
    await navigation.getByRole('link', { name: 'Recovery queue', exact: true }).click();
    await expect(navigation).not.toBeVisible();
    await expect(page).toHaveURL(/\/recovery\/queue$/);
    await expect(page.locator('tbody tr')).not.toHaveCount(0);
    await expect(page.locator('tbody')).not.toContainText('RECOVERED');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
  test('every console destination renders and cart search works', async ({ page }) => {
    test.setTimeout(90000);
    await signIn(page);
    for (const path of ['/analytics', '/commerce/carts', '/commerce/payments', '/commerce/subscriptions', '/recovery/promises', '/customers', '/communications', '/intelligence/experiments', '/intelligence/model-lab', '/operations', '/integrations', '/developers', '/team', '/settings']) {
      await page.goto(path);
      await expect(page.locator('main h1')).toBeVisible();
      await expect(page.getByText('Workspace unavailable', { exact: true })).toHaveCount(0);
    }
    await page.goto('/commerce/carts');
    await expect(page.locator('article').first()).toBeVisible();
    await page.getByLabel('Search carts').fill('no-such-sample-item');
    await expect(page.getByText('No matching carts', { exact: true })).toBeVisible();
  });});

