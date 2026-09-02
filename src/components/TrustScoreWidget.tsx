/**
 * PayBack AI — Explainability & Safety Trust Score Widget.
 *
 * Displays a 0-100 composite Trust Score derived from:
 * - Calibration Accuracy (Brier score inverse & ECE)
 * - Safety Rule Invariant Enforcement (Zero tolerance)
 * - Cryptographic Audit Trail Completeness (100% SHA-256 chained)
 *
 * Clickable to expand full calculation formulas and underlying real numbers.
 */

'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Target,
  Lock,
  Award,
  ShieldAlert,
} from 'lucide-react';
import { computeTrustScore, type TrustScoreInputs } from '@/lib/engine/trustScore';
import { RegulatoryFootprintBadge } from './RegulatoryFootprintBadge';

interface TrustScoreWidgetProps {
  inputs: TrustScoreInputs;
  onNavigateTab?: (tab: 'dashboard' | 'live_runner' | 'evaluation_lab' | 'promise_to_pay' | 'audit_ledger' | 'methodology_guide') => void;
}

export function TrustScoreWidget({ inputs, onNavigateTab }: TrustScoreWidgetProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const trustBreakdown = computeTrustScore(inputs);

  const { totalScore, grade, components } = trustBreakdown;

  // Ring gauge calculation
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (totalScore / 100) * circumference;

  return (
    <div
      data-testid="trust-score-card"
      className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl border border-indigo-500/40 p-4 shadow-md transition-all"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Gauge & Score */}
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
            <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
              {/* Background circle */}
              <circle
                cx="40"
                cy="40"
                r={radius}
                className="text-slate-800"
                strokeWidth="6"
                stroke="currentColor"
                fill="transparent"
              />
              {/* Progress circle */}
              <circle
                cx="40"
                cy="40"
                r={radius}
                className="text-emerald-400 transition-all duration-1000 ease-out"
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-black text-white font-mono leading-none">
                {totalScore}
              </span>
              <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                / 100
              </span>
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-400" />
                Explainability &amp; Safety Trust Score
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {grade}
              </span>
              <RegulatoryFootprintBadge />
            </div>
            <p className="text-xs text-slate-400 mt-0.5 max-w-xl">
              Composite telemetry synthesized from calibration reliability, zero-tolerance safety rule tests, and append-only cryptographic ledger completeness.
            </p>
          </div>
        </div>

        {/* Right: Quick Sub-Score Badges & Expand Trigger */}
        <div className="flex items-center gap-3">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700">
              <div className="text-[10px] text-slate-400">Calibration</div>
              <div className="font-bold text-indigo-300 font-mono">
                {components.calibration.score} / 40
              </div>
            </div>
            <div className="bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700">
              <div className="text-[10px] text-slate-400">Safety Rules</div>
              <div className="font-bold text-emerald-300 font-mono">
                {components.safety.score} / 35
              </div>
            </div>
            <div className="bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700">
              <div className="text-[10px] text-slate-400">Audit Trail</div>
              <div className="font-bold text-cyan-300 font-mono">
                {components.auditCompleteness.score} / 25
              </div>
            </div>
          </div>

          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('audit_ledger')}
              data-testid="jump-to-tamper-demo-btn"
              className="flex items-center gap-1.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition cursor-pointer border border-rose-400/40 shrink-0"
              title="Jump directly to the Live Cryptographic Tamper Demo"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-200" />
              <span>Try to Break It &rarr;</span>
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            data-testid="toggle-trust-breakdown-btn"
            className="flex items-center gap-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 text-xs font-semibold px-3 py-2 rounded-xl transition cursor-pointer shrink-0"
          >
            <span>{isExpanded ? 'Hide' : 'Breakdown'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ── Expandable Underlying Telemetry Breakdown ────────────── */}
      {isExpanded && (
        <div
          data-testid="trust-score-breakdown"
          className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs animate-in fade-in duration-200"
        >
          {/* 1. Calibration Accuracy */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between text-indigo-300 font-bold">
              <span className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" />
                Model Calibration Accuracy
              </span>
              <span className="font-mono text-white">{components.calibration.score} / 40</span>
            </div>
            <p className="text-[11px] text-slate-400">{components.calibration.description}</p>
            <div className="font-mono text-[10px] text-indigo-400 bg-indigo-950/40 p-1.5 rounded border border-indigo-900">
              {components.calibration.formula}
            </div>
            <div className="text-[10px] text-slate-500">
              Brier Score: {components.calibration.brierScore.toFixed(4)} · ECE: {(components.calibration.calibrationError * 100).toFixed(2)}%
            </div>
          </div>

          {/* 2. Safety Rule Invariants */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between text-emerald-300 font-bold">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Safety Rule Invariants
              </span>
              <span className="font-mono text-white">{components.safety.score} / 35</span>
            </div>
            <p className="text-[11px] text-slate-400">{components.safety.description}</p>
            <div className="font-mono text-[10px] text-emerald-400 bg-emerald-950/40 p-1.5 rounded border border-emerald-900">
              {components.safety.formula}
            </div>
            <div className="text-[10px] text-slate-500">
              {components.safety.passingRulesCount} of {components.safety.totalRulesCount} Hard Safety Invariants Passing Green
            </div>
          </div>

          {/* 3. Cryptographic Audit Completeness */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between text-cyan-300 font-bold">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                Audit Trail Completeness
              </span>
              <span className="font-mono text-white">{components.auditCompleteness.score} / 25</span>
            </div>
            <p className="text-[11px] text-slate-400">{components.auditCompleteness.description}</p>
            <div className="font-mono text-[10px] text-cyan-400 bg-cyan-950/40 p-1.5 rounded border border-cyan-900">
              {components.auditCompleteness.formula}
            </div>
            <div className="text-[10px] text-slate-500">
              {components.auditCompleteness.completenessRate}% of Pipeline Transitions Chained via SHA-256
            </div>
          </div>

          {/* 4. Methodology & Transparency Disclosure */}
          <div className="md:col-span-3 bg-slate-950/60 border border-slate-800/80 rounded-lg px-3 py-2 text-[11px] text-slate-400 flex items-center justify-between gap-2">
            <span>
              <strong className="text-slate-300">Methodology Note:</strong> This composite Trust Score is computed directly from this project&apos;s internal simulation and test-mode execution data (Brier score inverse, 7 zero-tolerance safety unit tests, and 100% SHA-256 ledger chaining), not external third-party certification.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
