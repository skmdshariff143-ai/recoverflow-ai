/**
 * PayBack AI — Guided Submission Experience (Judge Mode).
 *
 * Provides a structured 10-step evaluator walkthrough connecting all Track 3 objectives:
 * 1. Problem & Batch Ingestion
 * 2. Diagnostic Error Classification
 * 3. Recommended Intervention & Expected Value (Integer Paise)
 * 4. Human-in-the-Loop Approval Gate (> ₹10,000)
 * 5. Execution Adapter Boundary
 * 6. Outcome Observation Layer (Outbound Polling)
 * 7. Reconciled Recovery Accounting (0 Drift Equations)
 * 8. Stopping Rules & Escalation
 * 9. Cryptographic Audit Trail (SHA-256 Hash Chain)
 * 10. Evaluation Proof & Evidence Pack Export
 *
 * Full keyboard navigation: Left/Right arrows, Tab navigation, Escape to close.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Award,
  ShieldAlert,
  Search,
  UserCheck,
  RefreshCw,
  TrendingUp,
  Shield,
  FileCheck2,
  CheckCircle2,
} from 'lucide-react';
import type { DashboardTab } from '@/types/pipeline';
import type { DataProvenanceSource } from './Header';

interface JudgeModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: DashboardTab) => void;
  onSetProvenance: (source: DataProvenanceSource) => void;
}

interface StepContent {
  id: number;
  title: string;
  category: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  headline: string;
  description: string;
  technicalDetails: string[];
  recommendedAction?: {
    label: string;
    tab: DashboardTab;
    provenance?: DataProvenanceSource;
  };
}

export const CURATED_5_STEPS: StepContent[] = [
  {
    id: 1,
    title: 'Live Cryptographic Tamper Demo',
    category: 'Pitch Stop 1 / 5 · Audit Integrity',
    badge: 'TRY TO BREAK IT (SHA-256)',
    icon: FileCheck2,
    headline: 'Interactive cryptographic break test: mutate a record and watch the hash chain break.',
    description:
      'Before I show you anything else, try to break it yourself. Every state transition, operator note, and settlement receipt is chained into an append-only SHA-256 ledger. Clicking "Tamper Record" simulates payload manipulation—the verification engine instantly flags block corruption and breaks the chain.',
    technicalDetails: [
      'Genesis block anchor with parent hash chaining for all chronological state transitions.',
      'Browser cryptographic engine recomputes every block hash in real time upon mutation.',
      'One-click restoration returns ledger to mathematically verified state.',
    ],
    recommendedAction: {
      label: 'Launch Live Tamper Demo',
      tab: 'audit_ledger',
    },
  },
  {
    id: 2,
    title: 'KPIs, Trust Score & Connected Webhooks',
    category: 'Pitch Stop 2 / 5 · Command Center',
    badge: 'NET RECOVERY & LIVE WEBHOOK',
    icon: ShieldAlert,
    headline: 'Real-time revenue exposure, net unit economics, and Razorpay test-mode connection.',
    description:
      'PayBack AI computes gross vs net recovery after deducting per-channel operational fees (₹1.25 for SMS, ₹2.50 for gateway retries). The Explainability & Safety Trust Score combines Brier calibration (0.1637), 7 safety rules, and 100% hash-chained ledger coverage.',
    technicalDetails: [
      'Net Recovery Equation: Net = Gross Recovered - (SMS @ ₹1.25 + Retry @ ₹2.50).',
      'Explainability & Safety Trust Score evaluates calibration, safety rules, and audit completeness.',
      'Active test-mode listener (POST /api/webhooks/razorpay) ingests real HMAC-verified events.',
    ],
    recommendedAction: {
      label: 'View Command Center & Trust Score',
      tab: 'dashboard',
      provenance: 'synthetic_fixture',
    },
  },
  {
    id: 3,
    title: 'Explainable Decision Waterfall',
    category: 'Pitch Stop 3 / 5 · Explainability',
    badge: 'EV = AMOUNT × BPS / 10000',
    icon: Search,
    headline: 'Deterministic 6-factor waterfall with zero-write authority Gemini copilot.',
    description:
      'Every priority rank is explainable down to the paisa. A 6-factor waterfall quantifies base recovery rate, customer on-time history (+12%), and tenure boosts (+5%). An authority-isolated Gemini 3.6 Flash copilot normalizes messy error logs without execution privileges.',
    technicalDetails: [
      'Expected Value: EV_paise = round(amount_paise * bps / 10000).',
      'Authority Boundary: Gemini has zero financial execution authority and cannot change amounts.',
      '8-stage multi-cycle visual timeline tracks payments from ingestion to verified settlement.',
    ],
    recommendedAction: {
      label: 'Inspect Priority Queue & Drill-Down',
      tab: 'dashboard',
    },
  },
  {
    id: 4,
    title: 'Risk Persona & Policy Adjustment',
    category: 'Pitch Stop 4 / 5 · Policy Optimization',
    badge: 'CONSERVATIVE · AGGRESSIVE · FINTECH',
    icon: TrendingUp,
    headline: 'Dynamic policy simulation across 3 distinct merchant risk-appetite profiles.',
    description:
      'Merchants configure recovery aggression with built-in guardrails: Conservative SaaS (2 attempts, strict quiet hours), Aggressive E-Commerce (4 attempts, short cooldown), or Regulated FinTech (strict dual-custody approval above ₹25,000).',
    technicalDetails: [
      'Pre-fills compliant retry caps, TRAI quiet-hours tolerance, and dual-custody thresholds.',
      'Live recalculation of projected recovery rates and net financial yields across the cohort.',
      'Evaluated against frozen potential outcome matrices with zero circular feedback loops.',
    ],
    recommendedAction: {
      label: 'Test Persona Builder in Lab',
      tab: 'evaluation_lab',
    },
  },
  {
    id: 5,
    title: 'Blind-Bot vs PayBack Replay Arena',
    category: 'Pitch Stop 5 / 5 · Comparative Benchmark',
    badge: '+470% NET LIFT / 0 VIOLATIONS',
    icon: Award,
    headline: 'Head-to-head execution against naive fixed-retry bot on identical 40-slot budget.',
    description:
      'The Replay Arena pit PayBack AI against a standard blind-retry bot. While the naive bot spams opted-out customers and wastes retries on dead bank accounts, PayBack AI captures +₹3,93,159 (+470%) net revenue lift with 0 safety violations.',
    technicalDetails: [
      'Direct head-to-head comparison on identical frozen ground-truth outcome vectors.',
      'Flags naive bot blunders: retrying closed accounts, violating opt-outs, breaching quiet hours.',
      'Comprehensive final scorecard with net revenue, Brier score, and safety audit breakdown.',
    ],
    recommendedAction: {
      label: 'Open Replay Arena Scorecard',
      tab: 'evaluation_lab',
    },
  },
];

export const DEEP_DIVE_STEPS: StepContent[] = [
  ...CURATED_5_STEPS,
  {
    id: 6,
    title: 'Diagnostic Error Classification',
    category: 'Deep Dive 6 / 10 · Diagnostics',
    badge: '10 CANONICAL CATEGORIES',
    icon: Search,
    headline: 'Deterministic rule classification paired with authority-isolated Gemini copilot.',
    description:
      'Failures are classified into 10 mutually exclusive categories. An optional Gemini 3.6 Flash copilot normalizes unstructured error logs into plain explanations with zero financial execution privileges.',
    technicalDetails: [
      '10 deterministic failure categories (bank_downtime, auth_failure, insufficient_funds, etc.).',
      'Authority Invariant: Gemini has zero execution authority and cannot alter amounts or approvals.',
      'Grounded fallback to deterministic rules if API keys are unconfigured.',
    ],
    recommendedAction: {
      label: 'Inspect Queue Classifications',
      tab: 'dashboard',
    },
  },
  {
    id: 7,
    title: 'Human-in-the-Loop Approval Gate',
    category: 'Deep Dive 7 / 10 · Dual Custody',
    badge: 'HIGH-VALUE THRESHOLD > ₹10,000',
    icon: UserCheck,
    headline: 'High-value enterprise invoices halt at an approval gate requiring operator sign-off.',
    description:
      'Invoices exceeding ₹10,000 (1,000,000 paise) or flagged with dispute history require mandatory reviewer authorization and notes before any payment link or retry dispatch.',
    technicalDetails: [
      'Strict governance boundary: High-value items cannot execute without reviewer sign-off.',
      'Operator audit trail captures reviewer note, authorization timestamp, and decision hash.',
      'Hand-Curated Safety Fixture demonstrates this gate with a ₹35,000 enterprise invoice.',
    ],
    recommendedAction: {
      label: 'Load Hand-Curated Safety Fixture',
      tab: 'dashboard',
      provenance: 'hand_curated_safety',
    },
  },
  {
    id: 8,
    title: 'Closed-Loop Outcome Observation',
    category: 'Deep Dive 8 / 10 · Telemetry',
    badge: 'PROACTIVE STATUS POLLING',
    icon: RefreshCw,
    headline: 'Closed-loop settlement verification without exposing public webhook surface area.',
    description:
      'To prevent spoofing and eliminate unauthenticated attack surface, PayBack AI uses outbound status polling (GET /api/recovery/status/:id) and internal telemetry actors.',
    technicalDetails: [
      'Internal Telemetry Actors: outcome_observer (polling) & gateway_webhook (internal telemetry).',
      'Payment link creation explicitly records ₹0.00 recovered until verified settlement.',
      'Duplicate observation prevention blocks duplicate event IDs from double-crediting funds.',
    ],
    recommendedAction: {
      label: 'Inspect Outbound Telemetry',
      tab: 'live_runner',
    },
  },
  {
    id: 9,
    title: 'Reconciled Recovery Accounting',
    category: 'Deep Dive 9 / 10 · Zero Drift',
    badge: 'ZERO PAISE DRIFT PROOF',
    icon: TrendingUp,
    headline: 'Mutually exclusive batch partitions satisfying exact financial balance equations.',
    description:
      'Gross revenue at risk balances 100% with the sum of safety halted, awaiting approval, deferred, in-flight, and verified synthetic recovered funds across every batch.',
    technicalDetails: [
      'Equation 1: Gross at Risk = Halted + Review + Deferred + In-Flight + Recovered.',
      'Equation 2: Remaining Exposure = Halted + Review + Deferred + In-Flight.',
      'All monetary accounting uses integer paise without floating-point precision loss.',
    ],
    recommendedAction: {
      label: 'View Reconciled Waterfall',
      tab: 'evaluation_lab',
    },
  },
  {
    id: 10,
    title: 'Stopping Rules & Compliance Guardrails',
    category: 'Deep Dive 10 / 10 · Compliance',
    badge: 'ZERO OPT-OUT VIOLATIONS',
    icon: Shield,
    headline: 'Hard stopping rules prevent harassment, wasted fees, and regulatory friction.',
    description:
      'Customers who opt out, accounts that are permanently closed, or payments exceeding 3 prior attempts are permanently suppressed from retries and routed to collections review.',
    technicalDetails: [
      'Customer Privacy: Immediate halt on opt_out = true (0 opt-out violations observed).',
      'Hard Attempt Cap: Suppressed after 3 prior recovery cycles.',
      'Quiet-Hours Protection: Messages scheduled strictly within 9:00 AM – 8:00 PM local time.',
    ],
    recommendedAction: {
      label: 'Inspect Safety Guardrails',
      tab: 'dashboard',
    },
  },
];

export const JUDGE_STEPS = DEEP_DIVE_STEPS;

export const JudgeModeModal: React.FC<JudgeModeModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onSetProvenance,
}) => {
  const [viewMode, setViewMode] = useState<'curated' | 'deep_dive'>('curated');
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  const activeSteps = viewMode === 'curated' ? CURATED_5_STEPS : DEEP_DIVE_STEPS;
  const step = activeSteps[currentStepIndex] || activeSteps[0];

  const handleNext = useCallback(() => {
    if (currentStepIndex < activeSteps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  }, [currentStepIndex, activeSteps.length]);

  const handlePrev = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  // Keyboard navigation handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose]);

  if (!isOpen) return null;

  const IconComponent = step.icon;

  const handleExecuteAction = () => {
    if (step.recommendedAction) {
      onNavigateTab(step.recommendedAction.tab);
      if (step.recommendedAction.provenance) {
        onSetProvenance(step.recommendedAction.provenance);
      }
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="judge-modal-title"
    >
      <div
        className="bg-slate-900 border border-slate-700 text-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col my-auto focus:outline-none"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {/* ── Modal Header ─────────────────────────────────────────── */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Award className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 id="judge-modal-title" className="text-sm font-bold text-white flex items-center gap-2">
                Judge Mode — {viewMode === 'curated' ? '5-Minute Pitch Path' : 'Complete 10-Step Deep Dive'}
                <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                  Stop {step.id} of {activeSteps.length}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Track 3: AI Revenue Recovery · Guided Submission Walkthrough
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close Judge Mode"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Pitch Mode vs Deep Dive Mode Selector ─────────────────── */}
        <div className="bg-slate-950/80 px-6 py-2 border-b border-slate-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => {
                setViewMode('curated');
                setCurrentStepIndex(0);
              }}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer ${
                viewMode === 'curated'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ⭐ 5-Stop Pitch (Recommended)
            </button>
            <button
              onClick={() => {
                setViewMode('deep_dive');
                setCurrentStepIndex(0);
              }}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer ${
                viewMode === 'deep_dive'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🔬 All 10 Deep Dives
            </button>
          </div>

          <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
            Use ← → arrow keys to navigate
          </span>
        </div>

        {/* ── Step Progress Indicator ──────────────────────────────── */}
        <div className="bg-slate-950/50 px-6 py-2 border-b border-slate-800/80 flex items-center justify-between gap-1 overflow-x-auto">
          {activeSteps.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => setCurrentStepIndex(idx)}
              className={`flex-1 h-1.5 rounded-full transition-all cursor-pointer ${
                idx === currentStepIndex
                  ? 'bg-indigo-500 ring-2 ring-indigo-400/40'
                  : idx < currentStepIndex
                  ? 'bg-emerald-500'
                  : 'bg-slate-800 hover:bg-slate-700'
              }`}
              title={`Stop ${s.id}: ${s.title}`}
              aria-label={`Jump to Stop ${s.id}: ${s.title}`}
            />
          ))}
        </div>

        {/* ── Step Body ────────────────────────────────────────────── */}
        <div className="p-6 space-y-5 text-xs overflow-y-auto max-h-[70vh]">
          <div className="flex items-start gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <IconComponent className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-semibold">
                  {step.category}
                </span>
                <span className="text-[9px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 font-bold">
                  {step.badge}
                </span>
              </div>
              <h4 className="text-base font-bold text-white leading-snug">
                {step.headline}
              </h4>
            </div>
          </div>

          <p className="text-slate-300 leading-relaxed text-xs">
            {step.description}
          </p>

          {/* Technical Invariants Box */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold block">
              Audited Technical Invariants:
            </span>
            <ul className="space-y-1.5 text-slate-300">
              {step.technicalDetails.map((detail, dIdx) => (
                <li key={dIdx} className="flex items-start gap-2 text-[11px] leading-normal">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Modal Footer Controls ────────────────────────────────── */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {step.recommendedAction && (
              <button
                onClick={handleExecuteAction}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <span>{step.recommendedAction.label}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={handlePrev}
              disabled={currentStepIndex === 0}
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 transition cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            {currentStepIndex < activeSteps.length - 1 ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                <span>Next Step</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={onClose}
                className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Complete Tour</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
