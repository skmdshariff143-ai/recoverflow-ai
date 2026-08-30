/**
 * RecoverFlow AI — Guided Submission Experience (Judge Mode).
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
  Zap,
  UserCheck,
  Cpu,
  RefreshCw,
  TrendingUp,
  Shield,
  FileCheck2,
  FileCode,
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

export const JUDGE_STEPS: StepContent[] = [
  {
    id: 1,
    title: 'Problem & Batch Ingestion',
    category: '1. Detect Revenue at Risk',
    badge: '100 INVOICES / ₹6.88L AT RISK',
    icon: ShieldAlert,
    headline: 'High-volume merchants burn fees on blind retries during gateway downtime.',
    description:
      'RecoverFlow AI ingests failed payment records and immediately computes revenue exposure in strict integer paise. Each invoice is mapped with customer history, tenure, and prior attempts.',
    technicalDetails: [
      'Ingests 100 failed transactions totaling ₹6,87,694.53 (68,769,453 paise).',
      'All monetary accounting uses integer paise. Expected-value calculations convert probability scores to integer basis points before applying them to money.',
      'Parses raw gateway strings, error codes, and customer communication preferences.',
    ],
    recommendedAction: {
      label: 'View Command Center & Queue',
      tab: 'dashboard',
      provenance: 'synthetic_fixture',
    },
  },
  {
    id: 2,
    title: 'Diagnostic Error Classification',
    category: '2. Diagnose Root Cause',
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
    id: 3,
    title: 'Intervention & Expected Value',
    category: '3. Determine Intervention',
    badge: 'EV = AMOUNT × BPS / 10000',
    icon: Zap,
    headline: 'Expected Value ranking allocates limited contact capacity to highest-yield invoices.',
    description:
      'Rather than retry every transaction blindly, RecoverFlow AI calculates recovery probability (basis points) and Expected Value in integer paise, selecting from retry, reminder, both, or none.',
    technicalDetails: [
      'Expected Value: EV_paise = round(amount_paise * bps / 10000).',
      'Intervention strategy: retry (downtime), reminder (auth/funds), both, or none (closed).',
      'Budget capacity slider dynamically allocates top-ranked priority slots.',
    ],
    recommendedAction: {
      label: 'Adjust Budget Slider',
      tab: 'dashboard',
    },
  },
  {
    id: 4,
    title: 'Human-in-the-Loop Approval Gate',
    category: '4. Governance & Safety',
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
    id: 5,
    title: 'Execution Adapter Boundary',
    category: '5. Execute Intervention',
    badge: 'SIMULATOR & TEST-MODE ADAPTER',
    icon: Cpu,
    headline: 'Secure adapter layer for offline reproducible simulation and Razorpay sandbox.',
    description:
      'Executions dispatch through strict TypeScript adapter boundaries. Live Razorpay keys (rzp_live_*) are strictly rejected at startup. Payment link creation explicitly records ₹0.00 recovered.',
    technicalDetails: [
      'Deterministic Simulator: Instant offline execution for testing and batch evaluation.',
      'Razorpay Test-Mode Adapter: Generates sandbox payment links (rzp_test_* only).',
      'Accounting Invariant: Payment-link creation counts as ₹0.00 recovered until verified settlement.',
    ],
    recommendedAction: {
      label: 'Open Live Recovery Runner',
      tab: 'live_runner',
    },
  },
  {
    id: 6,
    title: 'Outcome Observation Layer',
    category: '6. Observe Settlement',
    badge: 'PROACTIVE STATUS POLLING',
    icon: RefreshCw,
    headline: 'Closed-loop settlement verification without exposing public webhook surface area.',
    description:
      'To prevent spoofing and eliminate unauthenticated attack surface, RecoverFlow AI uses outbound status polling (GET /api/recovery/status/:id) and internal telemetry actors.',
    technicalDetails: [
      'Internal Telemetry Actors: outcome_observer (polling) & gateway_webhook (internal telemetry).',
      'Public webhook receiver (POST /api/recovery/webhook) is permanently removed (HTTP 404).',
      'Duplicate observation prevention blocks duplicate event IDs from double-crediting funds.',
    ],
    recommendedAction: {
      label: 'Inspect Outbound Telemetry',
      tab: 'live_runner',
    },
  },
  {
    id: 7,
    title: 'Reconciled Recovery Accounting',
    category: '7. Financial Accounting',
    badge: 'ZERO PAISE DRIFT PROOF',
    icon: TrendingUp,
    headline: 'Mutually exclusive batch partitions satisfying exact financial balance equations.',
    description:
      'Gross revenue at risk balances 100% with the sum of safety halted, awaiting approval, deferred, in-flight, and verified synthetic recovered funds across every batch.',
    technicalDetails: [
      'Equation 1: Gross at Risk = Halted + Review + Deferred + In-Flight + Recovered.',
      'Equation 2: Remaining Exposure = Halted + Review + Deferred + In-Flight.',
      'All monetary accounting uses integer paise. Expected-value calculations convert probability scores to integer basis points before applying them to money.',
    ],
    recommendedAction: {
      label: 'View Reconciled Waterfall',
      tab: 'evaluation_lab',
    },
  },
  {
    id: 8,
    title: 'Stopping Rules & Escalation',
    category: '8. Guardrails & Compliance',
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
  {
    id: 9,
    title: 'Cryptographic Audit Trail',
    category: '9. Inspect Audit Ledger',
    badge: 'SHA-256 HASH-CHAIN LEDGER',
    icon: FileCheck2,
    headline: 'Append-only tamper-evident ledger where every state transition is chained.',
    description:
      'Every detection, score, approval, execution, and settlement event is recorded into a cryptographic SHA-256 hash chain with real-time browser verification.',
    technicalDetails: [
      'Genesis block anchor with parent hash chaining for all chronological events.',
      'Real-time verification badge detects payload mutation, insertion, or reordering.',
      'One-click exportable audit trail in CSV and structured JSON formats.',
    ],
    recommendedAction: {
      label: 'Inspect Audit Ledger',
      tab: 'audit_ledger',
    },
  },
  {
    id: 10,
    title: 'Evaluation Proof & Judge Pack',
    category: '10. Benchmark Verification',
    badge: 'ONE-CLICK EVIDENCE PACK',
    icon: FileCode,
    headline: 'Honest counterfactual policy evaluation against internally generated frozen matrices.',
    description:
      'Evaluated across 200 Development Records and 80 Held-Out Adversarial Cases against 7 comparative policies. Instant one-click download of the complete Judge Evidence Pack.',
    technicalDetails: [
      'Evaluated against frozen potential outcomes with zero circular prediction loops.',
      'Includes dataset SHA-256 hashes, reproduction CLI command, and limitations disclosure.',
      'Instant export of JSON Evidence Pack and CSV case logs for external audit.',
    ],
    recommendedAction: {
      label: 'Export Judge Evidence Pack',
      tab: 'evaluation_lab',
    },
  },
];

export const JudgeModeModal: React.FC<JudgeModeModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onSetProvenance,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  const step = JUDGE_STEPS[currentStepIndex];

  const handleNext = useCallback(() => {
    if (currentStepIndex < JUDGE_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  }, [currentStepIndex]);

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
                Judge Mode — 10-Step Submission Walkthrough
                <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                  Step {step.id} of {JUDGE_STEPS.length}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Track 3: AI Revenue Recovery · Guided Product Verification
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

        {/* ── Step Progress Indicator ──────────────────────────────── */}
        <div className="bg-slate-950/50 px-6 py-2 border-b border-slate-800/80 flex items-center justify-between gap-1 overflow-x-auto">
          {JUDGE_STEPS.map((s, idx) => (
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
              title={`Step ${s.id}: ${s.title}`}
              aria-label={`Jump to Step ${s.id}: ${s.title}`}
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

            {currentStepIndex < JUDGE_STEPS.length - 1 ? (
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
