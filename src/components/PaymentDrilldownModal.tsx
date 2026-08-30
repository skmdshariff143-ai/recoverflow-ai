/**
 * RecoverFlow AI — Explainable Decision Drill-Down Modal & Reviewer Control Center.
 *
 * Provides a 100% transparent reasoning trace for any selected payment:
 *  - Feature Weight Waterfall & "Why this score" factor explanations
 *  - Reviewer Operational Decision Panel (Approve / Reject / Request Evidence / Stop)
 *  - Live Bounded Gemini AI Diagnostic & RBI-Compliant Communication Assistant
 *  - Safety Compliance & High-Value Approval trace
 *  - Quiet-Hours non-intrusive scheduling window
 *  - Test-mode execution outcome
 *  - Chronological append-only audit trail
 */

'use client';

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  User,
  History,
  Tag,
  ShieldAlert,
  Bot,
  UserCheck,
  UserX,
  FileQuestion,
  RotateCw,
} from 'lucide-react';
import type { ExecutedItem } from '@/types';
import type { AuditRecord } from '@/lib/engine/auditTrail';
import { formatPaiseToINR } from '@/lib/engine/financial';

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
  const [activeSubTab, setActiveSubTab] = useState<'decision' | 'ai_copilot' | 'reviewer'>('decision');
  const [reviewerNote, setReviewerNote] = useState<string>('');
  const [reviewerStatus, setReviewerStatus] = useState<string | null>(null);

  // AI Copilot state
  const [aiDraftLoading, setAiDraftLoading] = useState<boolean>(false);
  const [aiDraftChannel, setAiDraftChannel] = useState<'sms' | 'email' | 'whatsapp'>('email');
  const [aiMessage, setAiMessage] = useState<{
    subject?: string;
    messageBody: string;
    tone: string;
    complianceNotice: string;
    provider: string;
  } | null>(null);

  if (!item) return null;

  const { payment, score } = item;
  const isRecovered = item.execution_status === 'recovered';
  const isStopped = item.status === 'stopped' || item.execution_status === 'stopped';

  const handleGenerateAiMessage = async () => {
    setAiDraftLoading(true);
    try {
      const res = await fetch('/api/ai/draft-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: `Customer ${payment.customer_id}`,
          amountINR: formatPaiseToINR(payment.amount, true),
          failureCategory: payment.failure_category,
          channel: aiDraftChannel,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiMessage(data);
      }
    } catch {
      // Graceful fallback
    } finally {
      setAiDraftLoading(false);
    }
  };

  const handleReviewerAction = (action: string) => {
    setReviewerStatus(`Action recorded: ${action.toUpperCase()} (${reviewerNote || 'No note'})`);
  };

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
                {formatPaiseToINR(payment.amount, true)}
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
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Sub-Tab Navigation Bar ────────────────────────────── */}
        <div className="bg-slate-800 px-5 pt-2 flex space-x-6 text-xs font-semibold border-b border-slate-700">
          <button
            onClick={() => setActiveSubTab('decision')}
            className={`pb-2 border-b-2 transition cursor-pointer ${
              activeSubTab === 'decision'
                ? 'border-indigo-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Decision Waterfall &amp; Safety
          </button>
          <button
            onClick={() => setActiveSubTab('ai_copilot')}
            className={`pb-2 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'ai_copilot'
                ? 'border-indigo-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-indigo-400" />
            Gemini AI Copilot
          </button>
          <button
            onClick={() => setActiveSubTab('reviewer')}
            className={`pb-2 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'reviewer'
                ? 'border-indigo-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            Reviewer Action Gate
          </button>
        </div>

        {/* ── Modal Content (Scrollable) ────────────────────────── */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-700 text-xs">
          {/* Subtab 1: Decision Waterfall & Safety */}
          {activeSubTab === 'decision' && (
            <div className="space-y-6">
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
                        {formatPaiseToINR(score.expected_value, true)}
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
                      {formatPaiseToINR(item.recovered_amount, true)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Subtab 2: Bounded Gemini AI Copilot */}
          {activeSubTab === 'ai_copilot' && (
            <div className="space-y-4">
              <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-indigo-950 flex items-center gap-1.5">
                    <Bot className="w-4 h-4 text-indigo-600" />
                    Gemini AI Diagnostic &amp; RBI-Compliant Communication Copilot
                  </h4>
                  <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                    Advisory Layer Only
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  Draft empathetic payment update requests or normalize unstructured error logs without touching financial state.
                </p>

                <div className="mt-4 flex items-center gap-3">
                  <span className="text-slate-600 font-semibold">Channel:</span>
                  <select
                    value={aiDraftChannel}
                    onChange={(e) => setAiDraftChannel(e.target.value as 'sms' | 'email' | 'whatsapp')}
                    className="border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-800"
                  >
                    <option value="email">Email Notification</option>
                    <option value="sms">SMS Reminder</option>
                    <option value="whatsapp">WhatsApp Business</option>
                  </select>

                  <button
                    onClick={handleGenerateAiMessage}
                    disabled={aiDraftLoading}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition disabled:opacity-50 cursor-pointer"
                  >
                    {aiDraftLoading ? (
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    Generate Draft Message
                  </button>
                </div>

                {aiMessage && (
                  <div className="mt-4 bg-white border border-indigo-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="font-bold text-slate-800">
                        {aiMessage.subject ?? `Notification for Customer ${payment.customer_id}`}
                      </span>
                      <span className="text-[10px] text-indigo-600 font-medium">
                        Provider: {aiMessage.provider}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {aiMessage.messageBody}
                    </p>
                    <div className="text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100">
                      Compliance: {aiMessage.complianceNotice}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Subtab 3: Reviewer Action Gate */}
          {activeSubTab === 'reviewer' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  Human-in-the-Loop Reviewer Controls
                </h4>
                <p className="text-[11px] text-slate-600">
                  Required for high-value enterprise invoices or disputed payments before triggering gateway clearance.
                </p>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Reviewer Note &amp; Rationale:</label>
                  <textarea
                    rows={3}
                    placeholder="Enter approval rationale, merchant authorization reference, or customer contact notes..."
                    value={reviewerNote}
                    onChange={(e) => setReviewerNote(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 bg-white"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    onClick={() => handleReviewerAction('approve')}
                    className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Approve Recovery
                  </button>

                  <button
                    onClick={() => handleReviewerAction('reject')}
                    className="flex items-center gap-1 bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
                  >
                    <UserX className="w-3.5 h-3.5" /> Reject / Stop
                  </button>

                  <button
                    onClick={() => handleReviewerAction('request_evidence')}
                    className="flex items-center gap-1 bg-slate-700 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
                  >
                    <FileQuestion className="w-3.5 h-3.5" /> Request Evidence
                  </button>
                </div>

                {reviewerStatus && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-2.5 rounded-lg text-xs font-medium">
                    {reviewerStatus}
                  </div>
                )}
              </div>
            </div>
          )}

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
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            Close Drill-Down
          </button>
        </div>
      </div>
    </div>
  );
}
