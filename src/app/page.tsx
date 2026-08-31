/**
 * PayBack AI — Main Control Center Application.
 *
 * Interactive Bounded Revenue Recovery, Evaluation Lab & Audit Control Center.
 */

'use client';

import React from 'react';
import { useRecoveryBatch } from '@/hooks/useRecoveryBatch';
import { Header } from '@/components/Header';
import { MetricsOverview } from '@/components/MetricsOverview';
import { CalibrationVisualizer } from '@/components/CalibrationVisualizer';
import { RankedQueueTable } from '@/components/RankedQueueTable';
import { PaymentDrilldownModal } from '@/components/PaymentDrilldownModal';
import { LiveRecoveryRunner } from '@/components/LiveRecoveryRunner';
import { EvaluationLab } from '@/components/EvaluationLab';
import { RecoveryIntelligence } from '@/components/RecoveryIntelligence';
import { PromiseToPayTracker } from '@/components/PromiseToPayTracker';
import { AuditTrailExplorer } from '@/components/AuditTrailExplorer';
import { MethodologyGuide } from '@/components/MethodologyGuide';
import { JudgeModeModal } from '@/components/JudgeModeModal';

export default function Home() {
  const [isJudgeModeOpen, setIsJudgeModeOpen] = React.useState<boolean>(false);
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

  const handleReSimulate = () => {
    // Generate new random seed for simulation rerun
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
        onProvenanceChange={setProvenance}
        onOpenJudgeMode={() => setIsJudgeModeOpen(true)}
      />

      {/* ── Main Application Workspace ─────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* KPI Metrics Overview (Visible across workspaces) */}
        <MetricsOverview kpis={kpis} />

        {/* Workspace 1: Dashboard & Ranked Queue */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <CalibrationVisualizer
              calibration={batchResult.calibration}
              modelComparison={modelComparison}
              scoringModel={scoringModel}
              onScoringModelChange={setScoringModel}
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
      </main>

      {/* ── Explainable Decision Drill-Down & Reviewer Action Modal ── */}
      {selectedItem && (
        <PaymentDrilldownModal
          item={selectedItem}
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
        onNavigateTab={(tab) => setActiveTab(tab)}
        onSetProvenance={(prov) => setProvenance(prov)}
      />

      {/* ── Global Footer ───────────────────────────────────────── */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 py-6 text-xs text-center">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <p className="font-medium text-slate-300">
            PayBack AI — Autonomous Bounded Revenue Recovery Engine
          </p>
          <p className="text-slate-500">
            Submission for Razorpay AI Buildathon · Track 3: AI Revenue Recovery · Deterministic Calibration &amp; Cryptographic Audit Ledger
          </p>
        </div>
      </footer>
    </div>
  );
}
