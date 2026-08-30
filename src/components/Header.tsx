/**
 * RecoverFlow AI — Top Navigation Header & Global Control Bar.
 */

'use client';

import React from 'react';
import {
  Sparkles,
  ShieldCheck,
  RotateCcw,
  Sliders,
  FileSpreadsheet,
  Activity,
  FlaskConical,
  BookOpen,
  Database,
} from 'lucide-react';
import type { DashboardTab } from '@/hooks/useRecoveryBatch';

export type DataProvenanceSource = 'synthetic_fixture' | 'razorpay_test_mode' | 'imported_dataset';

interface HeaderProps {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  budget: number;
  onBudgetChange: (budget: number) => void;
  simulationSeed: number;
  onReSimulate: () => void;
  provenance?: DataProvenanceSource;
  onProvenanceChange?: (provenance: DataProvenanceSource) => void;
}

export function Header({
  activeTab,
  onSelectTab,
  budget,
  onBudgetChange,
  simulationSeed,
  onReSimulate,
  provenance = 'synthetic_fixture',
  onProvenanceChange,
}: HeaderProps) {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between py-3 gap-3">
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-400 flex items-center justify-center shadow-inner">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  RecoverFlow AI
                  <span className="text-xs bg-indigo-500/20 text-indigo-300 font-semibold px-2 py-0.5 rounded-full border border-indigo-500/30">
                    Track 3: Revenue Recovery
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-400">
                Bounded, Explainable Recovery Orchestration for Failed Payments
              </p>
            </div>
          </div>

          {/* Interactive Simulation Controls */}
          <div className="flex items-center flex-wrap gap-3">
            {/* Budget Capacity Slider */}
            <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60 text-xs">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-slate-300 font-medium">Budget:</span>
              <span className="text-white font-bold bg-indigo-600/40 px-1.5 py-0.5 rounded text-indigo-200">
                {budget} slots
              </span>
              <input
                type="range"
                min="10"
                max="80"
                step="5"
                value={budget}
                onChange={(e) => onBudgetChange(Number(e.target.value))}
                className="w-20 accent-indigo-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                title={`Adjust contact budget capacity: ${budget}`}
              />
            </div>

            {/* Re-simulate Button */}
            <button
              onClick={onReSimulate}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-700 transition cursor-pointer"
              title={`Simulation seed: ${simulationSeed}`}
            >
              <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
              <span>Re-Simulate Batch</span>
            </button>

            {/* Data Provenance Selector */}
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/60 text-xs">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400 font-medium hidden sm:inline">Source:</span>
              <select
                value={provenance}
                onChange={(e) => onProvenanceChange?.(e.target.value as DataProvenanceSource)}
                className="bg-transparent text-cyan-200 font-semibold focus:outline-none cursor-pointer text-xs"
                title="Select Active Data Provenance"
              >
                <option value="synthetic_fixture" className="bg-slate-900 text-white">
                  Synthetic Fixture (Dev)
                </option>
                <option value="razorpay_test_mode" className="bg-slate-900 text-white">
                  Razorpay Test Mode (Sim)
                </option>
                <option value="imported_dataset" className="bg-slate-900 text-white">
                  Imported Dataset (Held-out)
                </option>
              </select>
            </div>

            {/* Test Mode Badge */}
            <div className="flex items-center gap-1.5 bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 text-xs font-medium px-2.5 py-1.5 rounded-lg">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>TEST-MODE ONLY</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-t border-slate-800/80 pt-1 -mb-px space-x-6 text-xs font-medium overflow-x-auto">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`pb-2.5 flex items-center gap-2 border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'border-indigo-400 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4 text-indigo-400" />
            <span>Dashboard &amp; Ranked Queue</span>
          </button>

          <button
            onClick={() => onSelectTab('evaluation')}
            className={`pb-2.5 flex items-center gap-2 border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'evaluation'
                ? 'border-indigo-400 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FlaskConical className="w-4 h-4 text-emerald-400" />
            <span>Evaluation Lab &amp; Policy Simulator</span>
          </button>

          <button
            onClick={() => onSelectTab('audit_trail')}
            className={`pb-2.5 flex items-center gap-2 border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'audit_trail'
                ? 'border-indigo-400 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
            <span>Audit Trail &amp; Cryptographic Ledger</span>
          </button>

          <button
            onClick={() => onSelectTab('methodology')}
            className={`pb-2.5 flex items-center gap-2 border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'methodology'
                ? 'border-indigo-400 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span>Methodology &amp; Judge Guide</span>
          </button>
        </div>
      </div>
    </header>
  );
}
