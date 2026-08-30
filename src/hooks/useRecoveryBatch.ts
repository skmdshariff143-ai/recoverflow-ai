/**
 * RecoverFlow AI — Custom Hook for Recovery Batch & Evaluation State Management.
 *
 * Separates data orchestration, state machine evaluation, and audit ledger integrity from UI components.
 */

'use client';

import { useState, useMemo } from 'react';
import type { FailedPayment, BatchExecutionResult, ExecutedItem } from '@/types';
import { runRecoveryBatch } from '@/lib/engine/runBatch';
import { generateSyntheticPayments } from '@/lib/engine/generateData';
import { generateAuditTrail, exportAuditTrailToCSV, type AuditRecord } from '@/lib/engine/auditTrail';
import { compareModelCalibration } from '@/lib/engine/calibration';
import { buildFrozenOutcomeEnvironment } from '@/lib/engine/outcomeEnvironment';
import { evaluateCohortPolicies, type ComprehensiveEvaluationReport } from '@/lib/engine/counterfactualEvaluation';
import { buildHashChainedLedger, verifyLedgerIntegrity, type ChainedAuditRecord, type LedgerVerificationResult } from '@/lib/engine/hashChainLedger';

export type DashboardTab = 'dashboard' | 'evaluation' | 'audit_trail' | 'methodology';

export interface UseRecoveryBatchOptions {
  initialPayments?: FailedPayment[];
  initialBudget?: number;
  initialSeed?: number;
}

