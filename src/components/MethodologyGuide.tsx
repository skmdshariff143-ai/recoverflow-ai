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
  AlertOctagon,
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

        {/* ── What We Got Wrong (And How We Know It's Fixed) ─────── */}
        <div className="mt-6 border-t border-slate-100 pt-5 space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-amber-600" />
                What We Got Wrong (And How We Know It&apos;s Fixed)
              </h3>
              <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300">
                Transparent Post-Mortems
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Real architectural defects discovered during adversarial auditing, and the deterministic regression tests guarding them.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Defect 1: Circular Calibration */}
            <div className="bg-amber-50/40 border border-amber-200 rounded-xl p-4 space-y-2.5 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-950 text-xs">1. Circular Calibration Defect</span>
                  <span className="text-[10px] font-mono text-rose-700 font-bold bg-rose-100 px-1.5 py-0.5 rounded">High Risk</span>
                </div>
                <p className="text-slate-700 leading-relaxed text-[11px]">
                  <strong>What Broke:</strong> Early versions evaluated model predictions against outcomes generated by the same heuristic formulas, creating a circular feedback loop with an artificial 15.38% calibration error.
                </p>
                <p className="text-slate-700 leading-relaxed text-[11px]">
                  <strong>The Fix:</strong> Decoupled ground-truth matrices completely into independent frozen benchmark files (<code className="font-mono text-[10px]">data/frozen-outcomes-200.json</code>) evaluated via strictly proper Brier scoring.
                </p>
              </div>
              <div className="pt-2 border-t border-amber-200/60 font-mono text-[10px] text-amber-900 bg-amber-100/50 p-2 rounded">
                <span className="font-bold block text-slate-900">Guarding Regression Test:</span>
                <code>src/lib/engine/__tests__/counterfactualEvaluation.test.ts</code>
              </div>
            </div>

            {/* Defect 2: Payment Link Accounting */}
            <div className="bg-indigo-50/40 border border-indigo-200 rounded-xl p-4 space-y-2.5 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-950 text-xs">2. Payment-Link Settlement Invariant</span>
                  <span className="text-[10px] font-mono text-indigo-700 font-bold bg-indigo-100 px-1.5 py-0.5 rounded">Fintech Core</span>
                </div>
                <p className="text-slate-700 leading-relaxed text-[11px]">
                  <strong>What Broke:</strong> Dispatching a payment link was initially marked as &quot;recovered revenue&quot;, overstating recovered funds before the customer actually settled the invoice.
                </p>
                <p className="text-slate-700 leading-relaxed text-[11px]">
                  <strong>The Fix:</strong> Link dispatch enforces <code className="font-mono text-[10px]">settledAmountPaise = 0</code>. Revenue is credited only after the proactive Outcome Observer polls the gateway and confirms settlement.
                </p>
              </div>
              <div className="pt-2 border-t border-indigo-200/60 font-mono text-[10px] text-indigo-900 bg-indigo-100/50 p-2 rounded">
                <span className="font-bold block text-slate-900">Guarding Regression Test:</span>
                <code>src/lib/engine/__tests__/closedLoopProductFlow.test.ts</code>
              </div>
            </div>

            {/* Defect 3: Serverless State Fragmentation */}
            <div className="bg-emerald-50/40 border border-emerald-200 rounded-xl p-4 space-y-2.5 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-950 text-xs">3. Serverless State Inconsistency</span>
                  <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded">Architecture</span>
                </div>
                <p className="text-slate-700 leading-relaxed text-[11px]">
                  <strong>What Broke:</strong> In serverless Lambda environments, in-memory status stores were not shared across instances, causing status polling to return inconsistent 404s.
                </p>
                <p className="text-slate-700 leading-relaxed text-[11px]">
                  <strong>The Fix:</strong> Switched to stateless SHA-256 HMAC simulator receipts (<code className="font-mono text-[10px]">computeSimulatorChecksum</code>), allowing any serverless worker to reconstruct verified outcomes.
                </p>
              </div>
              <div className="pt-2 border-t border-emerald-200/60 font-mono text-[10px] text-emerald-900 bg-emerald-100/50 p-2 rounded">
                <span className="font-bold block text-slate-900">Guarding Regression Test:</span>
                <code>scripts/verify-outcome-consistency.ts</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
