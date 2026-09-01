/**
 * PayBack AI / RecoverFlow AI — Hero Loop Visualization Component.
 *
 * Visually communicates the primary product thesis:
 * FAIL → UNDERSTAND → PREDICT → PROTECT → OPTIMIZE → ACT → OBSERVE → LEARN → RE-RANK → ↺ (EVERY CYCLE GETS SMARTER)
 *
 * Implements strict separation of responsibilities:
 * - AI = WHY? (Error normalization, explanation, drafting)
 * - Prediction = WILL IT WORK? (Calibrated probability)
 * - Safety = IS IT ALLOWED? (Opt-out, attempt caps, quiet hours)
 * - Optimizer = WHAT NEXT? (Expected value, portfolio allocation)
 * - Payment System = EXECUTE (Razorpay test-mode, idempotency)
 * - Observer = WHAT HAPPENED? (Settlement telemetry, conflict checks)
 * - Learning Loop = WHAT DID WE LEARN? (Feature updates, re-ranking)
 */

'use client';

import React, { useState } from 'react';
import {
  AlertOctagon,
  Brain,
  TrendingUp,
  ShieldCheck,
  Sparkles,
  Zap,
  Activity,
  RotateCw,
  Sliders,
  Repeat,
  Info,
  ChevronRight,
} from 'lucide-react';

export type LoopStage =
  | 'FAIL'
  | 'UNDERSTAND'
  | 'PREDICT'
  | 'PROTECT'
  | 'OPTIMIZE'
  | 'ACT'
  | 'OBSERVE'
  | 'LEARN'
  | 'RERANK';

interface StageDefinition {
  id: LoopStage;
  number: number;
  label: string;
  sublabel: string;
  role: string;
  question: string;
  icon: React.ElementType;
  color: string;
  activeColor: string;
  bgLight: string;
  badge: string;
  description: string;
}

