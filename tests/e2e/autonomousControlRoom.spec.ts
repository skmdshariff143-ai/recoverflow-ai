/**
 * PayBack AI / RecoverFlow AI — Autonomous Recovery Control Room E2E Tests.
 *
 * Tests:
 * 1. Hero Loop Visualization rendering & stage clicking.
 * 2. Cycle 1 Discovery Funnel, KPI cards, and "Why This Action?" modal.
 * 3. Primary action execution: Run Recovery Cycle 1 -> Observation -> Learning transition.
 * 4. Cycle 2: Learn view with before/after case studies, promoted/demoted shifts, strategy distribution.
 * 5. Cycle 3: Optimize view with Next Best Action card.
 * 6. Final Benchmark view comparing Blind Retry vs RecoverFlow (+470% lift).
 * 7. Reset Control Room functionality.
 */

import { test, expect } from '@playwright/test';

test.describe('Autonomous Recovery Control Room & 3-Cycle Loop', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('payback_spotlight_dismissed_v1', 'true');
      localStorage.setItem('payback_guide_completed_v1', 'true');
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('renders Hero Loop Visualization and all 9 stages with loop connector', async ({ page }) => {
    const heroLoop = page.getByTestId('hero-loop-visualization');
    await expect(heroLoop).toBeVisible();

    await expect(page.getByText('Every Cycle Gets Smarter')).toBeVisible();
    await expect(page.getByText(/Continuous Feedback Loop/i)).toBeVisible();

    // Click on Stage 2 (UNDERSTAND)
    await page.getByRole('button', { name: '#2 UNDERSTAND' }).click();
    await expect(page.getByText(/Stage 2: UNDERSTAND/i)).toBeVisible();
    await expect(page.getByText(/AI = WHY/i).first()).toBeVisible();

    // Click on Stage 4 (PROTECT)
    await page.getByRole('button', { name: '#4 PROTECT' }).click();
    await expect(page.getByText(/Stage 4: PROTECT/i)).toBeVisible();
    await expect(page.getByText(/Zero Violations/i).first()).toBeVisible();
  });

  test('walks through Cycle 1 Discover, runs cycle, advances through Cycle 2 Learn and Cycle 3 Optimize', async ({ page }) => {
    const controlRoom = page.getByTestId('autonomous-control-room');
    await expect(controlRoom).toBeVisible();

    // ── Cycle 1: Discover ──
    await expect(page.getByTestId('cycle-1-discover')).toBeVisible();
    await expect(page.getByText(/Deterministic Allocation Funnel/i)).toBeVisible();
    await expect(page.getByText(/1. Ingested/i)).toBeVisible();
    await expect(page.getByText(/5. Budgeted Action/i)).toBeVisible();

    // Test "Why?" Explainability Modal
    const firstWhyBtn = page.getByRole('button', { name: 'Why?' }).first();
    await firstWhyBtn.click();
    const modal = page.getByTestId('explain-decision-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('WHY THIS ACTION?')).toBeVisible();
    await expect(modal.getByText(/Deterministic Decision Signals/i)).toBeVisible();
    await modal.getByRole('button', { name: 'Got It' }).click();
    await expect(modal).not.toBeVisible();

    // Trigger RUN RECOVERY CYCLE (Cycle 1)
    const runCycle1Btn = page.getByRole('button', { name: /RUN RECOVERY CYCLE \(Cycle 1\)/i });
    await expect(runCycle1Btn).toBeVisible();
    await runCycle1Btn.click();

    // Expect Learning loop transition
    await expect(page.getByText(/Cycle 1 Telemetry Observed & Learning Ingestion/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Learning Loop Activated/i)).toBeVisible();

    // ── Cycle 2: Learn ──
    const toCycle2Btn = page.getByRole('button', { name: /CYCLE 2: LEARN/i });
    await toCycle2Btn.click();
    await expect(page.getByTestId('cycle-2-learn')).toBeVisible();
    await expect(page.getByText(/RecoverFlow Learned from Cycle 1 Reality/i)).toBeVisible();
    await expect(page.getByText(/Autonomous Strategy Shift/i)).toBeVisible();
    await expect(page.getByText(/Cycle 2 Adaptive Ranking Shifts/i)).toBeVisible();
    await expect(page.getByText('PROMOTED').first()).toBeVisible();
    await expect(page.getByText('DEMOTED').first()).toBeVisible();

    // ── Cycle 3: Optimize ──
    const toCycle3Btn = page.getByRole('button', { name: /CYCLE 3: OPTIMIZE/i });
    await toCycle3Btn.click();
    await expect(page.getByTestId('cycle-3-optimize')).toBeVisible();
    await expect(page.getByTestId('next-best-action-card')).toBeVisible();
    await expect(page.getByText(/Recommended Next Best Action/i)).toBeVisible();

    // ── Stage 4: Final Benchmark ──
    const toFinalBenchmarkBtn = page.getByRole('button', { name: /FINAL BENCHMARK/i });
    await toFinalBenchmarkBtn.click();
    await expect(page.getByTestId('final-benchmark-comparison')).toBeVisible();
    await expect(page.getByText(/Why RecoverFlow Outperforms Blind Retries/i)).toBeVisible();
    await expect(page.getByText('+₹3,93,159.00 (+470%)')).toBeVisible();
    await expect(page.getByText('100% Waste Eliminated')).toBeVisible();
  });
});
