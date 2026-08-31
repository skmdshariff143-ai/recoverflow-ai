/**
 * PayBack AI — Methodology, Governance, & Judge Submission Guide.
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
  Lock,
  Cpu,
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
                Why blind rule cascades waste gateway fees and harass customers. How PayBack AI converts failure into an EV-ranked queue.
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
        <div className="mt-6 space-y-4">
          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-indigo-600" />
              Strict AI vs Non-AI Responsibility Boundary
            </h3>
            <p className="text-xs text-slate-500">
              Enforced by physical module separation in code: <code className="bg-slate-100 text-indigo-700 px-1.5 py-0.5 rounded font-mono text-[11px]">src/lib/ai/</code> has <strong>zero write access</strong> to payment state, ledger hashes, or execution triggers.
            </p>
          </div>

          {/* Visual Architecture Flow Banner */}
          <div className="bg-slate-950 text-white rounded-xl p-4 border border-slate-800 space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Architectural Isolation Topology</span>
              <span className="text-emerald-400 flex items-center gap-1 font-mono">
                <CheckCircle2 className="w-3 h-3" />
                Zero Execution Privileges in AI Layer
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {/* Left: AI Advisory */}
              <div className="bg-indigo-950/60 border border-indigo-500/30 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-indigo-300 font-bold">
                  <Bot className="w-4 h-4" />
                  <span>Bounded AI Copilot</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  • Error log normalization<br/>
                  • Draft reminder proposal<br/>
                  • Reviewer natural language summaries
                </p>
                <div className="text-[10px] text-indigo-400 font-mono bg-indigo-900/40 px-2 py-0.5 rounded border border-indigo-500/20">
                  Advisory Layer Only (Read-Only)
                </div>
              </div>

              {/* Center: Enforcement Barrier */}
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 flex flex-col items-center justify-center text-center space-y-1">
                <div className="p-1.5 bg-rose-500/20 text-rose-400 rounded-full">
                  <Lock className="w-4 h-4" />
                </div>
                <span className="font-bold text-white text-xs">Isolation Barrier</span>
                <span className="text-[10px] text-slate-400">
                  Zero state mutations • Zero direct dispatch • Pure functional responses
                </span>
                <span className="text-[9px] font-mono text-slate-500">src/lib/ai/geminiClient.ts</span>
              </div>

              {/* Right: Deterministic Core */}
              <div className="bg-emerald-950/60 border border-emerald-500/30 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
                  <Cpu className="w-4 h-4" />
                  <span>Deterministic Engine</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  • Integer paise EV calculations<br/>
                  • Hard safety stopping invariants<br/>
                  • SHA-256 cryptographic ledger append
                </p>
                <div className="text-[10px] text-emerald-400 font-mono bg-emerald-900/40 px-2 py-0.5 rounded border border-emerald-500/20">
                  Sole Execution &amp; State Authority
                </div>
              </div>
            </div>
          </div>

          {/* Two-Column Detail Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* What Gemini AI Does */}
            <div className="bg-indigo-50/50 border border-indigo-200 rounded-xl p-4">
              <h4 className="text-xs font-bold text-indigo-900 flex items-center gap-2 mb-2">
                <Bot className="w-4 h-4 text-indigo-600" />
                Where AI is Permitted (Natural Language &amp; Reasoning)
              </h4>
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
              <h4 className="text-xs font-bold text-rose-900 flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-rose-600" />
                Where AI is Strictly Forbidden (Deterministic Invariants)
              </h4>
              <ul className="text-xs text-slate-700 space-y-2">
                <li className="flex items-start gap-2">
                  <Scale className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span><strong>Monetary Arithmetic &amp; EV:</strong> Calculations are strictly integer-paise based (<code className="font-mono text-[11px]">Math.round(amountPaise * bps / 10000)</code>) — zero LLM math.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Scale className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span><strong>Safety Filter &amp; Attempt Caps:</strong> Hard-coded stopping rules execute prior to any model or queue ranking (<code className="font-mono text-[11px]">src/lib/engine/safetyFilter.ts</code>).</span>
                </li>
                <li className="flex items-start gap-2">
                  <Scale className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span><strong>State Transitions:</strong> Only deterministic engine actors and authenticated human reviewers can transition state (<code className="font-mono text-[11px]">src/lib/engine/stateMachine.ts</code>).</span>
                </li>
              </ul>
            </div>
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