export const LOOP_STAGES: StageDefinition[] = [
  {
    id: 'FAIL',
    number: 1,
    label: 'FAIL',
    sublabel: 'Payment Failure',
    role: 'Payment Event',
    question: 'WHAT HAPPENED?',
    icon: AlertOctagon,
    color: 'text-rose-600 border-rose-200 bg-rose-50',
    activeColor: 'bg-rose-600 text-white ring-4 ring-rose-200 shadow-lg',
    bgLight: 'bg-rose-50/70',
    badge: '10 Failure Types',
    description: 'Ingests failed payment events, issuer error codes, mandate tokens, and customer tenure.',
  },
  {
    id: 'UNDERSTAND',
    number: 2,
    label: 'UNDERSTAND',
    sublabel: 'AI Error Normalization',
    role: 'AI Layer (Gemini)',
    question: 'WHY DID IT FAIL?',
    icon: Brain,
    color: 'text-indigo-600 border-indigo-200 bg-indigo-50',
    activeColor: 'bg-indigo-600 text-white ring-4 ring-indigo-200 shadow-lg',
    bgLight: 'bg-indigo-50/70',
    badge: 'AI = WHY?',
    description: 'Normalizes unstructured error logs into plain English without financial execution privileges.',
  },
  {
    id: 'PREDICT',
    number: 3,
    label: 'PREDICT',
    sublabel: 'Brier Calibration',
    role: 'Scoring Engine',
    question: 'WILL IT WORK?',
    icon: TrendingUp,
    color: 'text-blue-600 border-blue-200 bg-blue-50',
    activeColor: 'bg-blue-600 text-white ring-4 ring-blue-200 shadow-lg',
    bgLight: 'bg-blue-50/70',
    badge: 'P(recovery) bps',
    description: 'Calculates calibrated probability using 7 deterministic features and logistic calibration.',
  },
  {
    id: 'PROTECT',
    number: 4,
    label: 'PROTECT',
    sublabel: 'Deterministic Safety',
    role: 'Safety Filter',
    question: 'IS IT ALLOWED?',
    icon: ShieldCheck,
    color: 'text-emerald-600 border-emerald-200 bg-emerald-50',
    activeColor: 'bg-emerald-600 text-white ring-4 ring-emerald-200 shadow-lg',
    bgLight: 'bg-emerald-50/70',
    badge: 'Zero Violations',
    description: 'Hard-stops customer opt-outs, quiet hours (9pm-8am), attempt caps (<=3), and closed accounts.',
  },
  {
    id: 'OPTIMIZE',
    number: 5,
    label: 'OPTIMIZE',
    sublabel: 'EV Knapsack Allocation',
    role: 'Portfolio Optimizer',
    question: 'WHAT SHOULD WE DO NEXT?',
    icon: Sparkles,
    color: 'text-amber-600 border-amber-200 bg-amber-50',
    activeColor: 'bg-amber-600 text-white ring-4 ring-amber-200 shadow-lg',
    bgLight: 'bg-amber-50/70',
    badge: 'EV = Amount x Prob',
    description: 'Sorts eligible records descending by Expected Value and selects optimal channel (Retry/Reminder/Both).',
  },
  {
    id: 'ACT',
    number: 6,
    label: 'ACT',
    sublabel: 'Test-Mode Execution',
    role: 'Payment Adapter',
    question: 'EXECUTE ACTION',
    icon: Zap,
    color: 'text-violet-600 border-violet-200 bg-violet-50',
    activeColor: 'bg-violet-600 text-white ring-4 ring-violet-200 shadow-lg',
    bgLight: 'bg-violet-50/70',
    badge: 'Idempotency Safe',
    description: 'Dispatches signed action via Razorpay test-mode API with append-only SHA-256 audit record.',
  },
  {
    id: 'OBSERVE',
    number: 7,
    label: 'OBSERVE',
    sublabel: 'Settlement Telemetry',
    role: 'Telemetry Observer',
    question: 'WHAT HAPPENED?',
    icon: Activity,
    color: 'text-cyan-600 border-cyan-200 bg-cyan-50',
    activeColor: 'bg-cyan-600 text-white ring-4 ring-cyan-200 shadow-lg',
    bgLight: 'bg-cyan-50/70',
    badge: 'Proactive Polling',
    description: 'Observes true settlement outcome via status polling and detects contradictory provider signals.',
  },
  {
    id: 'LEARN',
    number: 8,
    label: 'LEARN',
    sublabel: 'Signal Feedback',
    role: 'Learning Loop',
    question: 'WHAT DID WE LEARN?',
    icon: RotateCw,
    color: 'text-orange-600 border-orange-200 bg-orange-50',
    activeColor: 'bg-orange-600 text-white ring-4 ring-orange-200 shadow-lg',
    bgLight: 'bg-orange-50/70',
    badge: 'Dynamic Update',
    description: 'Updates Laplace recovery ratios, increments attempt decay, and records ground-truth feedback.',
  },
  {
    id: 'RERANK',
    number: 9,
    label: 'RE-RANK',
    sublabel: 'Cycle Progression',
    role: 'Re-Ranker Engine',
    question: 'NEXT BEST ACTION',
    icon: Sliders,
    color: 'text-purple-600 border-purple-200 bg-purple-50',
    activeColor: 'bg-purple-600 text-white ring-4 ring-purple-200 shadow-lg',
    bgLight: 'bg-purple-50/70',
    badge: 'Cycle 2 & 3',
    description: 'Re-ranks remaining payments: downgrades repeated failures and promotes newly high-EV candidates.',
  },
];

interface HeroLoopVisualizationProps {
  activeStage?: LoopStage;
  onSelectStage?: (stage: LoopStage) => void;
  currentCycle?: 1 | 2 | 3;
}

