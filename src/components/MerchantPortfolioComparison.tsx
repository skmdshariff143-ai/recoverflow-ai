/**
 * PayBack AI — Multi-Merchant Risk Profiles & Platform Framing.
 *
 * Demonstrates PayBack AI as a flexible enterprise platform configurable
 * across 3 distinct merchant risk appetites: Conservative, Balanced, and Aggressive.
 */

'use client';

import React, { useMemo } from 'react';
import {
  ShieldCheck,
  Scale,
  Zap,
  Sliders,
} from 'lucide-react';
import type { FailedPayment } from '@/types';
import {
  evaluateAllMerchantProfiles,
  type MerchantProfileId,
} from '@/lib/engine/merchantProfiles';
import { formatPaiseToINR } from '@/lib/engine/financial';

interface MerchantPortfolioComparisonProps {
  payments: FailedPayment[];
  selectedProfileId?: MerchantProfileId;
  onSelectProfile?: (id: MerchantProfileId) => void;
}

export function MerchantPortfolioComparison({
  payments,
  selectedProfileId = 'balanced',
  onSelectProfile,
}: MerchantPortfolioComparisonProps) {
  const profileResults = useMemo(() => {
    return evaluateAllMerchantProfiles(payments, 42);
  }, [payments]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/* ── Section Header ────────────────────────────────────────── */}
      <div className="border-b border-slate-100 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">
              Multi-Merchant Risk Appetite Presets (Platform Framing)
            </h3>
            <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-200">
              Configurable Engine
            </span>
          </div>
          <span className="text-xs text-slate-500">
            Same 100-payment dataset evaluated across 3 merchant risk profiles
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          PayBack AI is not a static one-size-fits-all bot. Merchants can configure contact capacity, human approval ceilings, and retry aggressiveness based on their customer relationship sensitivity.
        </p>
      </div>

      {/* ── 3 Side-by-Side Profile Cards ──────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {profileResults.map((result) => {
          const isSelected = selectedProfileId === result.profile.id;
          const { profile } = result;

          let badgeColor = 'bg-slate-100 text-slate-800 border-slate-300';
          let icon = <Scale className="w-4 h-4 text-slate-600" />;
          let headerGlow = 'border-slate-200 hover:border-slate-300';

          if (profile.id === 'conservative') {
            badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
            icon = <ShieldCheck className="w-4 h-4 text-emerald-600" />;
            headerGlow = isSelected
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20'
              : 'border-slate-200 hover:border-emerald-300';
          } else if (profile.id === 'balanced') {
            badgeColor = 'bg-indigo-100 text-indigo-800 border-indigo-300';
            icon = <Scale className="w-4 h-4 text-indigo-600" />;
            headerGlow = isSelected
              ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20'
              : 'border-slate-200 hover:border-indigo-300';
          } else if (profile.id === 'aggressive') {
            badgeColor = 'bg-amber-100 text-amber-900 border-amber-300';
            icon = <Zap className="w-4 h-4 text-amber-600" />;
            headerGlow = isSelected
              ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20'
              : 'border-slate-200 hover:border-amber-300';
          }

          return (
            <div
              key={profile.id}
              onClick={() => onSelectProfile?.(profile.id)}
              className={`rounded-xl border p-4 transition cursor-pointer flex flex-col justify-between space-y-4 ${headerGlow}`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                    {icon}
                    <span>{profile.name}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                    {profile.budgetSlots} Slots
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 italic">
                  {profile.tagline}
                </p>

                <p className="text-xs text-slate-700 leading-relaxed">
                  {profile.description}
                </p>
              </div>

              {/* Financial & Calibration Metrics */}
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-slate-500">Recovered Revenue:</span>
                  <span className="text-base font-bold text-emerald-600">
                    {formatPaiseToINR(result.recoveredAmountPaise, false)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                  <div>
                    <span className="text-slate-500 block">Invoices Recovered:</span>
                    <span className="font-bold text-slate-800">
                      {result.recoveredCount} / {result.budgetedSlots} ({result.cohortRecoveryRatePercent}%)
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Unnecessary Retries:</span>
                    <span className="font-bold text-slate-800">
                      {result.unnecessaryRetryRatePercent}%
                    </span>
                  </div>
                  <div className="mt-1">
                    <span className="text-slate-500 block">Approval Ceiling:</span>
                    <span className="font-mono font-bold text-slate-800">
                      ₹{(profile.approvalThresholdINR).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="mt-1">
                    <span className="text-slate-500 block">Calibration Error:</span>
                    <span className="font-mono font-bold text-indigo-700">
                      {result.calibrationErrorPercent}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Policy Comparison Summary Table ───────────────────────── */}
      <div className="border border-slate-100 rounded-lg overflow-x-auto">
        <table className="min-w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3">Merchant Profile</th>
              <th className="py-2.5 px-3 text-center">Budget Capacity</th>
              <th className="py-2.5 px-3 text-center">Manual Approval Gate</th>
              <th className="py-2.5 px-3 text-right">Invoices Recovered</th>
              <th className="py-2.5 px-3 text-right">Simulated Recovery (INR)</th>
              <th className="py-2.5 px-3 text-center">Calibration Error</th>
              <th className="py-2.5 px-3 text-center">Friction Profile</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {profileResults.map((res) => (
              <tr key={res.profile.id} className="hover:bg-slate-50/60">
                <td className="py-2.5 px-3 font-semibold text-slate-900">
                  {res.profile.name}
                </td>
                <td className="py-2.5 px-3 text-center font-mono">
                  {res.budgetedSlots} slots
                </td>
                <td className="py-2.5 px-3 text-center font-mono">
                  &gt; ₹{(res.profile.approvalThresholdINR).toLocaleString('en-IN')}
                </td>
                <td className="py-2.5 px-3 text-right font-medium">
                  {res.recoveredCount} ({res.cohortRecoveryRatePercent}%)
                </td>
                <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                  {formatPaiseToINR(res.recoveredAmountPaise, false)}
                </td>
                <td className="py-2.5 px-3 text-center font-mono text-indigo-700">
                  {res.calibrationErrorPercent}%
                </td>
                <td className="py-2.5 px-3 text-center">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    res.profile.id === 'conservative'
                      ? 'bg-emerald-100 text-emerald-800'
                      : res.profile.id === 'balanced'
                      ? 'bg-indigo-100 text-indigo-800'
                      : 'bg-amber-100 text-amber-900'
                  }`}>
                    {res.profile.id === 'conservative' ? 'Ultra Low Friction' : res.profile.id === 'balanced' ? 'Balanced EV' : 'Maximum Top-Line'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
