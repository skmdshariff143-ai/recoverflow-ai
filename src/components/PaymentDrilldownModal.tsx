/**
 * RecoverFlow AI — Explainable Decision Drill-Down & Reviewer Action Panel.
 *
 * Renders the 6-factor deterministic scoring waterfall, customer payment history,
 * bounded Gemini AI copilot for error diagnosis & drafting messages,
 * live execution dispatch via official test-mode adapter, and authenticated human reviewer
 * approval controls with session persistence.
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
  Zap,
} from 'lucide-react';
import type { ExecutedItem } from '@/types';
import type { AuditRecord } from '@/lib/engine/auditTrail';
import { formatPaiseToINR } from '@/lib/engine/financial';
import type { ReviewerAction } from '@/lib/engine/stateMachine';
import { CaseRecoveryJourney } from '@/components/CaseRecoveryJourney';

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
    messageBody?: string;
    complianceNotice?: string;
    provider?: string;
    fallbackReason?: string;
  } | null>(null);

  const [aiDiagnosisLoading, setAiDiagnosisLoading] = useState<boolean>(false);
  const [aiDiagnosis, setAiDiagnosis] = useState<{
    normalizedCategory: string;
    confidenceScore: number;
    plainExplanation: string;
    provider: string;
    fallbackReason?: string;
  } | null>(null);

  // Live Execution Dispatch
  const [selectedAdapter, setSelectedAdapter] = useState<'simulator' | 'razorpay_test_mode'>('simulator');
  const [executionLoading, setExecutionLoading] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<{
    success?: boolean;
    receipt?: {
      transactionReference: string;
      adapterUsed: string;
      settledAmountPaise: number;
      status: string;
      latencyMs: number;
      rawResponseSummary: string;
    };
    idempotencyStatus?: string;
    error?: string;
  } | null>(null);

  // Proactive Outcome Observer Status Polling
  const [outcomeLoading, setOutcomeLoading] = useState<boolean>(false);
  const [outcomeResult, setOutcomeResult] = useState<{
    status: string;
    settledAmountPaise: number;
    source: string;
    timestamp: string;
  } | null>(null);

  if (!item) return null;

  const payment = item.payment;
  const score = item.score;
  const isRecovered = item.execution_status === 'recovered';
  const isStopped = item.status === 'stopped';

  const handleGenerateAiDiagnosis = async () => {
    setAiDiagnosisLoading(true);
    try {
      const res = await fetch('/api/ai/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawGatewayError: payment.raw_gateway_error }),
      });
      const data = await res.json();
      setAiDiagnosis(data);
    } catch {
      setAiDiagnosis({
        normalizedCategory: payment.failure_category,
        confidenceScore: 0.85,
        plainExplanation: `Deterministic rule classifier mapped '${payment.raw_gateway_error.slice(0, 50)}' to ${payment.failure_category}.`,
        provider: 'deterministic_fallback',
        fallbackReason: 'Network error; fallback classifier returned',
      });
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
      const data = await res.json();
      setAiMessage(data);
    } catch {
      setAiMessage({
        subject: `Payment Reminder: Invoice Update for ${payment.customer_id}`,
        messageBody: `Dear Customer ${payment.customer_id}, your recent payment of ${formatPaiseToINR(payment.amount, true)} could not be completed due to a temporary ${payment.failure_category.replace(/_/g, ' ')} issue. Please update your details to retry.`,
        complianceNotice: 'Policy-constrained prototype draft requiring merchant compliance review before production use. Reply STOP to opt out.',
        provider: 'deterministic_fallback',
        fallbackReason: 'Network error; default template returned',
      });
    } finally {
      setAiDraftLoading(false);
    }
  };

  const handleExecuteAdapter = async () => {
    setExecutionLoading(true);
    setExecutionResult(null);
    try {
      const res = await fetch('/api/recovery/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-recovery-adapter': selectedAdapter,
        },
        body: JSON.stringify({
          paymentId: payment.payment_id,
          customerId: payment.customer_id,
          customerName: `Customer ${payment.customer_id}`,
          customerEmail: `${payment.customer_id}@merchant.com`,
          amountPaise: payment.amount,
          currency: 'INR',
          intervention: item.suggested_intervention === 'none' ? 'retry' : item.suggested_intervention,
          attemptCycle: item.attempts_taken ?? 1,
          idempotencyKey: `idemp_${payment.payment_id}_drill_${Date.now()}`,
        }),
      });
      const data = await res.json();
      setExecutionResult(data);
    } catch (err: unknown) {
      setExecutionResult({ error: err instanceof Error ? err.message : 'Execution request failed' });
    } finally {
      setExecutionLoading(false);
    }
  };

  const handleRunOutcomeCheck = async () => {
    setOutcomeLoading(true);
    try {
      const ref =
        executionResult?.receipt?.transactionReference ??
        `sim_txn_${payment.payment_id}_c${item.attempts_taken ?? 1}`;
      const res = await fetch(`/api/recovery/status/${ref}`);
      if (res.ok) {
        const data = await res.json();
        setOutcomeResult({
          status: data.status,
          settledAmountPaise: data.settledAmountPaise ?? 0,
          source: data.source ?? 'simulator_memory',
          timestamp: data.timestamp ?? new Date().toISOString(),
        });
      } else {
        setOutcomeResult({
          status: 'pending',
          settledAmountPaise: 0,
          source: 'deterministic_simulator_fallback',
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      setOutcomeResult({
        status: 'pending',
        settledAmountPaise: 0,
        source: 'deterministic_simulator_fallback',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setOutcomeLoading(false);
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

  const isReviewerApproved =
    existingReviewerAction?.action === 'approve' ||
    (reviewerStatus !== null && reviewerStatus.includes('APPROVE'));
  const executionStatus = executionResult ? 'executed' : (item.execution_status ?? 'pending');
  const matchingAudit = auditRecords.find((r) => r.payment_id === payment.payment_id);

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
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-mono uppercase tracking-wider bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                {payment.payment_id}
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Customer: {payment.customer_id}
              </span>
            </div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <span>{formatPaiseToINR(payment.amount, true)}</span>
              <span className="text-xs font-normal text-slate-400 font-mono">
                ({payment.amount.toLocaleString('en-IN')} Paise)
              </span>
            </h3>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Modal Scrollable Body ─────────────────────────────── */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {/* Visual Closed-Loop Recovery Journey Stepper */}
          <CaseRecoveryJourney
            payment={payment}
            status={item.status}
            score={score.recovery_probability}
            suggestedIntervention={item.suggested_intervention}
            isApproved={isReviewerApproved}
            isExecuted={executionStatus === 'executed' || !!executionResult}
            executionReference={executionResult?.receipt?.transactionReference}
            observedStatus={isRecovered ? 'captured' : isStopped ? 'failed' : 'pending'}
            recoveredPaise={item.recovered_amount}
            auditHash={matchingAudit?.id}
          />

          {/* Key Metric Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
              <span className="text-slate-500 font-medium block">Failure Reason</span>
              <div className="text-sm font-bold text-slate-900 capitalize">
                {payment.failure_category.replace(/_/g, ' ')}
              </div>
              <span className="text-[10px] text-slate-400 font-mono block truncate">
                {payment.raw_gateway_error}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
              <span className="text-slate-500 font-medium block">Quiet Hours</span>
              <div className="text-sm font-bold text-slate-900">
                {payment.quiet_hours_window.start}:00 – {payment.quiet_hours_window.end}:00
              </div>
              <span className="text-[10px] text-slate-500 block">
                {payment.quiet_hours_window.timezone}
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
                  <span className="font-bold text-slate-800">
                    {(payment.customer_payment_history.on_time_payment_rate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded">
                  <span className="text-slate-500 block">Broken Promises</span>
                  <span className="font-bold text-slate-800">
                    {payment.customer_payment_history.broken_promise_count}
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded">
                  <span className="text-slate-500 block">Customer Tenure</span>
                  <span className="font-bold text-slate-800">
                    {payment.customer_payment_history.tenure_months} months
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded">
                  <span className="text-slate-500 block">Past Recoveries</span>
                  <span className="font-bold text-slate-800">
                    {payment.customer_payment_history.past_recovery_successes} /{' '}
                    {payment.customer_payment_history.past_recovery_successes +
                      payment.customer_payment_history.past_recovery_failures}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-slate-600" />
                Gateway Metadata &amp; Compliance
              </h4>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-500">Opt-Out Status:</span>
                  <span
                    className={`font-semibold ${
                      payment.opt_out ? 'text-rose-600 font-bold' : 'text-emerald-600'
                    }`}
                  >
                    {payment.opt_out ? 'Opted Out (Hard Stop)' : 'Active (Eligible)'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-500">Tier:</span>
                  <span className="font-semibold text-slate-800 uppercase">
                    {payment.invoice_value_tier}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Failure Timestamp:</span>
                  <span className="font-mono text-slate-700">
                    {new Date(payment.failure_timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Live Server-Side Test-Mode Execution Trigger */}
          <div className="bg-slate-900 text-white rounded-xl p-4 space-y-3 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <h4 className="font-bold flex items-center gap-1.5 text-amber-300">
                <Zap className="w-4 h-4 text-amber-400" />
                Live Execution Adapter Dispatch (`/api/recovery/execute`)
              </h4>
              <span className="text-[10px] text-slate-400">Server-Side Sandbox Execution</span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Adapter:</span>
                <select
                  value={selectedAdapter}
                  onChange={(e) => setSelectedAdapter(e.target.value as 'simulator' | 'razorpay_test_mode')}
                  className="bg-slate-800 text-slate-100 font-bold px-2.5 py-1 rounded border border-slate-700 text-xs focus:outline-none"
                >
                  <option value="simulator">Deterministic Simulator</option>
                  <option value="razorpay_test_mode">Official Razorpay Test-Mode</option>
                </select>
              </div>

              <button
                onClick={handleExecuteAdapter}
                disabled={executionLoading}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer"
              >
                <RotateCw className={`w-3.5 h-3.5 ${executionLoading ? 'animate-spin' : ''}`} />
                {executionLoading ? 'Executing...' : 'Dispatch Live Execution'}
              </button>
            </div>

            {executionResult && (
              <div className="mt-3 p-3 bg-slate-800/90 border border-slate-700 rounded-lg space-y-1.5 text-xs font-mono">
                {executionResult.error ? (
                  <div className="text-rose-400 font-bold">Error: {executionResult.error}</div>
                ) : (
                  <>
                    <div className="flex justify-between text-slate-300">
                      <span>Status:</span>
                      <span className="font-bold text-emerald-400 uppercase">
                        {executionResult.receipt?.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Reference:</span>
                      <span className="text-cyan-300">{executionResult.receipt?.transactionReference}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Adapter Used:</span>
                      <span className="text-amber-300">{executionResult.receipt?.adapterUsed}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Settled Amount:</span>
                      <span className="font-bold text-white">
                        {formatPaiseToINR(executionResult.receipt?.settledAmountPaise ?? 0, true)}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-700">
                      {executionResult.receipt?.rawResponseSummary}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Outcome Observer Polling Trigger */}
            <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] text-slate-400">
                <span>Post-Intervention Settlement Verification:</span>
              </div>

              <button
                onClick={handleRunOutcomeCheck}
                disabled={outcomeLoading}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer"
              >
                <RotateCw className={`w-3.5 h-3.5 ${outcomeLoading ? 'animate-spin' : ''}`} />
                {outcomeLoading ? 'Polling Status...' : 'Run Outcome Check'}
              </button>
            </div>

            {outcomeResult && (
              <div className="p-3 bg-slate-950 border border-emerald-500/30 rounded-lg space-y-1.5 text-xs font-mono">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-emerald-400 font-bold">Outcome Polling Result:</span>
                  <span className="text-[10px] text-slate-400">actor: outcome_observer</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Observed Status:</span>
                  <span className="font-bold text-white uppercase">{outcomeResult.status}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Verified Settlement:</span>
                  <span className="font-bold text-emerald-300">
                    {formatPaiseToINR(outcomeResult.settledAmountPaise, true)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400 text-[10px]">
                  <span>Telemetry Source:</span>
                  <span>{outcomeResult.source}</span>
                </div>
                <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                  Accounting Invariant: Payment link created counts as ₹0.00 recovered until verified settlement.
                </div>
              </div>
            )}
          </div>

          {/* 4. Bounded Gemini AI Diagnostic & Communication Copilot */}
          <div className="bg-gradient-to-br from-indigo-50/70 via-slate-50 to-white border border-indigo-200 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
              <h4 className="font-bold text-indigo-950 flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-indigo-600" />
                Bounded Gemini 2.5 AI Diagnostic &amp; Message Copilot
              </h4>
              <span className="text-[10px] bg-indigo-100 text-indigo-800 font-semibold px-2 py-0.5 rounded">
                Advisory Only · Strict Zod Validation
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

          {/* 5. Human-in-the-Loop Reviewer Action Panel */}
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

          {/* 6. Chronological Audit Trail */}
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
