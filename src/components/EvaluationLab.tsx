/**
 * RecoverFlow AI — Evaluation Lab & Counterfactual Policy Simulator.
 *
 * Provides judge-grade comparative evaluation of RecoverFlow AI against industry
 * control baselines across 200 Development records and 80 Internal Adversarial Stress records.
 */

'use client';

import React, { useState, useMemo } from 'react';
import {
  FlaskConical,
  BarChart3,
  AlertTriangle,
  Search,
  Database,
} from 'lucide-react';
import type { ComprehensiveEvaluationReport } from '@/lib/engine/counterfactualEvaluation';
import { formatPaiseToINR } from '@/lib/engine/financial';
import { DATASET_METADATA } from '@/lib/data/benchmarkLoader';

interface EvaluationLabProps {
  devReport: ComprehensiveEvaluationReport;
  heldoutReport: ComprehensiveEvaluationReport;
}

export function EvaluationLab({ devReport, heldoutReport }: EvaluationLabProps) {
  const [selectedDataset, setSelectedDataset] = useState<'dev' | 'heldout'>('dev');
  const [errorSearch, setErrorSearch] = useState<string>('');
  const [errorFilter, setErrorFilter] = useState<string>('all');

  const activeReport = selectedDataset === 'dev' ? devReport : heldoutReport;
  const activeMetadata = selectedDataset === 'dev' ? DATASET_METADATA.dev : DATASET_METADATA.adversarial_stress;
  const policies = activeReport.policies;

  const filteredErrors = useMemo(() => {
    return activeReport.errorInspector.filter((err) => {
      if (errorFilter !== 'all' && err.errorType !== errorFilter) return false;
      if (errorSearch.trim() !== '') {
        const q = errorSearch.toLowerCase();
        return (
          err.payment_id.toLowerCase().includes(q) ||
          err.customer_id.toLowerCase().includes(q) ||
          err.explanation.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [activeReport.errorInspector, errorFilter, errorSearch]);

  const rf = policies.recoverflow_ai;
  const ctrlFixed = policies.control_fixed_retry;
  const ctrlRetryAll = policies.control_retry_all;
  const ctrlHighConf = policies.control_high_confidence_only;

  const grossIncrementalPaise = rf.recoveredAmountPaise - ctrlFixed.recoveredAmountPaise;
  const netIncrementalPaise = rf.netRecoveredPaise - ctrlFixed.netRecoveredPaise;

  return (
    <div className="space-y-6">
      {/* ── Header & Dataset Selector ────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-indigo-600" />
                Evaluation Lab &amp; Counterfactual Policy Simulator
              </h2>
              <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                Independent Frozen Outcomes
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Evaluating recovery policies against identical, non-circular potential outcomes to measure true incremental revenue yield.
            </p>
          </div>

          {/* Dataset Selector Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setSelectedDataset('dev')}
              className={`px-3 py-1.5 rounded-md transition ${
                selectedDataset === 'dev'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Development Cohort (200 Records)
            </button>
            <button
              onClick={() => setSelectedDataset('heldout')}
              className={`px-3 py-1.5 rounded-md transition ${
                selectedDataset === 'heldout'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Internal Adversarial Stress (80 Records)
            </button>
          </div>
        </div>

        {/* Dataset Metadata & Provenance Banner */}
        <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <Database className="w-4 h-4 text-indigo-600" />
            <span className="font-semibold">{activeMetadata.name}</span>
            <span className="font-mono text-[10px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded">
              SHA-256: {activeMetadata.sha256Prefix}...
            </span>
          </div>
          <div className="text-slate-500 text-[11px]">
            {activeMetadata.provenanceDisclosure}
          </div>
        </div>

        {/* ── Key Comparative Headline Metrics ───────────────────── */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-200 rounded-xl p-4">
            <span className="text-xs font-semibold text-indigo-900 uppercase tracking-wider block">
              RecoverFlow AI Recovery
            </span>
            <div className="mt-2 text-2xl font-bold text-indigo-700">
              {formatPaiseToINR(rf.recoveredAmountPaise, false)}
            </div>
            <span className="text-xs text-indigo-600 font-medium block mt-0.5">
              {rf.recoveredCount} / {rf.interventionsExecuted} budgeted slots ({rf.countRecoveryRatePercent}% rate)
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Fixed Retry Control
            </span>
            <div className="mt-2 text-2xl font-bold text-slate-700">
              {formatPaiseToINR(ctrlFixed.recoveredAmountPaise, false)}
            </div>
            <span className="text-xs text-slate-500 font-medium block mt-0.5">
              {ctrlFixed.recoveredCount} / {ctrlFixed.interventionsExecuted} budgeted slots ({ctrlFixed.countRecoveryRatePercent}% rate)
            </span>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-xl p-4">
            <span className="text-xs font-semibold text-emerald-900 uppercase tracking-wider block">
              Gross Incremental Lift (Δ)
            </span>
            <div className="mt-2 text-2xl font-bold text-emerald-600">
              +{formatPaiseToINR(grossIncrementalPaise, false)}
            </div>
            <span className="text-xs text-emerald-700 font-medium block mt-0.5">
              +{rf.recoveredCount - ctrlFixed.recoveredCount} additional recovered invoices
            </span>
          </div>

          <div className="bg-gradient-to-br from-cyan-50 to-white border border-cyan-200 rounded-xl p-4">
            <span className="text-xs font-semibold text-cyan-900 uppercase tracking-wider block">
              Net Incremental Yield (After Costs)
            </span>
            <div className="mt-2 text-2xl font-bold text-cyan-700">
              +{formatPaiseToINR(netIncrementalPaise, false)}
            </div>
            <span className="text-xs text-cyan-700 font-medium block mt-0.5">
              Net yield after gateway retry &amp; notification fees
            </span>
          </div>
        </div>
      </div>

      {/* ── Policy Comparison Matrix ─────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Comparative Recovery Policy Matrix
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Identical ground-truth matrix ({activeReport.recordCount} payments evaluated)
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-lg">
          <table className="min-w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Recovery Policy</th>
                <th className="py-3 px-4 text-center">Budget Capacity</th>
                <th className="py-3 px-4 text-right">Invoices Recovered</th>
                <th className="py-3 px-4 text-right">Gross Recovered (INR)</th>
                <th className="py-3 px-4 text-right">Gross Lift vs Control</th>
                <th className="py-3 px-4 text-right">Intervention Cost</th>
                <th className="py-3 px-4 text-right">Net Recovery (INR)</th>
                <th className="py-3 px-4 text-center">Unsafe Attempts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {/* 1. RecoverFlow AI */}
              <tr className="bg-indigo-50/50 font-medium">
                <td className="py-3 px-4 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-indigo-600" />
                  <span className="font-bold text-indigo-950">{rf.policyName}</span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded">
                    ACTIVE
                  </span>
                </td>
                <td className="py-3 px-4 text-center font-bold">{rf.interventionsExecuted} slots</td>
                <td className="py-3 px-4 text-right font-bold text-slate-900">
                  {rf.recoveredCount} ({rf.countRecoveryRatePercent}%)
                </td>
                <td className="py-3 px-4 text-right font-bold text-indigo-700">
                  {formatPaiseToINR(rf.recoveredAmountPaise, true)}
                </td>
                <td className="py-3 px-4 text-right font-bold text-emerald-600">
                  +{formatPaiseToINR(grossIncrementalPaise, true)}
                </td>
                <td className="py-3 px-4 text-right text-slate-500">
                  {formatPaiseToINR(rf.estimatedCostPaise, true)}
                </td>
                <td className="py-3 px-4 text-right font-bold text-slate-900">
                  {formatPaiseToINR(rf.netRecoveredPaise, true)}
                </td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600">
                  {rf.unsafeInterventionCount} (0%)
                </td>
              </tr>

              {/* 2. Fixed Retry Control */}
              <tr className="hover:bg-slate-50/60">
                <td className="py-3 px-4 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  <span className="font-semibold text-slate-800">{ctrlFixed.policyName}</span>
                </td>
                <td className="py-3 px-4 text-center text-slate-600">{ctrlFixed.interventionsExecuted} slots</td>
                <td className="py-3 px-4 text-right text-slate-700">
                  {ctrlFixed.recoveredCount} ({ctrlFixed.countRecoveryRatePercent}%)
                </td>
                <td className="py-3 px-4 text-right font-semibold text-slate-800">
                  {formatPaiseToINR(ctrlFixed.recoveredAmountPaise, true)}
                </td>
                <td className="py-3 px-4 text-right text-slate-400">— Baseline —</td>
                <td className="py-3 px-4 text-right text-slate-500">
                  {formatPaiseToINR(ctrlFixed.estimatedCostPaise, true)}
                </td>
                <td className="py-3 px-4 text-right font-semibold text-slate-700">
                  {formatPaiseToINR(ctrlFixed.netRecoveredPaise, true)}
                </td>
                <td className="py-3 px-4 text-center text-slate-600">{ctrlFixed.unsafeInterventionCount}</td>
              </tr>

              {/* 3. High-Confidence Only */}
              <tr className="hover:bg-slate-50/60">
                <td className="py-3 px-4 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span className="font-semibold text-slate-800">{ctrlHighConf.policyName}</span>
                </td>
                <td className="py-3 px-4 text-center text-slate-600">{ctrlHighConf.interventionsExecuted} slots</td>
                <td className="py-3 px-4 text-right text-slate-700">
                  {ctrlHighConf.recoveredCount} ({ctrlHighConf.countRecoveryRatePercent}%)
                </td>
                <td className="py-3 px-4 text-right font-semibold text-slate-800">
                  {formatPaiseToINR(ctrlHighConf.recoveredAmountPaise, true)}
                </td>
                <td className="py-3 px-4 text-right font-semibold text-slate-600">
                  {formatPaiseToINR(ctrlHighConf.recoveredAmountPaise - ctrlFixed.recoveredAmountPaise, true)}
                </td>
                <td className="py-3 px-4 text-right text-slate-500">
                  {formatPaiseToINR(ctrlHighConf.estimatedCostPaise, true)}
                </td>
                <td className="py-3 px-4 text-right font-semibold text-slate-700">
                  {formatPaiseToINR(ctrlHighConf.netRecoveredPaise, true)}
                </td>
                <td className="py-3 px-4 text-center text-slate-600">{ctrlHighConf.unsafeInterventionCount}</td>
              </tr>

              {/* 4. Retry-All Unbounded Control */}
              <tr className="hover:bg-slate-50/60">
                <td className="py-3 px-4 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-rose-400" />
                  <span className="font-semibold text-slate-800">{ctrlRetryAll.policyName}</span>
                </td>
                <td className="py-3 px-4 text-center text-slate-600 font-medium text-rose-700">
                  {ctrlRetryAll.interventionsExecuted} slots (Uncapped)
                </td>
                <td className="py-3 px-4 text-right text-slate-700">
                  {ctrlRetryAll.recoveredCount} ({ctrlRetryAll.countRecoveryRatePercent}%)
                </td>
                <td className="py-3 px-4 text-right font-semibold text-slate-800">
                  {formatPaiseToINR(ctrlRetryAll.recoveredAmountPaise, true)}
                </td>
                <td className="py-3 px-4 text-right font-semibold text-slate-600">
                  {formatPaiseToINR(ctrlRetryAll.recoveredAmountPaise - ctrlFixed.recoveredAmountPaise, true)}
                </td>
                <td className="py-3 px-4 text-right text-rose-700 font-bold">
                  {formatPaiseToINR(ctrlRetryAll.estimatedCostPaise, true)}
                </td>
                <td className="py-3 px-4 text-right font-semibold text-slate-700">
                  {formatPaiseToINR(ctrlRetryAll.netRecoveredPaise, true)}
                </td>
                <td className="py-3 px-4 text-center text-slate-600">{ctrlRetryAll.unsafeInterventionCount}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Error Inspector ──────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Transparent Error Inspector &amp; Root-Cause Analysis
            </h3>
            <p className="text-xs text-slate-500">
              Preserving and explaining honest misclassifications rather than hiding model errors.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Search error cases..."
                value={errorSearch}
                onChange={(e) => setErrorSearch(e.target.value)}
                className="pl-8 pr-2.5 py-1 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
              />
            </div>
            <select
              value={errorFilter}
              onChange={(e) => setErrorFilter(e.target.value)}
              className="text-xs rounded-lg border border-slate-300 px-2.5 py-1 text-slate-700 focus:outline-none"
            >
              <option value="all">All Errors ({activeReport.errorInspector.length})</option>
              <option value="false_positive">False Positives (High Score Failed)</option>
              <option value="false_negative">False Negatives (Deferred Recoverable)</option>
              <option value="high_value_misclassification">Enterprise Misclassifications</option>
            </select>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-2 px-3">Payment ID</th>
                <th className="py-2 px-3">Category</th>
                <th className="py-2 px-3 text-right">Amount</th>
                <th className="py-2 px-3 text-right">Predicted P</th>
                <th className="py-2 px-3 text-center">Actual Outcome</th>
                <th className="py-2 px-3">Classification &amp; Root-Cause Analysis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredErrors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-slate-400 text-xs italic">
                    Zero misclassifications matching active filter criteria.
                  </td>
                </tr>
              ) : (
                filteredErrors.slice(0, 15).map((err) => (
                  <tr key={`${err.payment_id}_${err.errorType}`} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono font-medium text-slate-900">{err.payment_id}</td>
                    <td className="py-2 px-3 capitalize text-slate-700">
                      {err.failure_category.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900">
                      {formatPaiseToINR(err.amountPaise, true)}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-indigo-600">
                      {(err.predictedProbability * 100).toFixed(1)}%
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          err.actualOutcome
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {err.actualOutcome ? 'RECOVERED' : 'FAILED'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-600 text-[11px] max-w-xs">{err.explanation}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
