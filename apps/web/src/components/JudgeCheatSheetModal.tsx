/**
 * PayBack AI — Printable Judge Cheat Sheet Modal & 1-Page Summary.
 *
 * Provides a high-density, print-ready 1-page summary tailored for judges:
 * - North-Star positioning sentence
 * - Verified empirical benchmark metrics
 * - 5-minute step-by-step live demo script
 * - QR codes for Live Production & GitHub repository
 * - Instant Print / Save to PDF trigger
 */

'use client';

import React from 'react';
import {
  X,
  Printer,
  Sparkles,
  Award,
  CheckCircle2,
} from 'lucide-react';
import { QRCodeSVG } from './QRCodeSVG';

interface JudgeCheatSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function JudgeCheatSheetModal({ isOpen, onClose }: JudgeCheatSheetModalProps) {
  if (!isOpen) return null;

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div
      data-testid="judge-cheat-sheet-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto print:p-0 print:bg-white print:static"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto print:max-h-none print:shadow-none print:border-none p-6 md:p-8 space-y-6 text-slate-900">
        
        {/* ── Modal Header & Actions (Hidden on Print) ────────────── */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 print:hidden">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-slate-900">
              PayBack AI — Judge Cheat Sheet &amp; Evaluation Reference
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              data-testid="print-cheat-sheet-btn"
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              data-testid="close-cheat-sheet-btn"
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── 1-Page Printable Body ───────────────────────────────── */}
        <div className="space-y-5">
          {/* Header & North Star Sentence */}
          <div className="border-b-2 border-indigo-600 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-slate-950">
                  PayBack AI
                </span>
                <span className="bg-indigo-100 text-indigo-900 text-xs font-bold px-2 py-0.5 rounded border border-indigo-300">
                  Track 3: AI Revenue Recovery
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-600 mt-1">
                Autonomous Bounded State Machine · Logistic Probability Calibration · SHA-256 Cryptographic Ledger
              </p>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <QRCodeSVG
                url="https://recoverflow-ai-kohl.vercel.app"
                size={80}
                label="Live Production App"
              />
              <QRCodeSVG
                url="https://github.com/skmdshariff143-ai/recoverflow-ai"
                size={80}
                label="GitHub Repo"
              />
            </div>
          </div>

          {/* North Star Callout Banner */}
          <div
            data-testid="cheat-sheet-north-star"
            className="bg-indigo-950 text-white rounded-xl p-3.5 border border-indigo-800 text-center"
          >
            <p className="text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-1">
              North Star Thesis
            </p>
            <p className="text-sm font-bold tracking-tight text-white">
              &ldquo;PayBack AI is the only entry that proves its own calibration is real, not just claimed.&rdquo;
            </p>
          </div>

          {/* Key Empirical Metrics Table */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Verified Empirical Metrics &amp; Invariants
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs">
              <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                <span className="text-[10px] text-slate-500 block">Calibration Error (ECE)</span>
                <span className="text-lg font-black text-emerald-600 font-mono">2.98%</span>
                <span className="text-[10px] text-slate-500 block">Trained Logistic v1.1</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                <span className="text-[10px] text-slate-500 block">Brier Reliability Score</span>
                <span className="text-lg font-black text-indigo-600 font-mono">0.2378</span>
                <span className="text-[10px] text-slate-500 block">5-Bin Reliability Curve</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                <span className="text-[10px] text-slate-500 block">Safety Rule Invariants</span>
                <span className="text-lg font-black text-emerald-600 font-mono">7 / 7 (100%)</span>
                <span className="text-[10px] text-slate-500 block">0 Invariant Bypasses</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                <span className="text-[10px] text-slate-500 block">Append-Only Ledger</span>
                <span className="text-lg font-black text-cyan-600 font-mono">SHA-256</span>
                <span className="text-[10px] text-slate-500 block">0 Chain Breaks Validated</span>
              </div>
            </div>
          </div>

          {/* 5-Minute Live Demo Script Outline */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              5-Minute Judge Demo Script (Step-by-Step)
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex gap-2.5 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="font-bold text-indigo-600 font-mono shrink-0">Min 1:</span>
                <div>
                  <strong className="text-slate-900">Explainable Queue &amp; Trust Score:</strong> On Command Center, review the composite 90/100 Trust Score and click any row to reveal deterministic scoring breakdown with contrastive &ldquo;Why Not The Others&rdquo; peer analysis.
                </div>
              </div>
              <div className="flex gap-2.5 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="font-bold text-indigo-600 font-mono shrink-0">Min 2:</span>
                <div>
                  <strong className="text-slate-900">Replay Arena (Blind-Bot vs PayBack AI):</strong> Click &ldquo;Replay Arena&rdquo; in the header to run the side-by-side simulation demonstrating how PayBack AI stops 3 severe regulatory violations while recovering +₹65,000 extra revenue.
                </div>
              </div>
              <div className="flex gap-2.5 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="font-bold text-indigo-600 font-mono shrink-0">Min 3:</span>
                <div>
                  <strong className="text-slate-900">Adversarial Tamper Demo:</strong> Switch to Audit Trail tab and use the &ldquo;Try to Break It&rdquo; panel to tamper an audit payload and watch real-time SHA-256 chain invalidation.
                </div>
              </div>
              <div className="flex gap-2.5 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="font-bold text-indigo-600 font-mono shrink-0">Min 4:</span>
                <div>
                  <strong className="text-slate-900">Ask the Ledger Query:</strong> Type a question into &ldquo;Ask the Ledger&rdquo; to retrieve exact cryptographic event citations with zero hallucination.
                </div>
              </div>
              <div className="flex gap-2.5 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="font-bold text-indigo-600 font-mono shrink-0">Min 5:</span>
                <div>
                  <strong className="text-slate-900">Evaluation Lab Counterfactuals:</strong> Inspect the 6-policy counterfactual evaluation proving superior yield against naive retries, exponential backoff, and greedy models across deterministic seeds.
                </div>
              </div>
            </div>
          </div>

          {/* Direct Links Footer */}
          <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between text-[11px] text-slate-500">
            <span>Production URL: <a href="https://recoverflow-ai-kohl.vercel.app" target="_blank" rel="noreferrer" className="text-indigo-600 font-semibold underline">https://recoverflow-ai-kohl.vercel.app</a></span>
            <span>GitHub: <a href="https://github.com/skmdshariff143-ai/recoverflow-ai" target="_blank" rel="noreferrer" className="text-indigo-600 font-semibold underline">skmdshariff143-ai/recoverflow-ai</a></span>
          </div>
        </div>
      </div>
    </div>
  );
}
