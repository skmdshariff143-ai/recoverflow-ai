/**
 * RecoverFlow AI — Explainable Decision Drill-Down & Reviewer Action Panel.
 *
 * Renders the 6-factor deterministic scoring waterfall, customer payment history,
 * bounded Gemini AI copilot for error diagnosis & drafting messages,
 * and authenticated human reviewer approval controls with session persistence.
 */

'use client';

import React, { useState } from 'react';
import {
  X,
  Sparkles,
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
import type { ReviewerAction } from '@/lib/engine/stateMachine';

interface PaymentDrilldownModalProps {
  item: ExecutedItem | null;
  auditRecords: AuditRecord[];
  onClose: () => void;
  onApplyReviewerAction?: (paymentId: string, action: ReviewerAction) => void;
  existingReviewerAction?: ReviewerAction;
}

export function PaymentDrilldownModal({
  item,
  auditRecords,
  onClose,
  onApplyReviewerAction,
  existingReviewerAction,
}: PaymentDrilldownModalProps) {
  const [reviewerNote, setReviewerNote] = useState<string>(
    existingReviewerAction?.reviewerNote ?? '',
  );
  const [reviewerStatus, setReviewerStatus] = useState<string | null>(
    existingReviewerAction
      ? `Recorded: ${existingReviewerAction.action.toUpperCase()} (${existingReviewerAction.reviewerNote})`
      : null,
  );
  const [aiDraftLoading, setAiDraftLoading] = useState<boolean>(false);
  const [aiDraftChannel, setAiDraftChannel] = useState<'sms' | 'email' | 'whatsapp'>('email');
  const [aiMessage, setAiMessage] = useState<{
    subject?: string;
    messageBody: string;
    tone: string;
    complianceNotice: string;
    provider: string;
    fallbackReason?: string;
  } | null>(null);

  const [aiDiagnosisLoading, setAiDiagnosisLoading] = useState<boolean>(false);
  const [aiDiagnosis, setAiDiagnosis] = useState<{
    normalizedCategory: string;
    confidenceScore: number;
    plainExplanation: string;
    isRecoverable: boolean;
    suggestedAction: string;
    provider: string;
    fallbackReason?: string;
  } | null>(null);

  if (!item) return null;

  const { payment, score } = item;
  const isRecovered = item.execution_status === 'recovered';
  const isStopped = item.status === 'stopped' || item.execution_status === 'stopped';

  const handleGenerateAiDiagnosis = async () => {
    setAiDiagnosisLoading(true);
    try {
      const res = await fetch('/api/ai/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawGatewayError: payment.raw_gateway_error }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiDiagnosis(data);
      }
    } finally {
      setAiDiagnosisLoading(false);
    }
  };

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
    } finally {
      setAiDraftLoading(false);
    }
  };

  const handleReviewerAction = (action: 'approve' | 'reject' | 'request_evidence') => {
    if (!reviewerNote.trim()) {
      alert('Reviewer note is required before recording an action.');
      return;
    }

    const reviewerActionObj: ReviewerAction = {
      action,
      actorId: 'live_reviewer_officer',
      timestamp: new Date().toISOString(),
      reviewerNote: reviewerNote.trim(),
    };

    if (onApplyReviewerAction) {
      onApplyReviewerAction(payment.payment_id, reviewerActionObj);
    }

    setReviewerStatus(`Action applied: ${action.toUpperCase()} (${reviewerNote.trim()})`);
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
            <h3 className="text-xl font-bold mt-1 text-white flex items-center gap-2">
              {formatPaiseToINR(payment.amount, true)}
              <span className="text-xs font-normal text-slate-400">
                ({payment.currency})
              </span>
            </h3>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Modal Body ───────────────────────────────────────── */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          {/* Top Status & Recommendation Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
              <span className="text-slate-500 font-medium block">Predicted Recovery</span>
              <div className="text-xl font-bold text-indigo-600">
                {(score.recovery_probability * 100).toFixed(1)}%
              </div>
              <span className="text-[10px] text-slate-500 block">
                EV: {formatPaiseToINR(score.expected_value, true)}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
              <span className="text-slate-500 font-medium block">Intervention Action</span>
              <div className="text-sm font-bold text-slate-900 uppercase">
                {item.suggested_intervention}
              </div>
              <span className="text-[10px] text-slate-500 block capitalize">
                Attempt {item.attempts_taken ?? 1}/3
              </span>
            </div>

            <div
              className={`rounded-xl p-3.5 space-y-1 border ${
                isRecovered
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : isStopped
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : 'bg-indigo-50 border-indigo-200 text-indigo-900'
              }`}
            >
              <span className="font-medium block">Execution Outcome</span>
              <div className="text-sm font-bold flex items-center gap-1">
                {isRecovered ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Recovered ({formatPaiseToINR(item.recovered_amount, true)})</span>
                  </>
                ) : isStopped ? (
                  <>
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span>Stopped (Safety Guard)</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4 text-indigo-600" />
                    <span className="capitalize">{item.execution_status.replace(/_/g, ' ')}</span>
                  </>
                )}
              </div>
              <span className="text-[10px] block opacity-80 truncate">
                {item.final_reason ?? 'Simulated test-mode clearance'}
              </span>
            </div>
          </div>

          {/* 1. Transparent 6-Factor Waterfall Explanation */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                Deterministic Scoring Waterfall (6 Contributing Factors)
              </h4>
              <span className="text-[10px] text-slate-400">Additive Basis Breakdown</span>
            </div>

            <div className="space-y-2">
              {score.explanation.map((f, idx) => {
                const isPositive = f.contribution >= 0;
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition"
                  >
                    <div className="flex items-center gap-2">
                      {isPositive ? (
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5 text-rose-600 shrink-0" />
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

                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-500">Customer Quiet Hours:</span>
                  <span className="font-mono text-slate-700 font-semibold">
                    {payment.quiet_hours_window.start}:00 – {payment.quiet_hours_window.end}:00 (
                    {payment.quiet_hours_window.timezone})
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Scheduled Dispatch:</span>
                  <span className="font-mono text-indigo-700 font-semibold">
                    {item.scheduled_time
                      ? new Date(item.scheduled_time).toLocaleTimeString()
                      : 'Immediate dispatch'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Bounded Gemini AI Copilot */}
          <div className="bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/50 border border-indigo-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-md bg-indigo-600 text-white">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">
                    Bounded Gemini AI Copilot
                  </h4>
                  <span className="text-[10px] text-slate-500">
                    Grounded Advisory Assistant (Zero financial execution authority)
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded border border-indigo-200">
                ADVISORY ONLY
              </span>
            </div>

            {/* AI Action 1: Gateway Error Diagnosis */}
            <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">
                  1. Unstructured Gateway Error Normalization:
                </span>
                <button
                  onClick={handleGenerateAiDiagnosis}
                  disabled={aiDiagnosisLoading}
                  className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded text-xs font-semibold shadow-2xs transition cursor-pointer"
                >
                  <RotateCw className={`w-3 h-3 ${aiDiagnosisLoading ? 'animate-spin' : ''}`} />
                  {aiDiagnosisLoading ? 'Diagnosing...' : 'AI Diagnose Error'}
                </button>
              </div>

              {aiDiagnosis && (
                <div className="mt-2 bg-indigo-50/60 border border-indigo-200 rounded p-2.5 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-indigo-900">
                      Mapped Category: {aiDiagnosis.normalizedCategory.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Provider: {aiDiagnosis.provider}
                    </span>
                  </div>
                  <p className="text-slate-700 text-xs">{aiDiagnosis.plainExplanation}</p>
                  {aiDiagnosis.fallbackReason && (
                    <span className="text-[10px] text-amber-700 block italic">
                      Notice: {aiDiagnosis.fallbackReason}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* AI Action 2: Customer Communication Drafting */}
            <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-slate-800">
                  2. Draft Compliant Customer Recovery Notification:
                </span>
                <div className="flex items-center gap-2">
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
                    className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded text-xs font-semibold shadow-2xs transition cursor-pointer"
                  >
                    <RotateCw className={`w-3 h-3 ${aiDraftLoading ? 'animate-spin' : ''}`} />
                    {aiDraftLoading ? 'Drafting...' : 'Draft Message'}
                  </button>
                </div>
              </div>

              {aiMessage && (
                <div className="mt-3 bg-white border border-indigo-200 rounded-lg p-3 space-y-2">
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
                    {aiMessage.complianceNotice}
                  </div>
                  {aiMessage.fallbackReason && (
                    <div className="text-[10px] text-amber-700 italic">
                      Notice: {aiMessage.fallbackReason}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 4. Human-in-the-Loop Reviewer Action Panel */}
          <div className="bg-white border-2 border-emerald-300 rounded-xl p-4 space-y-3 bg-emerald-50/10">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              Human-in-the-Loop Reviewer Action Gate
            </h4>
            <p className="text-[11px] text-slate-600">
              Required for high-value enterprise invoices or disputed payments before triggering gateway clearance.
            </p>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Mandatory Reviewer Note &amp; Rationale:
              </label>
              <textarea
                rows={2}
                placeholder="Enter approval rationale, merchant authorization reference, or customer contact notes..."
                value={reviewerNote}
                onChange={(e) => setReviewerNote(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 bg-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
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
                <UserX className="w-3.5 h-3.5" /> Reject &amp; Stop
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

          {/* 5. Chronological Audit Trail */}
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
