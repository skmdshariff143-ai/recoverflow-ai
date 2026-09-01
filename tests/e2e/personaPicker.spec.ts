import { test, expect } from '@playwright/test';

test.describe('PayBack AI — Merchant Risk-Appetite Persona Picker', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('payback_spotlight_dismissed_v1', 'true');
    });
    await page.goto('/');
    await page.waitForSelector('header');
  });

  test('renders all 3 merchant personas and pre-fills compliant policy parameters', async ({ page }) => {
    // 1. Navigate to Evaluation Lab tab
    const evalTabBtn = page.getByTestId('tab-evaluation-lab');
    await expect(evalTabBtn).toBeVisible();
    await evalTabBtn.click();

    // 2. Verify Policy Builder and Persona Picker are visible
    const policyBuilder = page.getByTestId('merchant-policy-builder');
    await expect(policyBuilder).toBeVisible();

    const personaPicker = page.getByTestId('persona-picker');
    await expect(personaPicker).toBeVisible();

    // 3. Verify all 3 persona buttons exist
    const cautiousBtn = page.getByTestId('persona-btn-cautious_saas');
    const d2cBtn = page.getByTestId('persona-btn-high_volume_d2c');
    const b2bBtn = page.getByTestId('persona-btn-enterprise_b2b');

    await expect(cautiousBtn).toContainText('Cautious SaaS');
    await expect(d2cBtn).toContainText('High-Volume D2C');
    await expect(b2bBtn).toContainText('Enterprise B2B');

    // 4. Click Cautious SaaS
    await cautiousBtn.click();
    await expect(policyBuilder).toContainText('25 Slots');
    await expect(policyBuilder).toContainText('₹25,000');

    // 5. Click High-Volume D2C
    await d2cBtn.click();
    await expect(policyBuilder).toContainText('65 Slots');
    await expect(policyBuilder).toContainText('₹50,000');

    // 6. Click Enterprise B2B
    await b2bBtn.click();
    await expect(policyBuilder).toContainText('35 Slots');
    await expect(policyBuilder).toContainText('₹1,00,000');

    // 7. Verify manual adjustment works after persona selection
    const budgetInput = page.locator('#policy-budget-input');
    await budgetInput.fill('45');
    await budgetInput.dispatchEvent('change');
    await expect(policyBuilder).toContainText('45 Slots');
  });
});
