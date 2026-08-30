/**
 * PayBack AI — Custom Hook for Recovery Batch State Management.
 *
 * Separates data orchestration and engine execution from UI components.
 */

'use client';

import { useState, useMemo } from 'react';
import type { FailedPayment, BatchExecutionResult, ExecutedItem } from '@/types';
import { runRecoveryBatch } from '@/lib/engine/runBatch';
import { generateSyntheticPayments } from '@/lib/engine/generateData';
import { generateAuditTrail, exportAuditTrailToCSV, type AuditRecord } from '@/lib/engine/auditTrail';

export type DashboardTab = 'dashboard' | 'calibration' | 'audit_trail';

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

  // Execute engine pipeline
  const batchResult: BatchExecutionResult = useMemo(() => {
    return runRecoveryBatch(payments, {
      budget,
      simulationSeed,
      autoApproveHighValueWithHighEV: true,
    });
  }, [payments, budget, simulationSeed]);

  // Generate audit trail
  const auditRecords: AuditRecord[] = useMemo(() => {
    return generateAuditTrail(batchResult.executed_items);
  }, [batchResult.executed_items]);

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

        // Search Query (Payment ID, Customer ID, Error string)
        if (searchQuery.trim() !== '') {
          const q = searchQuery.toLowerCase();
          const matchId = item.payment.payment_id.toLowerCase().includes(q);
          const matchCust = item.payment.customer_id.toLowerCase().includes(q);
          const matchErr = item.payment.raw_gateway_error.toLowerCase().includes(q);
          const matchCat = item.payment.failure_category.toLowerCase().includes(q);
          if (!matchId && !matchCust && !matchErr && !matchCat) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === 'rank') {
          const rA = a.rank ?? 9999;
          const rB = b.rank ?? 9999;
          cmp = rA - rB;
        } else if (sortField === 'expected_value') {
          cmp = b.score.expected_value - a.score.expected_value;
        } else if (sortField === 'amount') {
          cmp = b.payment.amount - a.payment.amount;
        } else if (sortField === 'recovery_probability') {
          cmp = b.score.recovery_probability - a.score.recovery_probability;
        }
        return sortAsc ? cmp : -cmp;
      });
  }, [batchResult.executed_items, statusFilter, categoryFilter, searchQuery, sortField, sortAsc]);

  // Derived KPI metrics
  const kpis = useMemo(() => {
    const executedBudgeted = batchResult.executed_items.filter(
      (i) => i.status === 'budgeted' || i.dispute_signaled,
    );
    const recoveredCount = batchResult.executed_items.filter(
      (i) => i.execution_status === 'recovered',
    ).length;
    const failedBudgetedCount = executedBudgeted.length - recoveredCount;
    const unnecessaryRetryRate =
      executedBudgeted.length > 0
        ? Number(((failedBudgetedCount / executedBudgeted.length) * 100).toFixed(1))
        : 0;

    const recoveredItems = batchResult.executed_items.filter((i) => i.execution_status === 'recovered');
    const avgAttemptsBeforeRecovery =
      recoveredItems.length > 0
        ? Number(
            (
              recoveredItems.reduce((s, i) => s + i.final_attempt_count, 0) /
              recoveredItems.length
            ).toFixed(1),
          )
        : 1.0;

    return {
      totalRevenueAtRisk: batchResult.total_revenue_at_risk,
      totalRevenueRecovered: batchResult.total_revenue_recovered,
      overallRecoveryRate: Number((batchResult.overall_recovery_rate * 100).toFixed(1)),
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
      deferredCount: batchResult.summary.deferred_count,
      budgetedEV: batchResult.summary.budgeted_expected_value,
      deferredEV: batchResult.summary.deferred_expected_value,
      pendingApprovalCount: batchResult.summary.pending_approval_count,
      stoppedCount: batchResult.summary.stopped_count,
      stoppedByReason: batchResult.summary.stopped_by_reason,
      customerContactCount: executedBudgeted.length,
      unnecessaryRetryRate,
      avgAttemptsBeforeRecovery,
    };
  }, [batchResult]);

  // Export handlers
  const handleExportCSV = () => {
    const csvContent = exportAuditTrailToCSV(auditRecords);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `payback-ai-audit-trail-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    const jsonContent = JSON.stringify(auditRecords, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `payback-ai-audit-trail-${Date.now()}.json`);
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
  };
}