export function useRecoveryBatch(options: UseRecoveryBatchOptions = {}) {
  const [payments] = useState<FailedPayment[]>(() =>
    options.initialPayments ?? generateSyntheticPayments({ seed: 42, totalRecords: 100 }),
  );
  const [budget, setBudget] = useState<number>(options.initialBudget ?? 40);
  const [simulationSeed, setSimulationSeed] = useState<number>(options.initialSeed ?? 42);
  const [activeTab, setActiveTab] = useState<DashboardTab>('dashboard');
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);

  // Filters & Sorting for the Ranked Queue
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<'expected_value' | 'amount' | 'recovery_probability' | 'rank'>('rank');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const [scoringModel, setScoringModel] = useState<'heuristic' | 'trained_logistic'>('trained_logistic');
  const [provenance, setProvenance] = useState<'synthetic_fixture' | 'razorpay_test_mode' | 'imported_dataset'>('synthetic_fixture');

  // Execute engine pipeline
  const batchResult: BatchExecutionResult = useMemo(() => {
    return runRecoveryBatch(payments, {
      budget,
      simulationSeed,
      scoringModel,
      autoApproveHighValueWithHighEV: true,
    });
  }, [payments, budget, simulationSeed, scoringModel]);

  // Compute side-by-side model comparison
  const modelComparison = useMemo(() => {
    return compareModelCalibration(payments, {
      budget,
      simulationSeed,
      autoApproveHighValueWithHighEV: true,
    });
  }, [payments, budget, simulationSeed]);

  // Generate SHA-256 Hash-Chained Audit Ledger
  const auditRecords: AuditRecord[] = useMemo(() => {
    return generateAuditTrail(batchResult.executed_items);
  }, [batchResult.executed_items]);

  const chainedLedger: ChainedAuditRecord[] = useMemo(() => {
    return buildHashChainedLedger(auditRecords);
  }, [auditRecords]);

  const ledgerVerification: LedgerVerificationResult = useMemo(() => {
    return verifyLedgerIntegrity(chainedLedger);
  }, [chainedLedger]);

  // Generate 200-Dev and 80-Heldout Evaluation Lab Reports
  const devCohort = useMemo(() => generateSyntheticPayments({ seed: 101, totalRecords: 200 }), []);
  const heldoutCohort = useMemo(() => generateSyntheticPayments({ seed: 999, totalRecords: 80 }), []);

  const devOutcomes = useMemo(() => buildFrozenOutcomeEnvironment(devCohort, 202), [devCohort]);
  const heldoutOutcomes = useMemo(() => buildFrozenOutcomeEnvironment(heldoutCohort, 777), [heldoutCohort]);

  const devReport: ComprehensiveEvaluationReport = useMemo(() => {
    return evaluateCohortPolicies(devCohort, devOutcomes, { budget });
  }, [devCohort, devOutcomes, budget]);

  const heldoutReport: ComprehensiveEvaluationReport = useMemo(() => {
    return evaluateCohortPolicies(heldoutCohort, heldoutOutcomes, { budget });
  }, [heldoutCohort, heldoutOutcomes, budget]);

  // Selected item for drill-down modal
  const selectedItem: ExecutedItem | null = useMemo(() => {
    if (!selectedPaymentId) return null;
    return batchResult.executed_items.find((i) => i.payment.payment_id === selectedPaymentId) ?? null;
  }, [batchResult.executed_items, selectedPaymentId]);

  // Selected item's individual audit records
  const selectedItemAuditRecords: AuditRecord[] = useMemo(() => {
    if (!selectedPaymentId) return [];
    return auditRecords.filter((r) => r.payment_id === selectedPaymentId);
  }, [auditRecords, selectedPaymentId]);

  // Filtered and sorted queue items
  const filteredQueueItems: ExecutedItem[] = useMemo(() => {
    return batchResult.executed_items
      .filter((item) => {
        // Status Filter
        if (statusFilter !== 'all') {
          if (statusFilter === 'recovered' && item.execution_status !== 'recovered') return false;
          if (statusFilter === 'budgeted' && item.status !== 'budgeted') return false;
          if (statusFilter === 'deferred' && item.status !== 'deferred') return false;
          if (statusFilter === 'stopped' && item.status !== 'stopped') return false;
          if (statusFilter === 'pending_approval' && item.status !== 'pending_approval') return false;
          if (statusFilter === 'retry_scheduled' && item.execution_status !== 'retry_scheduled') return false;
        }

        // Category Filter
        if (categoryFilter !== 'all' && item.payment.failure_category !== categoryFilter) {
          return false;
        }

        // Search Query
        if (searchQuery.trim() !== '') {
          const q = searchQuery.toLowerCase();
          const matchId = item.payment.payment_id.toLowerCase().includes(q);
          const matchCust = item.payment.customer_id.toLowerCase().includes(q);
          const matchError = item.payment.raw_gateway_error.toLowerCase().includes(q);
          if (!matchId && !matchCust && !matchError) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let valA: number;
        let valB: number;

        if (sortField === 'expected_value') {
          valA = a.score.expected_value;
          valB = b.score.expected_value;
        } else if (sortField === 'amount') {
          valA = a.payment.amount;
          valB = b.payment.amount;
        } else if (sortField === 'recovery_probability') {
          valA = a.score.recovery_probability;
          valB = b.score.recovery_probability;
        } else {
          // Default: Rank
          valA = a.rank ?? 999;
          valB = b.rank ?? 999;
        }

        return sortAsc ? valA - valB : valB - valA;
      });
  }, [batchResult.executed_items, statusFilter, categoryFilter, searchQuery, sortField, sortAsc]);

  // Derived KPI metrics for headline cards
  const kpis = useMemo(() => {
    const totalRevAtRisk = batchResult.summary.total_revenue_at_risk;
    const totalRevRecovered = batchResult.executed_items.reduce(
      (sum, item) => sum + item.recovered_amount,
      0,
    );
    const overallRate =
      totalRevAtRisk > 0 ? (totalRevRecovered / totalRevAtRisk) * 100 : 0;

    const budgetedItems = batchResult.executed_items.filter((i) => i.status === 'budgeted');
    const recoveredBudgeted = budgetedItems.filter((i) => i.execution_status === 'recovered');

    const customerContacts = batchResult.executed_items.filter(
      (i) => i.final_attempt_count > i.payment.attempt_count,
    ).length;

    const unnecessaryRetries = budgetedItems.filter(
      (i) => i.execution_status !== 'recovered' && !i.dispute_signaled,
    ).length;

    const totalAttempts = recoveredBudgeted.reduce(
      (sum, i) => sum + (i.final_attempt_count - i.payment.attempt_count),
      0,
    );
    const avgAttempts =
      recoveredBudgeted.length > 0
        ? totalAttempts / recoveredBudgeted.length
        : 0;

    return {
      totalRevenueAtRisk: totalRevAtRisk,
      totalRevenueRecovered: totalRevRecovered,
      overallRecoveryRate: Number(overallRate.toFixed(1)),
      predictedRecoveryRate: Number(
        (batchResult.calibration.overall_predicted_rate * 100).toFixed(1),
      ),
      actualRecoveryRate: Number(
        (batchResult.calibration.overall_actual_rate * 100).toFixed(1),
      ),
      calibrationGap: Number(
        (batchResult.calibration.overall_calibration_error * 100).toFixed(1),
      ),
      brierScore: batchResult.calibration.brier_score,
      budgetedCount: batchResult.summary.budgeted_count,
      budgetedEV: batchResult.summary.budgeted_expected_value,
      deferredCount: batchResult.summary.deferred_count,
      deferredEV: batchResult.summary.deferred_expected_value,
      customerContactCount: customerContacts,
      unnecessaryRetryRate: Number(
        ((unnecessaryRetries / Math.max(1, budgetedItems.length)) * 100).toFixed(1),
      ),
      avgAttemptsBeforeRecovery: Number(avgAttempts.toFixed(2)),
      stoppedCount: batchResult.summary.stopped_count,
      stoppedByReason: batchResult.summary.stopped_by_reason,
    };
  }, [batchResult]);

  // Export handlers
  const handleExportCSV = () => {
    const csvContent = exportAuditTrailToCSV(auditRecords);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `recoverflow-audit-trail-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    const jsonContent = JSON.stringify(chainedLedger, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `recoverflow-audit-ledger-${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return {
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
    auditRecords,
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
    sortAsc,
    setSortAsc,
    // Exports
    handleExportCSV,
    handleExportJSON,
  };
}
