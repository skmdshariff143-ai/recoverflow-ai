'use client';

import React, { useState, useEffect } from 'react';
import { useRecoveryBatch } from '../hooks/useRecoveryBatch';
import { Header } from '../components/Header';
import { MetricsOverview } from '../components/MetricsOverview';
import { CalibrationVisualizer } from '../components/CalibrationVisualizer';
import { RankedQueueTable } from '../components/RankedQueueTable';
import { PaymentDrilldownModal } from '../components/PaymentDrilldownModal';
import { LiveRecoveryRunner } from '../components/LiveRecoveryRunner';
import { EvaluationLab } from '../components/EvaluationLab';
import { RecoveryIntelligence } from '../components/RecoveryIntelligence';
import { PromiseToPayTracker } from '../components/PromiseToPayTracker';
import { AuditTrailExplorer } from '../components/AuditTrailExplorer';
import { MethodologyGuide } from '../components/MethodologyGuide';
import { JudgeModeModal } from '../components/JudgeModeModal';
import { CommandPalette } from '../components/CommandPalette';
import { StickySummaryBar } from '../components/StickySummaryBar';
import { BlindBotReplayModal } from '../components/BlindBotReplayModal';
import { JudgeCheatSheetModal } from '../components/JudgeCheatSheetModal';
import { FirstTimeVisitorSpotlight } from '../components/FirstTimeVisitorSpotlight';
import { GuideMeTourModal } from '../components/GuideMeTourModal';
import { AutonomousControlRoom } from '../components/AutonomousControlRoom';
import { RazorpaySubscriptionsDashboard } from '../components/RazorpaySubscriptionsDashboard';
import { LiveRecoveryStream } from '../components/LiveRecoveryStream';
import { ConversionAnalytics } from '../components/ConversionAnalytics';
import { BrandToneCalibrationStudio } from '../components/BrandToneCalibrationStudio';
import { LiveChatMonitor } from '../components/LiveChatMonitor';
import { CartsExplorer } from '../components/CartsExplorer';
import type { CartEvent, Merchant, MessageLog, SuppressionEntry, DashboardTab, DataProvenanceSource } from '@recoverflow/core';

