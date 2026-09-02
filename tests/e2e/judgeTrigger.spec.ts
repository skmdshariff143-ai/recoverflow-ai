import { test, expect } from '@playwright/test';

test.describe('PayBack AI — Judge-Triggered Live Failure Participation (Task 1)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('payback_spotlight_dismissed_v1', 'true');
      localStorage.setItem('payback_guide_completed_v1', 'true');
    });
  });

  test('mobile trigger page /trigger renders controls and dispatches test-mode failure', async ({ page }) => {
    await page.goto('/trigger');
    await page.waitForLoadState('networkidle');

    // Verify trigger interface elements
    await expect(page.getByRole('heading', { name: 'PayBack AI' })).toBeVisible();
    await expect(page.getByText('Audience Participation:')).toBeVisible();
    await expect(page.getByText('1. Failure Reason')).toBeVisible();
    await expect(page.getByText('2. Transaction Amount')).toBeVisible();

    // Select a preset amount (₹4,999) and submit
    await page.getByRole('button', { name: /4,999/i }).click();
    await page.getByTestId('submit-live-trigger-btn').click();

    // Verify instant success alert
    await expect(page.getByTestId('trigger-response-alert')).toBeVisible({ timeout: 6000 });
    await expect(page.getByText(/Live Payment Failure Dispatched!/i)).toBeVisible();
    await expect(page.getByTestId('trigger-response-alert').getByText(/pay_judge_/i).first()).toBeVisible();
  });

  test('triggering via /trigger propagates the event into the live ranked queue on the Command Center', async ({ browser }) => {
    const context = await browser.newContext();
    const triggerPage = await context.newPage();
    const mainPage = await context.newPage();

    // Open main dashboard
    await mainPage.addInitScript(() => {
      localStorage.setItem('payback_spotlight_dismissed_v1', 'true');
      localStorage.setItem('payback_guide_completed_v1', 'true');
    });
    await mainPage.goto('/');
    await mainPage.waitForLoadState('networkidle');

    // Trigger failure from mobile page
    await triggerPage.goto('/trigger');
    await triggerPage.waitForLoadState('networkidle');
    await triggerPage.getByRole('button', { name: /12,500/i }).click();
    await triggerPage.getByTestId('submit-live-trigger-btn').click();
    await expect(triggerPage.getByTestId('trigger-response-alert')).toBeVisible({ timeout: 6000 });

    // Extract the generated payment ID
    const alertText = await triggerPage.getByTestId('trigger-response-alert').innerText();
    const match = alertText.match(/pay_judge_[a-z0-9]+/i);
    expect(match).not.toBeNull();
    const injectedId = match![0];

    // Check main dashboard reflects the new payment ID
    await expect(mainPage.getByText(injectedId).first()).toBeVisible({ timeout: 8000 });

    await context.close();
  });

  test('Audit Trail Explorer displays QR code and link to mobile trigger page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to Audit Trail Explorer
    await page.getByTestId('tab-audit-ledger').click();

    // Verify QR code panel is visible
    const qrPanel = page.getByTestId('judge-trigger-qr-panel');
    await expect(qrPanel).toBeVisible();
    await expect(qrPanel.getByTestId('open-trigger-page-link')).toBeVisible();
  });
});
