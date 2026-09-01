import { test, expect } from '@playwright/test';

test.describe('Live Production QA Rehearsal Walkthrough', () => {
  const LIVE_URL = 'https://recoverflow-ai-kohl.vercel.app';

  test('Execute exact 6-step rehearsal on live production', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    console.log('=== STEP 1: Command Center Fresh Load ===');
    const startStep1 = Date.now();
    await page.goto(LIVE_URL, { waitUntil: 'networkidle' });
    const step1Time = Date.now() - startStep1;

    // Check KPIs
    await expect(page.getByText('Total Revenue at Risk')).toBeVisible();
    await expect(page.getByTestId('trust-score-card')).toBeVisible();
    await expect(page.getByTestId('revenue-recovered-card')).toBeVisible();
    await expect(page.getByTestId('net-recovery-metric')).toBeVisible();
    
    // Check Provenance Dropdown
    const provenanceSelect = page.locator('select').first();
    await expect(provenanceSelect).toBeVisible();

    console.log(`Step 1 Loaded in ${step1Time}ms with ${consoleErrors.length} console errors.`);

    console.log('=== STEP 2: Payment Drill-Down Drawer ===');
    const startStep2 = Date.now();
    // Click on row pay_00001
    const firstRow = page.locator('tbody tr').first();
    await firstRow.click();

    // Verify drill-down drawer components
    await expect(page.getByText('Recovery Journey')).toBeVisible();
    await expect(page.getByText(/Category Base Rate/i)).toBeVisible();
    await expect(page.getByText(/Bounded Gemini 3.6/i)).toBeVisible();

    // Trigger AI Diagnosis inside drawer
    const aiDiagnoseBtn = page.getByRole('button', { name: /AI Diagnose Error/i });
    await expect(aiDiagnoseBtn).toBeVisible();
    await aiDiagnoseBtn.click();
    await expect(page.getByText(/Mapped Category:/i)).toBeVisible({ timeout: 10000 });

    const step2Time = Date.now() - startStep2;
    console.log(`Step 2 Drill-down & AI Diagnosis verified in ${step2Time}ms.`);

    console.log('=== STEP 3: Dispatch Live Execution & Outcome Check ===');
    const startStep3 = Date.now();
    const dispatchBtn = page.getByRole('button', { name: 'Dispatch Live Execution' });
    await expect(dispatchBtn).toBeVisible();
    await dispatchBtn.click();
    
    // Verify execution result output
    await expect(page.getByText('Adapter Used:')).toBeVisible({ timeout: 10000 });

    // Trigger Outcome Check
    const checkOutcomeBtn = page.getByRole('button', { name: 'Run Outcome Check' });
    await expect(checkOutcomeBtn).toBeVisible();
    await checkOutcomeBtn.click();

    // Verify Observed Outcome appears
    await expect(page.getByText('Outcome Polling Result:')).toBeVisible({ timeout: 10000 });

    const step3Time = Date.now() - startStep3;
    console.log(`Step 3 Live execution dispatch & outcome verification completed in ${step3Time}ms.`);

    // Close drawer
    const closeBtn = page.locator('button[aria-label="Close modal"]').or(page.getByRole('button', { name: /Close/i })).first();
    await closeBtn.click();
    await page.waitForTimeout(400);

    console.log('=== STEP 4: Live Tamper Demo ===');
    const startStep4 = Date.now();
    // Switch to Audit Ledger tab
    await page.getByRole('button', { name: /Audit Trail/i }).click();
    await page.waitForTimeout(500);

    // Initial check: ledger is intact
    const integrityBanner = page.getByTestId('ledger-integrity-banner');
    await expect(integrityBanner).toBeVisible();
    await expect(integrityBanner).toContainText(/Cryptographic Verification Passed/i);

    // Click "Tamper & Verify" button
    const tamperBtn = page.getByTestId('tamper-submit-btn');
    await expect(tamperBtn).toBeVisible();
    await tamperBtn.click();
    await page.waitForTimeout(500);

    // Confirm broken hash-chain indicator
    await expect(integrityBanner).toContainText(/INTEGRITY BREACH DETECTED/i);

    // Click Reset Demo
    const resetBtn = page.getByTestId('tamper-reset-btn');
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();
    await page.waitForTimeout(500);

    // Confirm verified state returned
    await expect(integrityBanner).toContainText(/Cryptographic Verification Passed/i);

    const step4Time = Date.now() - startStep4;
    console.log(`Step 4 Tamper demo & restoration verified in ${step4Time}ms.`);

    console.log('=== STEP 5: Evaluation Lab Policy Table ===');
    const startStep5 = Date.now();
    await page.getByRole('button', { name: /Evaluation Lab/i }).click();
    await page.waitForTimeout(500);

    // Confirm policy comparison table
    await expect(page.getByText(/Comparative Recovery Policy Matrix/i)).toBeVisible();
    await expect(page.getByText('PayBack AI (EV Prioritization)').first()).toBeVisible();
    await expect(page.getByText(/Fixed Retry/i).first()).toBeVisible();
    await expect(page.getByText(/Gross Incremental Lift/i).first()).toBeVisible();

    const step5Time = Date.now() - startStep5;
    console.log(`Step 5 Evaluation Lab rendered in ${step5Time}ms.`);

    console.log('=== STEP 6: Audit Ledger Integrity Verification ===');
    const startStep6 = Date.now();
    await page.getByRole('button', { name: /Audit Trail/i }).click();
    await page.waitForTimeout(500);

    const verifyLedgerBtn = page.getByRole('button', { name: /Verify Ledger Integrity/i });
    if (await verifyLedgerBtn.isVisible()) {
      await verifyLedgerBtn.click();
      await page.waitForTimeout(500);
    }

    await expect(integrityBanner).toContainText(/Cryptographic Verification Passed/i);
    const step6Time = Date.now() - startStep6;
    console.log(`Step 6 Ledger Integrity re-walk completed in ${step6Time}ms.`);

    console.log('=== LIVE QA SUMMARY ===');
    console.log(`Total Console Errors count: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log('Console Errors:', consoleErrors);
    }
  });
});
