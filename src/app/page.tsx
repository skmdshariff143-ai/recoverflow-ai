/**
 * PayBack AI — Main Dashboard Application.
 *
 * Interactive Revenue Recovery & Calibration Dashboard.
 */

'use client';

import React from 'react';
import { useRecoveryBatch } from '@/hooks/useRecoveryBatch';
import { Header } from '@/components/Header';
import { MetricsOverview } from '@/components/MetricsOverview';
import { CalibrationVisualizer } from '@/components/CalibrationVisualizer';
import { RankedQueueTable } from '@/components/RankedQueueTable';
import { PaymentDrilldownModal } from '@/components/PaymentDrilldownModal';
import { AuditTrailExplorer } from '@/components/AuditTrailExplorer';

export default function Home() {
  const {
    budget,
    setBudget,
    simulationSeed,
    setSimulationSeed,
    scoringModel,
    setScoringModel,
    modelComparison,
    activeTab,
    setActiveTab,
    selectedPaymentId,
    setSelectedPaymentId,
    selectedItem,
    selectedItemAuditRecords,
    batchResult,
    auditRecords,
    filteredQueueItems,
    kpis,
    // Filters
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    searchQuery,
    setSearchQuery,
    sortField,
    setSortField,
    sortAsc,
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
      />

      {/* ── Main Application Workspace ─────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* KPI Metrics Overview (Visible on all views) */}
        <MetricsOverview kpis={kpis} />

        {/* Tab 1: Dashboard & Ranked Queue */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
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
              sortAsc={sortAsc}
              onSortAscToggle={() => setSortAsc(!sortAsc)}
              onSelectPayment={(id) => setSelectedPaymentId(id)}
            />
          </div>
        )}

        {/* Tab 2: Probabilistic Calibration Report */}
        {activeTab === 'calibration' && (
          <CalibrationVisualizer
            calibration={batchResult.calibration}
            modelComparison={modelComparison}
            scoringModel={scoringModel}
            onScoringModelChange={setScoringModel}
          />
        )}

        {/* Tab 3: Immutable Audit Trail Explorer */}
        {activeTab === 'audit_trail' && (
          <AuditTrailExplorer
            records={auditRecords}
            onExportCSV={handleExportCSV}
            onExportJSON={handleExportJSON}
            onSelectPayment={(id) => setSelectedPaymentId(id)}
          />
        )}
      </main>

      {/* ── Explainability Decision Drill-Down Modal ───────────── */}
      {selectedItem && (
        <PaymentDrilldownModal
          item={selectedItem}
          auditRecords={selectedItemAuditRecords}
          onClose={() => setSelectedPaymentId(null)}
        />
      )}

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            PayBack AI — Razorpay AI Buildathon (Track 3: AI Revenue Recovery)
          </span>
          <span className="font-mono text-slate-400">
            Next.js 16 · Turbopack · Deterministic Calibration Engine
          </span>
        </div>
      </footer>
    </div>
  );
}
