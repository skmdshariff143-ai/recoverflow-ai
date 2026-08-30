/**
 * PayBack AI — Explainable Decision Drill-Down Modal.
 *
 * Provides a 100% transparent reasoning trace for any selected payment:
 *  - Feature Weight Waterfall & "Why this score" factor explanations
 *  - Safety Compliance & High-Value Approval trace
 *  - Quiet-Hours non-intrusive scheduling window
 *  - Test-mode execution outcome
 *  - Chronological immutable audit trail
 */

'use client';

import React from 'react';
import {
  X,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  User,
  History,
  Tag,
  ShieldAlert,
} from 'lucide-react';
import type { ExecutedItem } from '@/types';
import type { AuditRecord } from '@/lib/engine/auditTrail';

interface PaymentDrilldownModalProps {
  item: ExecutedItem | null;
  auditRecords: AuditRecord[];
  onClose: () => void;
}

export function PaymentDrilldownModal({
  item,
  auditRecords,
  onClose,
}: PaymentDrilldownModalProps) {
  if (!item) return null;

  const { payment, score } = item;
  const isRecovered = item.execution_status === 'recovered';
  const isStopped = item.status === 'stopped' || item.execution_status === 'stopped';

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal Header ─────────────────────────────────────── */}
        <div className="bg-slate-900 text-white p-5 flex items-start justify-between border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">
                {payment.payment_id}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Customer: {payment.customer_id}
              </span>
              {item.rank && (
                <span className="text-xs bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-500/30">
                  Priority Rank #{item.rank}
                </span>
              )}
            </div>

            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-2xl font-bold text-white">
                ₹{(payment.amount / 100).toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                })}
              </span>
              <span className="text-xs text-slate-400 capitalize">
                {payment.failure_category.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Status Pill */}
            {isRecovered ? (
              <span className="inline-flex items-center gap-1 font-bold text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5" /> Recovered
              </span>
            ) : isStopped ? (
              <span className="inline-flex items-center gap-1 font-semibold text-xs px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                <ShieldAlert className="w-3.5 h-3.5" /> Stopped
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-semibold text-xs px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Clock className="w-3.5 h-3.5" /> {item.status.replace(/_/g, ' ')}
              </span>
            )}

            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Modal Content (Scrollable) ────────────────────────── */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-700 text-xs">
          {/* 1. Score Breakdown & Explainability Waterfall */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                Score Breakdown &amp; Explainability Waterfall
              </h3>
              <div className="flex items-center gap-3">
                <span>
                  Recovery Probability:{' '}
                  <strong className="text-indigo-700 text-sm">
                    {(score.recovery_probability * 100).toFixed(1)}%
                  </strong>
                </span>
                <span>
                  Expected Value:{' '}
                  <strong className="text-emerald-700 text-sm">
                    ₹{(score.expected_value / 100).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                    })}
                  </strong>
                </span>
              </div>
            </div>

            {/* Contributing Factor List */}
            <div className="space-y-2 pt-1">
              {score.explanation.map((f, idx) => {
                const isPositive = f.contribution >= 0;
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs"
                  >
                    <div className="flex items-center gap-2 flex-1 pr-4">
                      {isPositive ? (
                        <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-rose-500 shrink-0" />
                      )}
                      <div>
                        <span className="font-semibold text-slate-800 block">
                          {f.label}
                        </span>
                        <span className="text-[11px] text-slate-500">{f.detail}</span>
                      </div>
                    </div>

                    <span
                      className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                        isPositive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {isPositive ? `+${f.contribution.toFixed(3)}` : f.contribution.toFixed(3)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Customer Behavior Profile & Raw Error */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-600" />
                Customer Reliability Profile
              </h4>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-slate-50 p-2 rounded">
                  <span className="text-slate-500 block">On-Time Rate</span>
                  <span className="font-bold text-slate-900">
                    {(payment.customer_payment_history.on_time_payment_rate * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded">
                  <span className="text-slate-500 block">Broken Promises</span>
                  <span className="font-bold text-slate-900">
                    {payment.customer_payment_history.broken_promise_count}
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded">
                  <span className="text-slate-500 block">Tenure</span>
                  <span className="font-bold text-slate-900">
                    {payment.customer_payment_history.tenure_months} months
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded">
                  <span className="text-slate-500 block">Past Recoveries</span>
                  <span className="font-bold text-slate-900">
                    {payment.customer_payment_history.past_recovery_successes} /{' '}
                    {payment.customer_payment_history.total_transactions}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-slate-600" />
                Gateway Diagnostic &amp; Quiet Hours
              </h4>
              <div className="space-y-1.5 text-[11px]">
                <div>
                  <span className="text-slate-500 block">Raw Gateway Error:</span>
                  <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-rose-700 font-mono block overflow-hidden text-ellipsis">
                    {payment.raw_gateway_error}
                  </code>
                </div>
                <div className="pt-1">
                  <span className="text-slate-500 block">Quiet Hours Window:</span>
                  <span className="font-medium text-slate-800">
                    {payment.quiet_hours_window.start}:00 – {payment.quiet_hours_window.end}:00{' '}
                    ({payment.quiet_hours_window.timezone})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Scheduled Contact Time:</span>
                  <span className="font-medium text-slate-800">
                    {item.scheduled_contact_time ?? 'N/A (Stopped)'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Safety Compliance & Outcome Trace */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Safety Verification &amp; Simulated Execution
            </h4>

            <div className="space-y-2 text-[11px]">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500">Customer Opt-Out Check:</span>
                <span className="font-bold text-slate-800">
                  {payment.opt_out ? 'Opted Out (Stopped)' : 'Opted In (Passed)'}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500">Attempt Cap (≤ 3):</span>
                <span className="font-bold text-slate-800">
                  {item.final_attempt_count} / 3 attempts
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500">Suggested Intervention:</span>
                <span className="font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                  {item.suggested_intervention}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500">Simulated Outcome Detail:</span>
                <span className="font-medium text-slate-900 text-right max-w-sm">
                  {item.simulated_outcome_detail}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-500">Recovered Revenue:</span>
                <span className="font-bold text-sm text-emerald-600">
                  ₹{(item.recovered_amount / 100).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Chronological Audit Trail */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
              <History className="w-4 h-4 text-indigo-600" />
              Chronological Audit Trail ({auditRecords.length} events)
            </h4>

            <div className="space-y-2 relative border-l-2 border-slate-200 ml-2 pl-3">
              {auditRecords.map((rec) => (
                <div key={rec.id} className="relative pb-2">
                  <div className="absolute -left-[19px] top-1 h-2.5 w-2.5 rounded-full bg-indigo-600 border-2 border-white" />
                  <div className="text-[10px] text-slate-400 font-mono">
                    {new Date(rec.timestamp).toLocaleTimeString()} · {rec.stage.replace(/_/g, ' ')}
                  </div>
                  <div className="font-semibold text-slate-800 text-[11px]">{rec.decision}</div>
                  <div className="text-slate-500 text-[10px]">{rec.reason}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Modal Footer ─────────────────────────────────────── */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition"
          >
            Close Drill-Down
          </button>
        </div>
      </div>
    </div>
  );
}
