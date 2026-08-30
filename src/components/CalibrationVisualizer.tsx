/**
 * PayBack AI — Probabilistic Calibration & Reliability Visualizer.
 *
 * Renders the 5-bin Reliability Diagram and Category-Level Calibration Table.
 */

'use client';

import React from 'react';
import { Target, Layers, HelpCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import type { CalibrationReport } from '@/types';

interface CalibrationVisualizerProps {
  calibration: CalibrationReport;
}

export function CalibrationVisualizer({ calibration }: CalibrationVisualizerProps) {
  return (
    <div className="space-y-6">
      {/* ── Calibration Header & Proof Concept ──────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-600" />
              Probabilistic Model Calibration Report
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Proving recovery probability scores reflect true empirical recovery rates — not guesswork.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5 text-center">
              <span className="block text-slate-500 font-medium">Brier Score</span>
              <span className="text-base font-bold text-indigo-700">
                {calibration.brier_score.toFixed(4)}
              </span>
              <span className="block text-[10px] text-slate-400">0.0 = perfect calibration</span>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-center">
              <span className="block text-slate-500 font-medium">Mean Cat Error</span>
              <span className="text-base font-bold text-emerald-700">
                {(calibration.mean_category_calibration_error * 100).toFixed(1)}%
              </span>
              <span className="block text-[10px] text-slate-400">Across active categories</span>
            </div>
          </div>
        </div>

        {/* ── 5-Bin Reliability Diagram Visualizer ───────────────── */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              5-Bin Reliability Diagram (Predicted vs Actual Recovery)
            </h3>
            <span className="text-xs text-slate-500">
              Closer bar heights = Higher statistical calibration
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {calibration.binned_metrics.map((bin) => {
              const predPercent = Number((bin.avg_predicted_prob * 100).toFixed(1));
              const actPercent = Number((bin.actual_recovery_rate * 100).toFixed(1));
              const errPercent = Number((bin.calibration_error * 100).toFixed(1));
              const isWellCalibrated = errPercent <= 15;

              return (
                <div
                  key={bin.bin_index}
                  className="bg-slate-50 rounded-xl border border-slate-200/80 p-3.5 flex flex-col justify-between hover:border-indigo-300 transition"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700">{bin.bin_label}</span>
                      <span className="bg-slate-200/80 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                        {bin.sample_count} {bin.sample_count === 1 ? 'item' : 'items'}
                      </span>
                    </div>

                    {/* Comparative Visual Bars */}
                    <div className="mt-3 space-y-2">
                      {/* Predicted Bar */}
                      <div>
                        <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
                          <span>Predicted:</span>
                          <span className="font-bold text-indigo-600">{predPercent}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-indigo-500 h-2 rounded-full"
                            style={{ width: `${predPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Actual Bar */}
                      <div>
                        <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
                          <span>Actual:</span>
                          <span className="font-bold text-emerald-600">{actPercent}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-2 rounded-full"
                            style={{ width: `${actPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Calibration Gap Badge */}
                  <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Error Gap:</span>
                    <span
                      className={`font-semibold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                        isWellCalibrated
                          ? 'bg-emerald-100/80 text-emerald-800'
                          : 'bg-amber-100/80 text-amber-800'
                      }`}
                    >
                      {isWellCalibrated ? (
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                      )}
                      Δ {errPercent}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Category-Level Calibration Breakdown Table ──────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm overflow-hidden">
        <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-600" />
          Category-Level Calibration Breakdown (Budgeted Cohort)
        </h3>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs text-left">
            <thead className="bg-slate-50 border-y border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Failure Category</th>
                <th className="py-2.5 px-3 text-center">Budgeted</th>
                <th className="py-2.5 px-3 text-center">Recovered</th>
                <th className="py-2.5 px-3 text-right">Predicted Rate</th>
                <th className="py-2.5 px-3 text-right">Actual Rate</th>
                <th className="py-2.5 px-3 text-right">Calibration Error</th>
                <th className="py-2.5 px-3 text-right">Expected Revenue</th>
                <th className="py-2.5 px-3 text-right">Actual Recovered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {calibration.category_metrics.map((cat) => {
                const predRate = (cat.predicted_recovery_rate * 100).toFixed(1);
                const actRate = (cat.actual_recovery_rate * 100).toFixed(1);
                const err = (cat.calibration_error * 100).toFixed(1);
                const isAccurate = cat.calibration_error <= 0.15;

                return (
                  <tr key={cat.category} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-3 font-semibold text-slate-900 capitalize">
                      {cat.category.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2.5 px-3 text-center font-medium">{cat.budgeted_count}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-emerald-600">
                      {cat.recovered_count}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-indigo-600">{predRate}%</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">{actRate}%</td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded text-[11px] ${
                          isAccurate
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        Δ {err}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-600">
                      ₹{(cat.expected_value / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                      ₹{(cat.recovered_amount / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
