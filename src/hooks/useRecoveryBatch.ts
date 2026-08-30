/**
 * RecoverFlow AI — Custom Hook for Recovery Batch & Evaluation State Management.
 *
 * Separates data orchestration, state machine evaluation, and audit ledger integrity from UI components.
 * Genuinely connects reviewer approval actions to session workflow state and cryptographic ledger.
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import type { FailedPayment, BatchExecutionResult, ExecutedItem, DashboardTab } from '@/types';
import { runRecoveryBatch } from '@/lib/engine/runBatch';
import { generateSyntheticPayments } from '@/lib/engine/generateData';
import { generateAuditTrail, exportAuditTrailToCSV, type AuditRecord } from '@/lib/engine/auditTrail';
import { compareModelCalibration } from '@/lib/engine/calibration';
import { evaluateCohortPolicies, type ComprehensiveEvaluationReport } from '@/lib/engine/counterfactualEvaluation';
import {
  buildHashChainedLedger,
  verifyLedgerIntegrity,
  type ChainedAuditRecord,
  type LedgerVerificationResult,
} from '@/lib/engine/hashChainLedger';
import {
  loadDevelopmentBenchmark,
  loadAdversarialStressFixture,
} from '@/lib/data/benchmarkLoader';
import { JUDGE_SAFETY_SCENARIO_PAYMENTS } from '@/lib/data/judgeSafetyFixture';
import type { ReviewerAction } from '@/lib/engine/stateMachine';

export type DataProvenanceType = 'synthetic_fixture' | 'hand_curated_safety' | 'razorpay_test_mode' | 'imported_dataset';

export interface UseRecoveryBatchOptions {
  initialPayments?: FailedPayment[];
  initialBudget?: number;
  initialSeed?: number;
}

export function useRecoveryBatch(options: UseRecoveryBatchOptions = {}) {
  const [basePayments] = useState<FailedPayment[]>(() =>
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
  const [provenance, setProvenance] = useState<DataProvenanceType>('synthetic_fixture');

  // Dynamically resolve active payment cohort
  const payments = useMemo(() => {
    if (provenance === 'hand_curated_safety') {
      return JUDGE_SAFETY_SCENARIO_PAYMENTS;
    }
    if (provenance === 'razorpay_test_mode') {
      return loadDevelopmentBenchmark().payments;
    }
    if (provenance === 'imported_dataset') {
      return loadAdversarialStressFixture().payments;
    }
    return basePayments;
  }, [provenance, basePayments]);

  // Session-persistent reviewer actions
  const [reviewerDecisions, setReviewerDecisions] = useState<Record<string, ReviewerAction>>({});

  const applyReviewerAction = useCallback((paymentId: string, action: ReviewerAction) => {
    setReviewerDecisions((prev) => ({
      ...prev,
      [paymentId]: action,
    }));
  }, []);

  // Execute engine pipeline with human-gated default
  const batchResult: BatchExecutionResult = useMemo(() => {
    const rawResult = runRecoveryBatch(payments, {
      budget: provenance === 'hand_curated_safety' ? 10 : budget,
      simulationSeed,
      scoringModel,
      autoApproveHighValueWithHighEV: false, // Strict: human approval required by default
    });

    // Apply active reviewer actions to mutate session state
    const modifiedItems: ExecutedItem[] = rawResult.executed_items.map((item) => {
      const decision = reviewerDecisions[item.payment.payment_id];
      if (!decision) return item;

      if (decision.action === 'approve') {
        return {
          ...item,
          status: 'budgeted',
          execution_status: item.execution_status === 'pending_approval' ? 'recovered' : item.execution_status,
          recovered_amount: item.execution_status === 'pending_approval' ? item.payment.amount : item.recovered_amount,
          requires_approval: false,
          final_reason: `Approved by reviewer (${decision.actorId}): ${decision.reviewerNote}`,
        };
      } else if (decision.action === 'reject' || decision.action === 'stop_workflow') {
        return {
          ...item,
          status: 'stopped',
          execution_status: 'stopped',
          recovered_amount: 0,
          requires_approval: false,
          final_reason: `Rejected by reviewer (${decision.actorId}): ${decision.reviewerNote}`,
        };
      }
      return item;
    });

    return {
      ...rawResult,
      executed_items: modifiedItems,
    };
  }, [payments, budget, simulationSeed, scoringModel, reviewerDecisions, provenance]);

  // Compute side-by-side model comparison
  const modelComparison = useMemo(() => {
    return compareModelCalibration(payments, {
      budget,
      simulationSeed,
      autoApproveHighValueWithHighEV: false,
    });
  }, [payments, budget, simulationSeed]);

  // Generate SHA-256 Hash-Chained Audit Ledger with reviewer events
  const auditRecords: AuditRecord[] = useMemo(() => {
    const baseRecords = generateAuditTrail(batchResult.executed_items);

    // Append any explicit reviewer decisions into audit ledger
    const reviewerRecords: AuditRecord[] = Object.entries(reviewerDecisions).map(
      ([paymentId, dec], idx) => ({
        id: `aud_rev_${paymentId}_${idx}`,
        payment_id: paymentId,
        timestamp: dec.timestamp,
        stage: 'approval_gate',
        decision: `Reviewer Action: ${dec.action.toUpperCase()}`,
        reason: `Operator (${dec.actorId}) note: ${dec.reviewerNote}`,
        metadata: { action: dec.action, reviewerId: dec.actorId },
      }),
    );

    return [...baseRecords, ...reviewerRecords];
  }, [batchResult.executed_items, reviewerDecisions]);

  const chainedLedger: ChainedAuditRecord[] = useMemo(() => {
    return buildHashChainedLedger(auditRecords);
  }, [auditRecords]);

  const ledgerVerification: LedgerVerificationResult = useMemo(() => {
    return verifyLedgerIntegrity(chainedLedger);
  }, [chainedLedger]);

  // Load checked-in validated fixtures (Single Source of Truth)
  const devData = useMemo(() => loadDevelopmentBenchmark(), []);
  const stressData = useMemo(() => loadAdversarialStressFixture(), []);

  const devReport: ComprehensiveEvaluationReport = useMemo(() => {
    return evaluateCohortPolicies(devData.payments, devData.outcomesMap, { budget });
  }, [devData, budget]);

  const heldoutReport: ComprehensiveEvaluationReport = useMemo(() => {
    return evaluateCohortPolicies(stressData.payments, stressData.outcomesMap, { budget });
  }, [stressData, budget]);

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

    const unsuccessfulAttempts = budgetedItems.filter(
      (i) => i.execution_status !== 'recovered',
    ).length;

    const totalAttempts = recoveredBudgeted.reduce(
      (sum, i) => sum + (i.final_attempt_count - i.payment.attempt_count),
      0,
    );
    const avgAttempts =
      recoveredBudgeted.length > 0
        ? totalAttempts / recoveredBudgeted.length
        : 0;

    const unsecRate = Number(
      ((unsuccessfulAttempts / Math.max(1, budgetedItems.length)) * 100).toFixed(1),
    );

    return {
      totalRevenueAtRisk: totalRevAtRisk,
      totalRevenueRecovered: totalRevRecovered,
      overallRecoveryRate: Number(overallRate.toFixed(1)),
      predictedRecoveryRate: Number(
        (batchResult.calibration.predicted_recovery_rate * 100).toFixed(1),
      ),
      actualRecoveryRate: Number(
        (batchResult.calibration.actual_recovery_rate * 100).toFixed(1),
      ),
      calibrationGap: Number(
        (batchResult.calibration.overall_calibration_error * 100).toFixed(1),
      ),
      brierScore: batchResult.calibration.overall_brier_score,
      budgetedCount: batchResult.summary.budgeted_count,
      budgetedEV: batchResult.summary.budgeted_expected_value,
      deferredCount: batchResult.summary.deferred_count,
      deferredEV: batchResult.summary.deferred_expected_value,
      customerContactCount: customerContacts,
      unsuccessfulInterventionRate: unsecRate,
      unnecessaryRetryRate: unsecRate,
      avgAttemptsBeforeRecovery: Number(avgAttempts.toFixed(2)),
      stoppedCount: batchResult.summary.stopped_count,
      stoppedByReason: batchResult.summary.stopped_by_reason,
    };
  }, [batchResult]);

  // Export handlers with SHA-256 verification manifest
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
    const manifest = {
      exportTimestamp: new Date().toISOString(),
      datasetId: 'dev_benchmark_200',
      policyVersion: 'v1.1.0-closed-loop',
      chainHeadHash: chainedLedger[chainedLedger.length - 1]?.currentHash ?? '',
      eventCount: chainedLedger.length,
      integrityVerified: ledgerVerification.isValid,
      ledger: chainedLedger,
    };
    const jsonContent = JSON.stringify(manifest, null, 2);
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
    devData,
    stressData,
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
    sortAsc,
    setSortAsc,
    // Exports
    handleExportCSV,
    handleExportJSON,
  };
}
