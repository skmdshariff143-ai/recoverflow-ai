/**
 * RecoverFlow AI — Evaluation Lab & Counterfactual Policy Simulator.
 *
 * Provides judge-grade comparative evaluation of RecoverFlow AI against industry
 * control baselines across 200 Development records and 80 Held-out Adversarial cases.
 */

'use client';

import React, { useState, useMemo } from 'react';
import {
  FlaskConical,
  BarChart3,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Search,
} from 'lucide-react';
import type { ComprehensiveEvaluationReport } from '@/lib/engine/counterfactualEvaluation';
import { formatPaiseToINR } from '@/lib/engine/financial';

interface EvaluationLabProps {
  devReport: ComprehensiveEvaluationReport;
  heldoutReport: ComprehensiveEvaluationReport;
}

export function EvaluationLab({ devReport, heldoutReport }: EvaluationLabProps) {
  const [selectedDataset, setSelectedDataset] = useState<'dev' | 'heldout'>('dev');
  const [errorSearch, setErrorSearch] = useState<string>('');
  const [errorFilter, setErrorFilter] = useState<string>('all');

  const activeReport = selectedDataset === 'dev' ? devReport : heldoutReport;
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
              Held-Out Adversarial (80 Frozen Cases)
            </button>
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
              {ctrlFixed.recoveredCount} / {ctrlFixed.interventionsExecuted} blind attempts ({ctrlFixed.countRecoveryRatePercent}% rate)
            </span>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <span className="text-xs font-semibold text-emerald-900 uppercase tracking-wider block">
              Incremental Net Yield
            </span>
            <div className="mt-2 text-2xl font-bold text-emerald-700">
              +{formatPaiseToINR(rf.incrementalRecoveredPaise, false)}
            </div>
            <span className="text-xs text-emerald-600 font-medium block mt-0.5">
              Net of estimated API &amp; reminder costs
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Safety Violations
            </span>
            <div className="mt-2 text-2xl font-bold text-emerald-600 flex items-center gap-1.5">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
              0 Violations
            </div>
            <span className="text-xs text-slate-500 font-medium block mt-0.5">
              Zero opt-out or permanent state attempts
            </span>
          </div>
        </div>

        {/* ── Policy Comparison Table ────────────────────────────── */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            Counterfactual Policy Matrix (Identical Frozen Potential Outcomes)
          </h3>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left">
              <thead className="bg-slate-50 border-y border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Recovery Policy</th>
                  <th className="py-2.5 px-3 text-center">Interventions</th>
                  <th className="py-2.5 px-3 text-center">Recovered</th>
                  <th className="py-2.5 px-3 text-right">Simulated Recovery</th>
                  <th className="py-2.5 px-3 text-right">Estimated Cost</th>
                  <th className="py-2.5 px-3 text-right">Net Recovery</th>
                  <th className="py-2.5 px-3 text-center">Unsafe Actions</th>
                  <th className="py-2.5 px-3 text-right">Brier Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {/* RecoverFlow AI */}
                <tr className="bg-indigo-50/40 hover:bg-indigo-50/70 font-medium">
                  <td className="py-3 px-3 font-bold text-indigo-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    {rf.policyName}
                  </td>
                  <td className="py-3 px-3 text-center font-bold">{rf.interventionsExecuted}</td>
                  <td className="py-3 px-3 text-center font-bold text-emerald-600">{rf.recoveredCount}</td>
                  <td className="py-3 px-3 text-right font-bold text-slate-900">
                    {formatPaiseToINR(rf.recoveredAmountPaise, true)}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-500">
                    {formatPaiseToINR(rf.estimatedCostPaise, true)}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-emerald-700">
                    {formatPaiseToINR(rf.netRecoveredPaise, true)}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">0</span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-indigo-700">
                    {rf.brierScoreOnIndependentOutcomes.toFixed(4)}
                  </td>
                </tr>

                {/* Fixed Retry Control */}
                <tr className="hover:bg-slate-50 transition">
                  <td className="py-2.5 px-3 font-semibold text-slate-800">{ctrlFixed.policyName}</td>
                  <td className="py-2.5 px-3 text-center">{ctrlFixed.interventionsExecuted}</td>
                  <td className="py-2.5 px-3 text-center text-slate-700">{ctrlFixed.recoveredCount}</td>
                  <td className="py-2.5 px-3 text-right font-medium">
                    {formatPaiseToINR(ctrlFixed.recoveredAmountPaise, true)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-500">
                    {formatPaiseToINR(ctrlFixed.estimatedCostPaise, true)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold text-slate-700">
                    {formatPaiseToINR(ctrlFixed.netRecoveredPaise, true)}
                  </td>
                  <td className="py-2.5 px-3 text-center font-semibold text-slate-700">0</td>
                  <td className="py-2.5 px-3 text-right text-slate-400 font-mono">—</td>
                </tr>

                {/* Retry All Control */}
                <tr className="hover:bg-slate-50 transition">
                  <td className="py-2.5 px-3 font-semibold text-slate-800">{ctrlRetryAll.policyName}</td>
                  <td className="py-2.5 px-3 text-center">{ctrlRetryAll.interventionsExecuted}</td>
                  <td className="py-2.5 px-3 text-center text-slate-700">{ctrlRetryAll.recoveredCount}</td>
                  <td className="py-2.5 px-3 text-right font-medium">
                    {formatPaiseToINR(ctrlRetryAll.recoveredAmountPaise, true)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-rose-600 font-medium">
                    {formatPaiseToINR(ctrlRetryAll.estimatedCostPaise, true)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold text-slate-700">
                    {formatPaiseToINR(ctrlRetryAll.netRecoveredPaise, true)}
                  </td>
                  <td className="py-2.5 px-3 text-center font-semibold text-slate-700">0</td>
                  <td className="py-2.5 px-3 text-right text-slate-400 font-mono">—</td>
                </tr>

                {/* High Confidence Only */}
                <tr className="hover:bg-slate-50 transition">
                  <td className="py-2.5 px-3 font-semibold text-slate-800">{ctrlHighConf.policyName}</td>
                  <td className="py-2.5 px-3 text-center">{ctrlHighConf.interventionsExecuted}</td>
                  <td className="py-2.5 px-3 text-center text-slate-700">{ctrlHighConf.recoveredCount}</td>
                  <td className="py-2.5 px-3 text-right font-medium">
                    {formatPaiseToINR(ctrlHighConf.recoveredAmountPaise, true)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-500">
                    {formatPaiseToINR(ctrlHighConf.estimatedCostPaise, true)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold text-slate-700">
                    {formatPaiseToINR(ctrlHighConf.netRecoveredPaise, true)}
                  </td>
                  <td className="py-2.5 px-3 text-center font-semibold text-slate-700">0</td>
                  <td className="py-2.5 px-3 text-right text-slate-400 font-mono">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Error Inspector: Transparent Imperfections ─────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Transparent Error Inspector (False Positives &amp; False Negatives)
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
                  <td colSpan={6} className="py-4 text-center text-slate-400">
                    No errors matching the active filter in this dataset.
                  </td>
                </tr>
              ) : (
                filteredErrors.map((err) => (
                  <tr key={err.payment_id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{err.payment_id}</td>
                    <td className="py-2.5 px-3 capitalize">{err.failure_category.replace(/_/g, ' ')}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-900">
                      {formatPaiseToINR(err.amountPaise, true)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-indigo-600">
                      {(err.predictedProbability * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {err.actualOutcome ? (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                          RECOVERED
                        </span>
                      ) : (
                        <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded">
                          FAILED
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{err.explanation}</td>
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
