import { test, expect } from '@playwright/test';

test.describe('Live Production QA Rehearsal Walkthrough', () => {
  const LIVE_URL = 'https://recoverflow-ai-kohl.vercel.app';

  test('Execute exact new 5-stop pitch rehearsal on live production', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.addInitScript(() => {
      localStorage.setItem('payback_spotlight_dismissed_v1', 'true');
      localStorage.setItem('payback_guide_completed_v1', 'true');
    });

    console.log('=== STOP 1: Live Tamper Demo & Self-Verifiable Hash Chain Walk ===');
    const startStop1 = Date.now();
    await page.goto(LIVE_URL, { waitUntil: 'networkidle' });

    // Navigate to Audit Ledger tab
    await page.getByTestId('tab-audit-ledger').click();
    await page.waitForTimeout(400);

    // Initial check: ledger is intact
    const integrityBanner = page.getByTestId('ledger-integrity-banner');
    await expect(integrityBanner).toBeVisible();
    await expect(integrityBanner).toContainText(/Cryptographic Verification Passed/i);

    // Tamper & Verify
    const tamperBtn = page.getByTestId('tamper-submit-btn');
    await expect(tamperBtn).toBeVisible();
    await tamperBtn.click();
    await page.waitForTimeout(400);
    await expect(integrityBanner).toContainText(/INTEGRITY BREACH DETECTED/i);

    // Reset Demo
    const resetBtn = page.getByTestId('tamper-reset-btn');
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();
    await page.waitForTimeout(300);
    await expect(integrityBanner).toContainText(/Cryptographic Verification Passed/i);

    // Verify self-verifiable hash walk
    const walkPanel = page.getByTestId('verify-ledger-walk-panel');
    await expect(walkPanel).toBeVisible();
    await walkPanel.getByTestId('step-ledger-walk-btn').click();
    await expect(walkPanel.getByTestId('walk-inspector-card')).toBeVisible();

    const stop1Time = Date.now() - startStop1;
    console.log(`Stop 1 (Tamper Demo & Verification Walk) verified in ${stop1Time}ms.`);

    console.log('=== STOP 2: Command Center KPIs, Trust Score & Connected Webhooks ===');
    const startStop2 = Date.now();
    await page.getByTestId('tab-dashboard').click();
    await page.waitForTimeout(400);

    // Check top financial KPIs
    await expect(page.getByText('Total Revenue at Risk')).toBeVisible();
    await expect(page.getByTestId('trust-score-card')).toBeVisible();
    await expect(page.getByTestId('revenue-recovered-card')).toBeVisible();
    await expect(page.getByTestId('net-recovery-metric')).toBeVisible();

    // Check Data Source selector
    const provenanceSelect = page.locator('select').first();
    await expect(provenanceSelect).toBeVisible();

    const stop2Time = Date.now() - startStop2;
    console.log(`Stop 2 (Command Center & Trust Score) verified in ${stop2Time}ms.`);

    console.log('=== STOP 3: Payment Drill-Down, Bounded AI Copilot & Live Execution ===');
    const startStop3 = Date.now();
    // Open first payment drill-down
    const firstRow = page.locator('tbody tr').first();
    await firstRow.click();

    // Verify explainability components
    await expect(page.getByText('Recovery Journey')).toBeVisible();
    await expect(page.getByText(/Category Base Rate/i)).toBeVisible();
    await expect(page.getByText(/Bounded Gemini 3.6/i)).toBeVisible();

    // AI Diagnose Error
    const aiDiagnoseBtn = page.getByRole('button', { name: /AI Diagnose Error/i });
    await expect(aiDiagnoseBtn).toBeVisible();
    await aiDiagnoseBtn.click();
    await expect(page.getByText(/Mapped Category:/i)).toBeVisible({ timeout: 10000 });

    // Live Execution Dispatch
    const dispatchBtn = page.getByRole('button', { name: 'Dispatch Live Execution' });
    await expect(dispatchBtn).toBeVisible();
    await dispatchBtn.click();
    await expect(page.getByText('Adapter Used:')).toBeVisible({ timeout: 10000 });

    // Outcome Observation Check
    const checkOutcomeBtn = page.getByRole('button', { name: 'Run Outcome Check' });
    await expect(checkOutcomeBtn).toBeVisible();
    await checkOutcomeBtn.click();
    await expect(page.getByText('Outcome Polling Result:')).toBeVisible({ timeout: 10000 });

    // Close drawer
    const closeBtn = page.locator('button[aria-label="Close modal"]').or(page.getByRole('button', { name: /Close/i })).first();
    await closeBtn.click();
    await page.waitForTimeout(300);

    const stop3Time = Date.now() - startStop3;
    console.log(`Stop 3 (Drill-Down, Copilot & Dispatch) verified in ${stop3Time}ms.`);

    console.log('=== STOP 4: Evaluation Lab Policy Simulation & Persona Picker ===');
    const startStop4 = Date.now();
    await page.getByTestId('tab-evaluation-lab').click();
    await page.waitForTimeout(400);

    // Verify Persona Picker and Counterfactual Table
    await expect(page.getByText('Conservative SaaS')).toBeVisible();
    await expect(page.getByText('Aggressive E-Commerce')).toBeVisible();
    await expect(page.getByText('Regulated FinTech')).toBeVisible();
    await expect(page.getByText('Counterfactual Policy Simulation')).toBeVisible();

    const stop4Time = Date.now() - startStop4;
    console.log(`Stop 4 (Evaluation Lab & Persona Picker) verified in ${stop4Time}ms.`);

    console.log('=== STOP 5: Replay Arena & Closed-Loop Autonomous Control Room ===');
    const startStop5 = Date.now();
    // Launch Replay Arena
    await page.getByTestId('open-replay-arena-btn').click();
    await expect(page.getByText(/Blind-Bot vs PayBack AI/i)).toBeVisible();
    await expect(page.getByTestId('replay-skip-btn')).toBeVisible();
    await page.getByTestId('replay-skip-btn').click();
    await expect(page.getByText(/Final Scorecard/i)).toBeVisible({ timeout: 8000 });

    // Close Replay Arena
    const closeReplayBtn = page.locator('button[aria-label="Close Replay Arena"]').or(page.getByRole('button', { name: /Exit Arena/i })).first();
    if (await closeReplayBtn.isVisible()) {
      await closeReplayBtn.click();
    }

    const stop5Time = Date.now() - startStop5;
    console.log(`Stop 5 (Replay Arena & Scorecard) verified in ${stop5Time}ms.`);

    console.log('=== LIVE PRODUCTION QA SUMMARY ===');
    console.log(`Total Stop 1 Time: ${stop1Time}ms`);
    console.log(`Total Stop 2 Time: ${stop2Time}ms`);
    console.log(`Total Stop 3 Time: ${stop3Time}ms`);
    console.log(`Total Stop 4 Time: ${stop4Time}ms`);
    console.log(`Total Stop 5 Time: ${stop5Time}ms`);
    console.log(`Total Console Errors count: ${consoleErrors.length}`);

    expect(consoleErrors.length).toBe(0);
  });
});