export const HeroLoopVisualization: React.FC<HeroLoopVisualizationProps> = ({
  activeStage,
  onSelectStage,
  currentCycle = 1,
}) => {
  const [selectedStage, setSelectedStage] = useState<StageDefinition>(LOOP_STAGES[0]);
  const [showResponsibilities, setShowResponsibilities] = useState<boolean>(false);

  const handleStageClick = (stageDef: StageDefinition) => {
    setSelectedStage(stageDef);
    onSelectStage?.(stageDef.id);
  };

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-xl relative overflow-hidden" data-testid="hero-loop-visualization">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4 relative z-10">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-mono text-[11px] font-bold tracking-wider uppercase border border-indigo-500/30">
              Autonomous Recovery Loop
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-[11px] font-bold tracking-wider uppercase border border-emerald-500/30">
              Cycle {currentCycle} of 3 Active
            </span>
          </div>
          <h2 className="text-lg md:text-xl font-extrabold text-white tracking-tight mt-1 flex items-center gap-2">
            <span>Every Cycle Gets Smarter</span>
            <span className="text-xs font-normal text-slate-400">· Closed-Loop Decision Engine</span>
          </h2>
        </div>

        <button
          onClick={() => setShowResponsibilities((prev) => !prev)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer self-start md:self-auto"
        >
          <Info className="w-3.5 h-3.5 text-indigo-400" />
          <span>{showResponsibilities ? 'Hide Boundaries' : 'Authority Boundaries (AI vs Rules)'}</span>
        </button>
      </div>

      {/* Authority Boundaries Drawer */}
      {showResponsibilities && (
        <div className="mt-4 p-3.5 bg-slate-950/90 rounded-xl border border-indigo-500/30 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs animate-in fade-in slide-in-from-top-2 duration-200 relative z-10">
          <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 space-y-1">
            <span className="text-indigo-400 font-bold font-mono block">AI = WHY?</span>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Diagnoses raw error logs into plain English and drafts policy-compliant customer dunning messages. <strong>0 execution authority.</strong>
            </p>
          </div>
          <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 space-y-1">
            <span className="text-emerald-400 font-bold font-mono block">SAFETY & PREDICTION = DETERMINISTIC</span>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Brier-calibrated probability (2.98% error), integer paise EV math, opt-out hard stops, quiet-hours compliance, and attempt caps.
            </p>
          </div>
          <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 space-y-1">
            <span className="text-amber-400 font-bold font-mono block">OPTIMIZER & TELEMETRY = CLOSED LOOP</span>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Selects the top 40 EV actions across 1,000 failures, executes via Razorpay test adapters, observes settlements, and re-ranks Cycle 2.
            </p>
          </div>
        </div>
      )}

      {/* Main 9-Stage Step Tracker with Re-Rank Loop Connector */}
      <div className="mt-5 relative z-10">
        <div className="grid grid-cols-3 md:grid-cols-9 gap-2">
          {LOOP_STAGES.map((stage) => {
            const Icon = stage.icon;
            const isSelected = selectedStage.id === stage.id;
            const isCurrentlyActive = activeStage === stage.id;

            return (
              <button
                key={stage.id}
                onClick={() => handleStageClick(stage)}
                className={`flex flex-col items-center text-center p-2.5 rounded-xl border transition-all cursor-pointer relative group ${
                  isSelected || isCurrentlyActive
                    ? stage.activeColor
                    : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 text-slate-300'
                }`}
              >
                <div className={`flex items-center gap-1 text-[10px] font-mono mb-1 ${isSelected || isCurrentlyActive ? 'text-white font-bold' : 'text-slate-400'}`}>
                  <span>#{stage.number}</span>
                </div>
                <Icon className={`w-4 h-4 mb-1 ${isSelected || isCurrentlyActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="text-xs font-bold tracking-tight">{stage.label}</span>
                <span className={`text-[9px] truncate max-w-full block mt-0.5 ${isSelected || isCurrentlyActive ? 'text-white font-medium' : 'text-slate-400'}`}>{stage.role}</span>

                {/* Step Connector Arrow (except last) */}
                {stage.number < 9 && (
                  <div className="hidden md:block absolute -right-2 top-1/2 -translate-y-1/2 z-20 text-slate-500 pointer-events-none">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* ↺ Visual Loop Return Arrow */}
        <div className="mt-3 flex items-center justify-between px-3 py-2 bg-slate-950/80 rounded-xl border border-slate-800 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Repeat className="w-4 h-4 text-emerald-400 animate-spin-slow" />
            <span className="text-slate-300 font-medium">
              Continuous Feedback Loop:
            </span>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Step 9 (Re-Rank) feeds observed reality directly back into Step 1 (Cycle 2 &amp; Cycle 3)
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="text-indigo-300 font-bold">FAIL</span>
            <span>→</span>
            <span className="text-emerald-300 font-bold">ACT</span>
            <span>→</span>
            <span className="text-cyan-300 font-bold">OBSERVE</span>
            <span>→</span>
            <span className="text-orange-300 font-bold">LEARN</span>
            <span>→</span>
            <span className="text-purple-300 font-bold">RE-RANK ↺</span>
          </div>
        </div>
      </div>

      {/* Selected Stage Detail Inspector */}
      <div className="mt-4 p-3.5 bg-slate-950/70 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs relative z-10">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 shrink-0">
            {React.createElement(selectedStage.icon, { className: 'w-4 h-4' })}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">
                Stage {selectedStage.number}: {selectedStage.label} ({selectedStage.sublabel})
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {selectedStage.question}
              </span>
            </div>
            <p className="text-slate-400 text-[11px] mt-0.5">
              {selectedStage.description}
            </p>
          </div>
        </div>

        <span className="font-mono text-[11px] font-bold text-emerald-400 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 self-start sm:self-center shrink-0">
          {selectedStage.badge}
        </span>
      </div>
    </div>
  );
};
