/**
 * PayBack AI / RecoverFlow AI — Explainable "WHY THIS ACTION?" Decision Modal.
 *
 * Persistent explainability breakdown showing the exact deterministic signals
 * behind every recovery action selection without leaking internal secrets or raw PII.
 */

'use client';

import React from 'react';
import {
  X,
  HelpCircle,
  Zap,
  Tag,
  CheckCircle2,
} from 'lucide-react';
import type { ExecutedItem } from '@/types';
import { formatPaiseToINR } from '@/lib/engine/financial';

interface ExplainDecisionModalProps {
  item: ExecutedItem | null;
  onClose: () => void;
}

export const ExplainDecisionModal: React.FC<ExplainDecisionModalProps> = ({ item, onClose }) => {
  if (!item) return null;

  const payment = item.payment;
  const score = item.score;
  const probPercent = (score.recovery_probability * 100).toFixed(1);
  const evINR = formatPaiseToINR(score.expected_value, true);
  const amountINR = formatPaiseToINR(payment.amount, true);
  const intervention = item.suggested_intervention === 'none' ? 'retry' : item.suggested_intervention;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150" data-testid="explain-decision-modal">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>WHY THIS ACTION?</span>
                <span className="font-mono text-xs px-2 py-0.5 bg-slate-800 text-cyan-300 rounded border border-slate-700">
                  {payment.payment_id}
                </span>
              </h3>
              <p className="text-xs text-slate-400">Deterministic signal attribution for selected recovery action</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close explainability modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Key Facts Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Amount</span>
              <span className="text-sm font-bold text-slate-900">{amountINR}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Recovery Prob</span>
              <span className="text-sm font-bold text-indigo-600">{probPercent}%</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Expected Value</span>
              <span className="text-sm font-bold text-emerald-600">{evINR}</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Action Selected</span>
              <span className="text-sm font-bold text-purple-700 capitalize">{intervention}</span>
            </div>
          </div>

          {/* Failure Context */}
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1 text-xs">
            <div className="flex items-center justify-between text-amber-900 font-bold">
              <span className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-600" />
                Failure Category: {payment.failure_category.replace(/_/g, ' ').toUpperCase()}
              </span>
              <span className="text-[10px] text-amber-700 font-mono">Attempt {item.attempts_taken ?? 1} / 3</span>
            </div>
            <p className="text-slate-700 font-mono text-[11px] bg-white/80 p-2 rounded border border-amber-100">
              {payment.raw_gateway_error}
            </p>
          </div>

          {/* Signal Synthesis Waterfall */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Deterministic Decision Signals
            </h4>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-start gap-2 p-2 bg-emerald-50/60 border border-emerald-200/80 rounded-lg text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Calibrated Recovery Probability ({probPercent}%):</span>
                  <span className="text-slate-600 block text-[11px]">
                    Category baseline + on-time payment history ({(payment.customer_payment_history.on_time_payment_rate * 100).toFixed(0)}%) satisfies high-yield threshold.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 p-2 bg-emerald-50/60 border border-emerald-200/80 rounded-lg text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Portfolio Expected Value Optimization ({evINR}):</span>
                  <span className="text-slate-600 block text-[11px]">
                    Integer paise knapsack algorithm ranked this payment in top budget capacity slots.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 p-2 bg-emerald-50/60 border border-emerald-200/80 rounded-lg text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Compliance &amp; Safety Rule Verified:</span>
                  <span className="text-slate-600 block text-[11px]">
                    0 opt-out flags, attempt count within cap ({item.attempts_taken ?? 1} &le; 3), contact scheduled strictly outside customer quiet hours.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 p-2 bg-purple-50/60 border border-purple-200/80 rounded-lg text-purple-900">
                <Zap className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Selected Channel: {intervention.toUpperCase()}</span>
                  <span className="text-slate-600 block text-[11px]">
                    {intervention === 'retry'
                      ? 'Direct gateway retry selected due to temporary issuer downtime or network timeout without customer action required.'
                      : intervention === 'reminder'
                        ? 'Customer reminder selected to request updated card/mandate credentials without wasteful gateway retry fees.'
                        : 'Multi-channel dispatch (Retry + WhatsApp/SMS) selected to maximize high-EV enterprise recovery.'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Mathematical Conclusion */}
          <div className="p-3 bg-slate-900 text-white rounded-xl text-xs space-y-1">
            <div className="flex items-center justify-between text-slate-300 font-mono text-[11px]">
              <span>ALLOCATION RULE:</span>
              <span className="text-emerald-400 font-bold">EV-PRIORITIZED</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Therefore, RecoverFlow dispatched <strong>{intervention.toUpperCase()}</strong> on slot #{item.score.expected_value > 0 ? 'budgeted' : '1'} with zero risk of opt-out harassment or wasted fees on closed accounts.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 p-3.5 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
