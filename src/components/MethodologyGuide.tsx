/**
 * RecoverFlow AI — Methodology, Governance, & Judge Submission Guide.
 */

'use client';

import React from 'react';
import {
  BookOpen,
  Shield,
  Bot,
  Scale,
  CheckCircle2,
  FileText,
  Clock,
} from 'lucide-react';

export function MethodologyGuide() {
  return (
    <div className="space-y-6">
      {/* ── Main Methodology Overview ────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              Methodology, Governance &amp; Judge Evaluation Guide
            </h2>
            <span className="bg-indigo-100 text-indigo-800 text-[11px] font-bold px-2 py-0.5 rounded-full border border-indigo-300">
              Track 3: AI Revenue Recovery
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Technical foundations, mathematical proofs, AI responsibility boundaries, and the 5-minute judge demo script.
          </p>
        </div>

        {/* ── 5-Minute Judge Demo Script ──────────────────────────── */}
        <div className="mt-6 bg-gradient-to-r from-slate-900 to-indigo-950 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-400" />
              5-Minute Structured Pitch &amp; Live Evaluation Script
            </span>
            <span className="text-[11px] text-slate-400">Judge-Ready Walkthrough</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
            <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
              <span className="font-bold text-amber-400 block mb-1">0:00 – 0:35 (Problem)</span>
              <p className="text-slate-300 leading-relaxed">
                Why blind rule cascades waste gateway fees and harass customers. How RecoverFlow AI converts failure into an EV-ranked queue.
              </p>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
              <span className="font-bold text-emerald-400 block mb-1">0:35 – 1:50 (Closed-Loop)</span>
              <p className="text-slate-300 leading-relaxed">
                Demonstrate the multi-cycle state machine (`DETECTED` $\to$ `DIAGNOSED` $\to$ `EXECUTED` $\to$ `RECOVERED`) with quiet-hours scheduling.
              </p>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
              <span className="font-bold text-cyan-400 block mb-1">1:50 – 2:45 (Safeguards)</span>
              <p className="text-slate-300 leading-relaxed">
                Show 100% enforcement of opt-out rules, attempt caps ($\le 3$), and the high-value enterprise approval gate.
              </p>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
              <span className="font-bold text-indigo-400 block mb-1">2:45 – 3:35 (Evaluation Lab)</span>
              <p className="text-slate-300 leading-relaxed">
                Open Evaluation Lab. Prove +470% net incremental recovery over Fixed Retry Control on identical frozen outcomes.
              </p>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
              <span className="font-bold text-rose-400 block mb-1">3:35 – 5:00 (Honest Post-Mortem)</span>
              <p className="text-slate-300 leading-relaxed">
                Explain what broke (earlier circular calibration defect), how independent outcomes fixed it, and show the SHA-256 ledger.
              </p>
            </div>
          </div>
        </div>

        {/* ── Strict AI vs Non-AI Responsibility Boundary ─────────── */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* What Gemini AI Does */}
          <div className="bg-indigo-50/50 border border-indigo-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-indigo-900 flex items-center gap-2 mb-2">
              <Bot className="w-4 h-4 text-indigo-600" />
              Where AI is Used (Natural Language &amp; Reasoning)
            </h3>
            <ul className="text-xs text-slate-700 space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span><strong>Gateway Error Normalization:</strong> Interprets cryptic, non-standard bank error strings into standard taxonomy categories.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span><strong>Customer Communication Drafting:</strong> Crafts empathetic, policy-constrained prototype payment link recovery messages across SMS/Email.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span><strong>Reviewer Case Summaries:</strong> Summarizes historical customer discipline to accelerate manual high-value invoice approvals.</span>
              </li>
            </ul>
          </div>

          {/* What AI Strictly NEVER Does */}
          <div className="bg-rose-50/50 border border-rose-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-rose-900 flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-rose-600" />
              Where AI is Strictly Forbidden (Deterministic Invariants)
            </h3>
            <ul className="text-xs text-slate-700 space-y-2">
              <li className="flex items-start gap-2">
                <Scale className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span><strong>Monetary Arithmetic &amp; EV:</strong> Calculations are strictly integer-paise based (bps × amountPaise / 10,000) — no LLM math.</span>
              </li>
              <li className="flex items-start gap-2">
                <Scale className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span><strong>Safety Filter &amp; Attempt Caps:</strong> Hard-coded stopping rules execute prior to any model or queue ranking.</span>
              </li>
              <li className="flex items-start gap-2">
                <Scale className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span><strong>State Machine Transitions:</strong> Only deterministic engine actors and authenticated human reviewers can transition state.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* ── Mathematical Formulations ──────────────────────────── */}
        <div className="mt-6 border-t border-slate-100 pt-4 space-y-3 text-xs">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-700" />
            Core Mathematical Formulations &amp; Invariants
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-800 block mb-1">Expected Value Calculation (Integer Paise):</span>
              <p className="font-mono text-slate-700 text-[11px]">
                expectedValuePaise = Math.round((amountPaise * recoveryProbabilityBps) / 10,000)
              </p>
              <span className="text-[10px] text-slate-500 block mt-1">Prevents float rounding drift and preserves penny-level ledger accuracy.</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-800 block mb-1">Brier Score Calibration Metric:</span>
              <p className="font-mono text-slate-700 text-[11px]">
                Brier Score = (1/N) * Σ (p_predicted - y_actual)^2
              </p>
              <span className="text-[10px] text-slate-500 block mt-1">Proper strictly proper scoring rule. Lower is better (0.0 = perfect probabilistic foresight).</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
