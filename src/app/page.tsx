/**
 * RecoverFlow AI — Main Control Center Application.
 *
 * Interactive Bounded Revenue Recovery, Evaluation Lab & Audit Control Center.
 */

'use client';

import React from 'react';
import { useRecoveryBatch } from '@/hooks/useRecoveryBatch';
import { Header } from '@/components/Header';
import { MetricsOverview } from '@/components/MetricsOverview';
import { RankedQueueTable } from '@/components/RankedQueueTable';
import { PaymentDrilldownModal } from '@/components/PaymentDrilldownModal';
import { AuditTrailExplorer } from '@/components/AuditTrailExplorer';
import { EvaluationLab } from '@/components/EvaluationLab';
import { MethodologyGuide } from '@/components/MethodologyGuide';

export default function Home() {
  const {
    budget,
    setBudget,
    simulationSeed,
    setSimulationSeed,
    provenance,
    setProvenance,
    activeTab,
    setActiveTab,
    setSelectedPaymentId,
    selectedItem,
    selectedItemAuditRecords,
    batchResult,
    chainedLedger,
    ledgerVerification,
    devReport,
    heldoutReport,
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
      />

      {/* ── Main Application Workspace ─────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* KPI Metrics Overview (Visible across workspaces) */}
        <MetricsOverview kpis={kpis} />

        {/* Workspace 1: Dashboard & Ranked Queue */}
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
              onSortAscToggle={() => setSortAsc((prev) => !prev)}
              onSelectPayment={(id) => setSelectedPaymentId(id)}
            />
          </div>
        )}

        {/* Workspace 2: Evaluation Lab & Policy Simulator */}
        {activeTab === 'evaluation' && (
          <EvaluationLab
            devReport={devReport}
            heldoutReport={heldoutReport}
          />
        )}

        {/* Workspace 3: Append-Only Cryptographic Audit Ledger */}
        {activeTab === 'audit_trail' && (
          <AuditTrailExplorer
            records={chainedLedger}
            verification={ledgerVerification}
            onExportCSV={handleExportCSV}
            onExportJSON={handleExportJSON}
            onSelectPayment={(id) => setSelectedPaymentId(id)}
          />
        )}

        {/* Workspace 4: Methodology & Judge Guide */}
        {activeTab === 'methodology' && (
          <MethodologyGuide />
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
            RecoverFlow AI — Razorpay AI Buildathon (Track 3: AI Revenue Recovery)
          </span>
          <span className="font-mono text-slate-400">
            Next.js 16 · Turbopack · SHA-256 Ledger · Bounded Gemini 2.5
          </span>
        </div>
      </footer>
    </div>
  );
}