export default function Home() {
  const [isJudgeModeOpen, setIsJudgeModeOpen] = useState<boolean>(false);
  const [isReplayModalOpen, setIsReplayModalOpen] = useState<boolean>(false);
  const [isCheatSheetOpen, setIsCheatSheetOpen] = useState<boolean>(false);
  const [isGuideTourOpen, setIsGuideTourOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isRegulatoryFootprintOpen, setIsRegulatoryFootprintOpen] = useState<boolean>(false);

  const {
    payments,
    budget,
    setBudget,
    simulationSeed,
    setSimulationSeed,
    scoringModel,
    setScoringModel,
    modelComparison,
    provenance,
    setProvenance,
    activeTab,
    setActiveTab,
    selectedPaymentId,
    setSelectedPaymentId,
    selectedItem,
    selectedItemAuditRecords,
    batchResult,
    chainedLedger,
    ledgerVerification,
    devData,
    devReport,
    heldoutReport,
    filteredQueueItems,
    kpis,
    reviewerDecisions,
    applyReviewerAction,
    // Filters
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    searchQuery,
    setSearchQuery,
    sortField,
    setSortField,
    setSortAsc,
    // Exports
    handleExportCSV,
    handleExportJSON,
  } = useRecoveryBatch();

  // Async data for cart recovery endpoints
  const [data, setData] = useState<{
    merchant: Merchant;
    carts: CartEvent[];
    messages: MessageLog[];
    suppressions: SuppressionEntry[];
    stats: Record<string, unknown>;
  } | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/recovery/events');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch('/api/recovery/events');
        if (res.ok && !ignore) {
          const json = await res.json();
          setData(json);
        }
      } catch (e) {
        console.error('Error fetching dashboard data:', e);
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, []);

  const [resetToast, setResetToast] = useState<string | null>(null);

  const handleResetDemoState = React.useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.clear();
        localStorage.removeItem('payback_spotlight_dismissed_v1');
        localStorage.removeItem('payback_guide_completed_v1');
      }
    } catch {
      // Ignore storage errors in restricted sandboxes
    }

    setBudget(40);
    setSimulationSeed(42);
    setScoringModel('trained_logistic');
    setProvenance('synthetic_fixture');
    setActiveTab('dashboard');
    setSelectedPaymentId(null);
    setStatusFilter('all');
    setCategoryFilter('all');
    setSearchQuery('');
    setSortField('rank');
    setSortAsc(true);

    setResetToast('Demo state reset to initial defaults (40 budget slots, seed 42, trained logistic)');
    setTimeout(() => {
      setResetToast(null);
    }, 4000);
  }, [
    setBudget,
    setSimulationSeed,
    setScoringModel,
    setProvenance,
    setActiveTab,
    setSelectedPaymentId,
    setStatusFilter,
    setCategoryFilter,
    setSearchQuery,
    setSortField,
    setSortAsc,
  ]);

  // Global Shift+R keyboard shortcut for instant demo reset
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;
      if (!isInput && e.shiftKey && (e.key === 'R' || e.key === 'r')) {
        e.preventDefault();
        handleResetDemoState();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleResetDemoState]);

  const handleUpdateMerchant = (updated: Partial<Merchant>) => {
    if (data) {
      setData({
        ...data,
        merchant: { ...data.merchant, ...updated },
      });
    }
  };

  const handleExportCFOReport = () => {
    window.open('/api/recovery/reports/export?format=csv', '_blank');
  };

  const handleReSimulate = () => {
    setSimulationSeed(Math.floor(Math.random() * 100000) + 1);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* ── Global Header & Navigation ─────────────────────────── */}
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        budget={budget}
        onBudgetChange={setBudget}
        simulationSeed={simulationSeed}
        onReSimulate={handleReSimulate}
        provenance={provenance}
        onProvenanceChange={(p: DataProvenanceSource) => setProvenance(p)}
        onOpenJudgeMode={() => setIsJudgeModeOpen(true)}
        onOpenReplayArena={() => setIsReplayModalOpen(true)}
        onOpenCheatSheet={() => setIsCheatSheetOpen(true)}
        onOpenGuideTour={() => setIsGuideTourOpen(true)}
      />

      {/* ── Sticky Mini-Summary Bar (Appears on scroll past KPI cards) ─ */}
      <StickySummaryBar
        totalRevenueAtRisk={kpis.totalRevenueAtRisk}
        totalRevenueRecovered={kpis.totalRevenueRecovered}
        overallRecoveryRate={kpis.overallRecoveryRate}
        budgetedCount={kpis.budgetedCount}
        budgetLimit={budget}
        brierScore={kpis.brierScore}
        onReSimulate={handleReSimulate}
      />

      {/* ── Main Application Workspace ─────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 overflow-hidden max-w-full">
        {/* Workspace 1: Dashboard & Ranked Queue */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <MetricsOverview
              kpis={kpis}
              onNavigateTab={setActiveTab}
              onRegulatoryFootprintOpenChange={setIsRegulatoryFootprintOpen}
            />

            <RankedQueueTable
              items={filteredQueueItems}
              totalCount={batchResult.executed_items.length}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              sortField={sortField}
              onSortFieldChange={setSortField}
              onSortAscToggle={() => setSortAsc((prev) => !prev)}
              onSelectPayment={(id) => setSelectedPaymentId(id)}
              provenance={provenance}
            />

            <AutonomousControlRoom
              items={filteredQueueItems}
              payments={payments}
              batchResult={batchResult}
              evaluationReport={devReport}
              budget={budget}
              onBudgetChange={setBudget}
              onSelectPayment={(id) => setSelectedPaymentId(id)}
              onNavigateTab={setActiveTab}
              onReSimulate={handleReSimulate}
            />

            <CalibrationVisualizer
              calibration={batchResult.calibration}
              modelComparison={modelComparison}
              scoringModel={scoringModel}
              onScoringModelChange={setScoringModel}
            />
          </div>
        )}

        {/* Workspace 2: Live Recovery Runner */}
        {activeTab === 'live_runner' && (
          <LiveRecoveryRunner
            payments={payments}
            outcomesMap={devData.outcomesMap}
          />
        )}

        {/* Workspace 3: Evaluation Lab & Policy Simulator */}
        {activeTab === 'evaluation_lab' && (
          <div className="space-y-6">
            <RecoveryIntelligence
              items={batchResult.executed_items}
              evaluationReport={devReport}
            />
            <EvaluationLab
              devReport={devReport}
              heldoutReport={heldoutReport}
              payments={payments}
              policyConfig={{
                budget,
                approvalThresholdPaise: 5_000_000,
                maxAttemptsCap: 3,
              }}
              onPolicyConfigChange={(cfg) => setBudget(cfg.budget)}
            />
          </div>
        )}

        {/* Workspace 4: Promise-to-Pay Lifecycle Tracker */}
        {activeTab === 'promise_to_pay' && (
          <PromiseToPayTracker />
        )}

        {/* Workspace 5: Append-Only Cryptographic Audit Ledger */}
        {activeTab === 'audit_ledger' && (
          <AuditTrailExplorer
            records={chainedLedger}
            payments={payments}
            verification={ledgerVerification}
            onExportCSV={handleExportCSV}
            onExportJSON={handleExportJSON}
            onSelectPayment={(id) => setSelectedPaymentId(id)}
          />
        )}

        {/* Workspace 6: Methodology & Judge Guide */}
        {activeTab === 'methodology_guide' && (
          <MethodologyGuide />
        )}

        {/* Workspace 7: Autonomous Control Room */}
        {activeTab === 'control_room' && (
          <AutonomousControlRoom
            items={batchResult.executed_items}
            payments={payments}
            batchResult={batchResult}
            evaluationReport={devReport}
            budget={budget}
            onBudgetChange={setBudget}
            onSelectPayment={(id) => setSelectedPaymentId(id)}
            onNavigateTab={(t: DashboardTab) => setActiveTab(t)}
            onReSimulate={handleReSimulate}
          />
        )}

        {/* Workspace 8: Razorpay Subscriptions */}
        {activeTab === 'subscriptions' && (
          <RazorpaySubscriptionsDashboard />
        )}

        {/* Workspace 9: Live Recovery Stream */}
        {activeTab === 'stream' && (
          <LiveRecoveryStream
            carts={data?.carts || []}
            stats={data?.stats}
            onRefresh={fetchData}
          />
        )}

        {/* Workspace 10: Conversion Analytics */}
        {activeTab === 'analytics' && (
          <ConversionAnalytics stats={data?.stats} onExportReport={handleExportCFOReport} />
        )}

        {/* Workspace 11: Tone Studio */}
        {activeTab === 'tone_studio' && data?.merchant && (
          <BrandToneCalibrationStudio
            merchant={data.merchant}
            onUpdateMerchant={handleUpdateMerchant}
          />
        )}

        {/* Workspace 12: Chat Monitor */}
        {activeTab === 'chat_monitor' && (
          <LiveChatMonitor
            carts={data?.carts || []}
            messages={data?.messages || []}
          />
        )}

        {/* Workspace 13: Carts Explorer */}
        {activeTab === 'carts' && (
          <CartsExplorer
            carts={data?.carts || []}
            suppressions={data?.suppressions || []}
            onRefresh={fetchData}
          />
        )}
      </main>

      {/* ── Explainable Decision Drill-Down & Reviewer Action Modal ── */}
      {selectedItem && (
        <PaymentDrilldownModal
          item={selectedItem}
          allItems={batchResult.executed_items}
          auditRecords={selectedItemAuditRecords}
          onClose={() => setSelectedPaymentId(null)}
          onApplyReviewerAction={applyReviewerAction}
          existingReviewerAction={selectedPaymentId ? reviewerDecisions[selectedPaymentId] : undefined}
        />
      )}

      {/* ── Guided Evaluator Walkthrough (Judge Mode) ─────────────── */}
      <JudgeModeModal
        isOpen={isJudgeModeOpen}
        onClose={() => setIsJudgeModeOpen(false)}
        onNavigateTab={(tab: DashboardTab) => setActiveTab(tab)}
        onSetProvenance={(prov: DataProvenanceSource) => setProvenance(prov)}
      />

      {/* ── Blind-Bot vs PayBack AI Side-by-Side Replay Arena ─────── */}
      <BlindBotReplayModal
        isOpen={isReplayModalOpen}
        onClose={() => setIsReplayModalOpen(false)}
      />

      {/* ── Global Command Palette (Cmd/Ctrl+K) ────────────────────── */}
      <CommandPalette
        items={batchResult.executed_items}
        onNavigateTab={setActiveTab}
        onSelectPayment={(id) => setSelectedPaymentId(id)}
        onReSimulate={handleReSimulate}
        onVerifyLedger={() => {
          setActiveTab('audit_ledger');
        }}
        onOpenJudgeMode={() => setIsJudgeModeOpen(true)}
        onOpenReplayArena={() => setIsReplayModalOpen(true)}
        onOpenCheatSheet={() => setIsCheatSheetOpen(true)}
        onOpenGuideTour={() => setIsGuideTourOpen(true)}
        onResetDemoState={handleResetDemoState}
        onOpenChange={setIsCommandPaletteOpen}
      />

      {/* ── Demo Reset Notification Toast ─────────────────────────── */}
      {resetToast && (
        <div
          data-testid="demo-reset-toast"
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl border border-indigo-500/50 shadow-2xl flex items-center gap-3 animate-fade-in text-xs font-semibold"
        >
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>{resetToast}</span>
        </div>
      )}

      {/* ── Printable Judge Cheat Sheet Modal & QR Code Summary ─────── */}
      <JudgeCheatSheetModal
        isOpen={isCheatSheetOpen}
        onClose={() => setIsCheatSheetOpen(false)}
      />

      {/* ── Self-Playing Guided Proof Tour Modal ───────────────────── */}
      <GuideMeTourModal
        isOpen={isGuideTourOpen}
        onClose={() => setIsGuideTourOpen(false)}
        onNavigateTab={setActiveTab}
        onOpenReplayArena={() => setIsReplayModalOpen(true)}
      />

      {/* ── First-Time Visitor Dismissible Spotlight ─────────────── */}
      <FirstTimeVisitorSpotlight
        suppressedByOtherOverlay={Boolean(
          isJudgeModeOpen ||
          isReplayModalOpen ||
          isCheatSheetOpen ||
          isGuideTourOpen ||
          selectedPaymentId !== null ||
          isCommandPaletteOpen ||
          isRegulatoryFootprintOpen
        )}
      />

      {/* ── Global Footer ───────────────────────────────────────── */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 py-6 text-xs text-center">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <p className="font-medium text-slate-300">
            PayBack AI — Autonomous Bounded Revenue Recovery Engine
          </p>
          <p className="text-slate-400">
            Submission for Razorpay AI Buildathon · Track 3: AI Revenue Recovery · Deterministic Calibration &amp; Cryptographic Audit Ledger
          </p>
        </div>
      </footer>
    </div>
  );
}

