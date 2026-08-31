/**
 * PayBack AI — Blind-Bot vs PayBack AI Side-by-Side Replay Arena.
 *
 * Real-time animated split-screen comparing naive brute-force retry scripts
 * against PayBack AI's calibrated, safety-first recovery pipeline across
 * 10 representative failure cases.
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  X,
  ShieldCheck,
  TrendingUp,
  AlertOctagon,
  Swords,
} from 'lucide-react';
import {
  REPLAY_SAMPLE_CASES,
  computeReplayScorecards,
  type ReplayPaymentCase,
} from '@/lib/engine/replayData';

interface BlindBotReplayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BlindBotReplayModal({ isOpen, onClose }: BlindBotReplayModalProps) {
  if (!isOpen) return null;

  return <BlindBotReplayContent onClose={onClose} />;
}

function BlindBotReplayContent({ onClose }: { onClose: () => void }) {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 1x = 1600ms, 2x = 800ms, 4x = 400ms
  const isFinished = currentIndex >= REPLAY_SAMPLE_CASES.length;

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isPlaying || isFinished) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const intervalMs = Math.round(1600 / playbackSpeed);
    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev + 1 >= REPLAY_SAMPLE_CASES.length) {
          setIsPlaying(false);
          return REPLAY_SAMPLE_CASES.length;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, isFinished, playbackSpeed]);

  const activeCase: ReplayPaymentCase | undefined =
    currentIndex < REPLAY_SAMPLE_CASES.length ? REPLAY_SAMPLE_CASES[currentIndex] : undefined;

  const processedCases = REPLAY_SAMPLE_CASES.slice(0, isFinished ? REPLAY_SAMPLE_CASES.length : currentIndex + 1);
  const { naiveScorecard, paybackScorecard } = computeReplayScorecards(processedCases);

  const formatINR = (paise: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(paise / 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* ── Modal Header ────────────────────────────────────────── */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-gradient-to-br from-rose-500 to-indigo-600 text-white shadow-md">
              <Swords className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Blind-Bot vs PayBack AI — Live Head-to-Head Arena
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Side-by-Side Replay
                </span>
              </div>
              <p className="text-xs text-slate-400">
                10 identical failed invoices replayed simultaneously: Naive Brute-Force vs Calibrated Safety Pipeline.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            data-testid="close-replay-modal"
            aria-label="Close Replay Arena"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Playback Controls & Progress Bar ────────────────────── */}
        <div className="px-5 py-3 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              data-testid="toggle-playback-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-xs transition cursor-pointer"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isPlaying ? 'Pause' : isFinished ? 'Replay' : 'Resume'}
            </button>

            <button
              onClick={() => {
                setCurrentIndex(0);
                setIsPlaying(true);
              }}
              data-testid="restart-replay-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restart
            </button>

            <button
              onClick={() => {
                setCurrentIndex(REPLAY_SAMPLE_CASES.length);
                setIsPlaying(false);
              }}
              data-testid="skip-replay-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition cursor-pointer"
            >
              <FastForward className="w-3.5 h-3.5 text-amber-400" />
              Skip to Scorecard
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-slate-400">
              <span>Speed:</span>
              {[1, 2, 4].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                    playbackSpeed === spd
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            <div className="font-mono text-slate-300 font-semibold">
              Invoice {Math.min(currentIndex + 1, REPLAY_SAMPLE_CASES.length)} / {REPLAY_SAMPLE_CASES.length}
            </div>
          </div>
        </div>

        {/* ── Active Replay Arena (Split Screen) ──────────────────── */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Active Payment Inspector Banner */}
          {activeCase && !isFinished && (
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-indigo-400 text-sm">
                  {activeCase.paymentId}
                </span>
                <span className="text-slate-400">|</span>
                <span className="font-semibold text-white">
                  {formatINR(activeCase.amountPaise)}
                </span>
                <span className="text-slate-400">|</span>
                <span className="bg-slate-700 text-slate-200 px-2 py-0.5 rounded text-[11px] font-mono">
                  {activeCase.failureCategory.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {activeCase.isOptedOut && (
                  <span className="bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                    Customer Opted Out
                  </span>
                )}
                <span className="text-slate-400 text-[11px]">
                  Customer: {activeCase.customerId}
                </span>
              </div>
            </div>
          )}

          {/* Split Screen Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* LEFT COLUMN: Naive Blind-Bot */}
            <div className="bg-rose-950/20 border border-rose-900/50 rounded-xl p-4.5 space-y-4">
              <div className="flex items-center justify-between border-b border-rose-900/40 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <h3 className="font-bold text-rose-200 text-sm">
                    Naive &ldquo;Blind-Bot&rdquo;
                  </h3>
                </div>
                <span className="text-[10px] font-mono bg-rose-900/40 text-rose-300 px-2 py-0.5 rounded border border-rose-800">
                  Fixed 3x Retry Script
                </span>
              </div>

              {/* Running Scorecard Mini Bar */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Attempts Used</div>
                  <div className="font-bold text-slate-200 font-mono text-sm">
                    {naiveScorecard.totalAttempts}
                  </div>
                </div>
                <div className="bg-rose-950/50 p-2 rounded-lg border border-rose-800">
                  <div className="text-rose-400 text-[10px] font-semibold">Violations</div>
                  <div className="font-black text-rose-300 font-mono text-sm">
                    {naiveScorecard.safetyViolations}
                  </div>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Recovered</div>
                  <div className="font-bold text-rose-300 font-mono text-sm">
                    {formatINR(naiveScorecard.revenueRecoveredPaise)}
                  </div>
                </div>
              </div>

              {/* Action Feed for Naive Bot */}
              <div className="space-y-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-400">
                  Recent Actions
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {processedCases.map((c) => (
                    <div
                      key={c.id}
                      className={`p-2.5 rounded-lg text-xs space-y-1 border transition ${
                        c.naiveBot.violationType
                          ? 'bg-rose-950/60 border-rose-600/80 text-rose-200'
                          : 'bg-slate-900/70 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono font-bold text-slate-200">{c.paymentId}</span>
                        <span className="font-mono text-slate-400">{formatINR(c.amountPaise)}</span>
                      </div>
                      <p className="text-[11px]">{c.naiveBot.action}</p>
                      {c.naiveBot.violationDetail && (
                        <div
                          data-testid="naive-violation-badge"
                          className="flex items-center gap-1 text-[10px] font-black text-rose-300 bg-rose-900/80 border border-rose-500 px-1.5 py-0.5 rounded"
                        >
                          <AlertOctagon className="w-3 h-3 text-rose-300 shrink-0" />
                          <span>{c.naiveBot.violationDetail}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: PayBack AI Pipeline */}
            <div className="bg-emerald-950/20 border border-emerald-900/50 rounded-xl p-4.5 space-y-4">
              <div className="flex items-center justify-between border-b border-emerald-900/40 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <h3 className="font-bold text-emerald-200 text-sm">
                    PayBack AI Engine
                  </h3>
                </div>
                <span className="text-[10px] font-mono bg-emerald-900/40 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800">
                  Calibrated + Safety-Gated
                </span>
              </div>

              {/* Running Scorecard Mini Bar */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Attempts Used</div>
                  <div className="font-bold text-emerald-400 font-mono text-sm">
                    {paybackScorecard.totalAttempts}
                  </div>
                </div>
                <div className="bg-emerald-950/50 p-2 rounded-lg border border-emerald-800">
                  <div className="text-emerald-400 text-[10px] font-semibold">Violations</div>
                  <div className="font-black text-emerald-300 font-mono text-sm">
                    0 (Zero)
                  </div>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Recovered</div>
                  <div className="font-bold text-emerald-400 font-mono text-sm">
                    {formatINR(paybackScorecard.revenueRecoveredPaise)}
                  </div>
                </div>
              </div>

              {/* Action Feed for PayBack AI */}
              <div className="space-y-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                  Pipeline Execution
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {processedCases.map((c) => (
                    <div
                      key={c.id}
                      className={`p-2.5 rounded-lg text-xs space-y-1 border transition ${
                        c.paybackAi.safetyDecision === 'stopped'
                          ? 'bg-amber-950/30 border-amber-800/60 text-amber-200'
                          : 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono font-bold text-slate-200">{c.paymentId}</span>
                        <div className="flex items-center gap-1.5">
                          {c.paybackAi.recovered ? (
                            <span className="text-emerald-400 font-semibold font-mono">
                              +{formatINR(c.paybackAi.recoveredAmountPaise)}
                            </span>
                          ) : (
                            <span className="text-amber-400 font-semibold">Protected</span>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px]">{c.paybackAi.safetyReason}</p>
                      <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-300">
                        <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>Compliance: {c.paybackAi.complianceStatus}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Final Head-to-Head Scorecard (When Finished) ─────── */}
          {isFinished && (
            <div
              data-testid="replay-final-scorecard"
              className="bg-gradient-to-br from-slate-900 via-indigo-950/50 to-slate-900 border-2 border-indigo-500/80 rounded-2xl p-5 space-y-4 shadow-xl animate-in zoom-in-95 duration-300"
            >
              <div className="flex items-center justify-between border-b border-indigo-900/60 pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-400" />
                  <h4 className="font-bold text-white text-base">
                    Final Head-to-Head Outcome Scorecard
                  </h4>
                </div>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  PayBack AI Outperforms Naive Bot by 7.3x Yield
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="py-2 px-3">Evaluation Dimension</th>
                      <th className="py-2 px-3 text-rose-400">Naive &ldquo;Blind-Bot&rdquo;</th>
                      <th className="py-2 px-3 text-emerald-400">PayBack AI</th>
                      <th className="py-2 px-3 text-indigo-300">Advantage / Impact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    <tr>
                      <td className="py-2.5 px-3 font-semibold">Total Attempts Burned</td>
                      <td className="py-2.5 px-3 font-mono text-rose-300 font-bold">30 (3.0 per invoice)</td>
                      <td className="py-2.5 px-3 font-mono text-emerald-300 font-bold">4 (0.4 per invoice)</td>
                      <td className="py-2.5 px-3 text-emerald-300 font-bold">86.7% compute &amp; fee reduction</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold">Regulatory Violations (DPDP / Opt-out)</td>
                      <td className="py-2.5 px-3 font-mono text-rose-400 font-black">3 Critical Breaches ❌</td>
                      <td className="py-2.5 px-3 font-mono text-emerald-400 font-black">0 Violations (100% Gated) 🛡️</td>
                      <td className="py-2.5 px-3 text-emerald-300 font-bold">Zero compliance exposure</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold">Permanently Closed Account Retries</td>
                      <td className="py-2.5 px-3 text-rose-300">3 blind retries wasted</td>
                      <td className="py-2.5 px-3 text-emerald-300 font-bold">0 retries (Stopped instantly)</td>
                      <td className="py-2.5 px-3 text-emerald-300 font-bold">Zero gateway churn</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold">Net Recovered Revenue</td>
                      <td className="py-2.5 px-3 font-mono text-rose-300 font-bold">₹8,900 (10.4%)</td>
                      <td className="py-2.5 px-3 font-mono text-emerald-400 font-black text-sm">₹65,000 (76.1%)</td>
                      <td className="py-2.5 px-3 text-emerald-300 font-black">+₹56,100 (+7.3x yield)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
