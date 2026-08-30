/**
 * RecoverFlow AI — Counterfactual Evaluation Lab Workspace.
 *
 * Provides a rigorous, independent comparative evaluation of RecoverFlow AI's
 * Expected Value dynamic policy against 6 alternative baselines on identical frozen
 * ground-truth potential outcome matrices, plus a transparent error inspector.
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

export function EvaluationLab({
  devReport,
  heldoutReport,
}: EvaluationLabProps) {
  const [selectedDataset, setSelectedDataset] = useState<'dev' | 'heldout'>('dev');
  const [errorFilter, setErrorFilter] = useState<'all' | 'false_positive' | 'false_negative' | 'unsafe_attempt' | 'high_value_misclassification'>('all');
  const [errorSearch, setErrorSearch] = useState<string>('');

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
  const ctrlHighAmount = policies.control_highest_amount;
  const ctrlHighProb = policies.control_highest_probability;
  const ctrlFixed = policies.control_fixed_retry;
  const ctrlRandom = policies.control_random_eligible;
  const ctrlRetryAll = policies.control_retry_all;
  const ctrlNoAction = policies.control_no_action;

  const grossIncrementalPaise = rf.recoveredAmountPaise - ctrlFixed.recoveredAmountPaise;
  const netIncrementalPaise = rf.netRecoveredPaise - ctrlFixed.netRecoveredPaise;

  const allPoliciesList = [
    { item: rf, isPrimary: true, tag: 'EQUAL BUDGET', tagColor: 'bg-indigo-100 text-indigo-800' },
    { item: ctrlHighAmount, isPrimary: false, tag: 'EQUAL BUDGET', tagColor: 'bg-slate-100 text-slate-700' },
    { item: ctrlHighProb, isPrimary: false, tag: 'EQUAL BUDGET', tagColor: 'bg-slate-100 text-slate-700' },
    { item: ctrlFixed, isPrimary: false, tag: 'EQUAL BUDGET (BASELINE)', tagColor: 'bg-slate-200 text-slate-800 font-bold' },
    { item: ctrlRandom, isPrimary: false, tag: 'EQUAL BUDGET', tagColor: 'bg-slate-100 text-slate-700' },
    { item: ctrlRetryAll, isPrimary: false, tag: 'UNEQUAL CAPACITY (UNCAPPED)', tagColor: 'bg-rose-100 text-rose-800' },
    { item: ctrlNoAction, isPrimary: false, tag: 'ZERO CAPACITY', tagColor: 'bg-slate-100 text-slate-500' },
  ];

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

      {/* ── Policy Comparison Matrix (7 Policies) ────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Comparative Recovery Policy Matrix (7 Evaluated Policies)
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
                <th className="py-3 px-4 text-center">Capacity Constraint</th>
                <th className="py-3 px-4 text-right">Invoices Recovered</th>
                <th className="py-3 px-4 text-right">Gross Recovered (INR)</th>
                <th className="py-3 px-4 text-right">Gross Lift vs Control</th>
                <th className="py-3 px-4 text-right">Intervention Cost</th>
                <th className="py-3 px-4 text-right">Net Recovery (INR)</th>
                <th className="py-3 px-4 text-center">Unsafe Attempts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {allPoliciesList.map(({ item, isPrimary, tag, tagColor }) => {
                if (!item) return null;
                const isBaseline = item.policy === 'control_fixed_retry';
                const liftPaise = item.recoveredAmountPaise - ctrlFixed.recoveredAmountPaise;

                return (
                  <tr
                    key={item.policy}
                    className={
                      isPrimary
                        ? 'bg-indigo-50/60 font-medium'
                        : isBaseline
                          ? 'bg-slate-50/80 font-medium'
                          : 'hover:bg-slate-50/50'
                    }
                  >
                    <td className="py-3 px-4 flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isPrimary
                            ? 'bg-indigo-600'
                            : isBaseline
                              ? 'bg-slate-500'
                              : 'bg-slate-300'
                        }`}
                      />
                      <span className={isPrimary ? 'font-bold text-indigo-950' : 'font-semibold text-slate-800'}>
                        {item.policyName}
                      </span>
                      {isPrimary && (
                        <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded">
                          ACTIVE
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${tagColor}`}>
                        {tag}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {item.recoveredCount} ({item.countRecoveryRatePercent}%)
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-indigo-700">
                      {formatPaiseToINR(item.recoveredAmountPaise, true)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold">
                      {isBaseline ? (
                        <span className="text-slate-400 font-normal">— Baseline —</span>
                      ) : liftPaise >= 0 ? (
                        <span className="text-emerald-600">+{formatPaiseToINR(liftPaise, true)}</span>
                      ) : (
                        <span className="text-rose-600">-{formatPaiseToINR(Math.abs(liftPaise), true)}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500">
                      {formatPaiseToINR(item.estimatedCostPaise, true)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatPaiseToINR(item.netRecoveredPaise, true)}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-emerald-600">
                      {item.unsafeInterventionCount} ({item.optOutViolations} opt-out)
                    </td>
                  </tr>
                );
              })}
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

            {/* Error type filter buttons */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              {(['all', 'false_positive', 'false_negative', 'high_value_misclassification', 'unsafe_attempt'] as const).map(
                (filter) => (
                  <button
                    key={filter}
                    onClick={() => setErrorFilter(filter)}
                    className={`px-2.5 py-1 rounded-md text-[11px] capitalize transition ${
                      errorFilter === filter
                        ? 'bg-white font-bold text-indigo-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {filter.replace(/_/g, ' ')}
                  </button>
                ),
              )}
            </div>
          </div>
        </div>

        {/* Error Items List */}
        <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
          {filteredErrors.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
              Zero errors found matching the current filter in this benchmark cohort.
            </div>
          ) : (
            filteredErrors.map((err) => (
              <div
                key={`${err.payment_id}_${err.errorType}`}
                className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900">{err.payment_id}</span>
                    <span className="text-slate-400 font-mono">({err.customer_id})</span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        err.errorType === 'false_positive'
                          ? 'bg-rose-100 text-rose-800'
                          : err.errorType === 'false_negative'
                            ? 'bg-amber-100 text-amber-800'
                            : err.errorType === 'high_value_misclassification'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-red-200 text-red-900'
                      }`}
                    >
                      {err.errorType.replace(/_/g, ' ')}
                    </span>
                    <span className="text-slate-500 font-medium capitalize">
                      Category: {err.failure_category.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px]">{err.explanation}</p>
                </div>

                <div className="text-right sm:min-w-[150px]">
                  <div className="font-bold text-slate-900">{formatPaiseToINR(err.amountPaise, true)}</div>
                  <div className="text-[11px] text-slate-500">
                    Pred: {(err.predictedProbability * 100).toFixed(1)}% | Actual:{' '}
                    <strong className={err.actualOutcome ? 'text-emerald-600' : 'text-rose-600'}>
                      {err.actualOutcome ? 'Settled' : 'Failed'}
                    </strong>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
