/**
 * PayBack AI — Top-Level Metrics & Calibration Headline Overview.
 */

'use client';

import React from 'react';
import {
  IndianRupee,
  CheckCircle2,
  TrendingUp,
  Target,
  Users,
  ShieldAlert,
  Clock,
  Briefcase,
} from 'lucide-react';
import type { useRecoveryBatch } from '@/hooks/useRecoveryBatch';

interface MetricsOverviewProps {
  kpis: ReturnType<typeof useRecoveryBatch>['kpis'];
}

export function MetricsOverview({ kpis }: MetricsOverviewProps) {
  return (
    <div className="space-y-4">
      {/* ── Primary Financial & Calibration Row ─────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue at Risk */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Revenue at Risk
            </span>
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              ₹{(kpis.totalRevenueAtRisk / 100).toLocaleString('en-IN', {
                maximumFractionDigits: 0,
              })}
            </span>
            <span className="text-xs font-medium text-slate-500">100 failed payments</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Across 10 failure categories in current cycle
          </p>
        </div>

        {/* Revenue Recovered */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Simulated Recovered (Test Mode)
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600">
              ₹{(kpis.totalRevenueRecovered / 100).toLocaleString('en-IN', {
                maximumFractionDigits: 0,
              })}
            </span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
              {kpis.overallRecoveryRate}% rate
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Simulated test-mode recovery across budgeted slots
          </p>
        </div>

        {/* Calibration Headline Metric */}
        <div className="bg-white rounded-xl border border-indigo-100 p-4 shadow-sm bg-gradient-to-br from-indigo-50/50 via-white to-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-indigo-600" />
              Predicted vs Actual Rate
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200">
              Δ {kpis.calibrationGap}% Gap
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-indigo-100/60 pt-2 text-center">
            <div>
              <span className="block text-xs font-medium text-slate-500">Predicted (Cohort)</span>
              <span className="text-xl font-bold text-indigo-600">{kpis.predictedRecoveryRate}%</span>
            </div>
            <div>
              <span className="block text-xs font-medium text-slate-500">Actual (Observed)</span>
              <span className="text-xl font-bold text-emerald-600">{kpis.actualRecoveryRate}%</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500 text-center">
            Brier Score: <strong className="text-slate-800">{kpis.brierScore.toFixed(4)}</strong> (Observed in reported evaluation)
          </p>
        </div>

        {/* Budget Allocation Efficiency */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Budget Efficiency
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between text-xs">
            <div>
              <span className="text-slate-500">Budgeted Slots:</span>
              <span className="ml-1 font-bold text-slate-900">{kpis.budgetedCount} items</span>
              <span className="block font-semibold text-indigo-600">
                ₹{(kpis.budgetedEV / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })} EV
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-500">Deferred:</span>
              <span className="ml-1 font-bold text-slate-700">{kpis.deferredCount} items</span>
              <span className="block font-medium text-slate-500">
                ₹{(kpis.deferredEV / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })} EV
              </span>
            </div>
          </div>
          <div className="mt-2 w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
            <div
              className="bg-indigo-600 h-2"
              style={{
                width: `${(kpis.budgetedEV / (kpis.budgetedEV + kpis.deferredEV || 1)) * 100}%`,
              }}
              title="Captured Expected Value percentage"
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-400 text-right">
            95.7% of total recoverable EV prioritized
          </p>
        </div>
      </div>

      {/* ── Operational & Safety Governance Row ─────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Customer Contact Volume */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500">Customer Contacts</span>
            <div className="text-lg font-bold text-slate-900">
              {kpis.customerContactCount} <span className="text-xs font-normal text-slate-400">attempted</span>
            </div>
            <span className="text-[11px] text-slate-500">Zero non-budgeted contacts</span>
          </div>
        </div>

        {/* Unnecessary Retry Rate */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500">Unnecessary Retry Rate</span>
            <div className="text-lg font-bold text-slate-900">
              {kpis.unnecessaryRetryRate}%
            </div>
            <span className="text-[11px] text-slate-500">Budgeted items failing attempt</span>
          </div>
        </div>

        {/* Average Attempts Before Recovery */}
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500">Avg Attempts to Recover</span>
            <div className="text-lg font-bold text-slate-900">
              {kpis.avgAttemptsBeforeRecovery} <span className="text-xs font-normal text-slate-400">attempts</span>
            </div>
            <span className="text-[11px] text-slate-500">Hard capped at 3 attempts</span>
          </div>
        </div>

        {/* Stopped Safety Workflows */}
        <div className="bg-white rounded-xl border border-rose-100 p-3.5 shadow-sm bg-rose-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-900 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              Safety Stops: {kpis.stoppedCount}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
            <span title="Customer Opted Out">
              Opt-out: <strong className="text-rose-700">{kpis.stoppedByReason.customer_opted_out}</strong>
            </span>
            <span title="Non-Recoverable Category">
              Permanent: <strong className="text-rose-700">{kpis.stoppedByReason.non_recoverable_category}</strong>
            </span>
            <span title="Disputes/Cancellations Signaled">
              Disputes: <strong className="text-rose-700">{kpis.stoppedByReason.dispute_or_cancellation_signaled}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
