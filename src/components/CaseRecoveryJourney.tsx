/**
 * RecoverFlow AI — Visible Closed-Loop Recovery Journey Stepper.
 *
 * Visually renders the complete 8-stage fintech recovery lifecycle for any selected case:
 * 1. DETECT (Revenue at risk, amount, gateway error)
 * 2. DIAGNOSE (AI/Deterministic normalization & failure category)
 * 3. INTERVENE (Optimal action & expected value math)
 * 4. ELIGIBILITY (Safety invariants: opt-out, closure, 3-attempt cap)
 * 5. GOVERN (Human-in-the-loop approval gate for invoices > ₹10,000)
 * 6. EXECUTE (Single-cycle bounded execution with idempotency key)
 * 7. OBSERVE (Proactive status polling & internal telemetry)
 * 8. AUDIT (Cryptographic SHA-256 ledger block appending)
 */

'use client';

import React from 'react';
import {
  ShieldAlert,
  Search,
  Zap,
  ShieldCheck,
  UserCheck,
  Send,
  Eye,
  FileCheck,
  CheckCircle2,
  AlertOctagon,
  Clock,
  ArrowRight,
  Fingerprint,
} from 'lucide-react';
import type { FailedPayment, InterventionType } from '@/types';
import {
  formatPaiseToINR,
  calculateExpectedValuePaise,
  probabilityToBps,
} from '@/lib/engine/financial';
import { checkSafetyRules } from '@/lib/engine/safetyFilter';

interface CaseRecoveryJourneyProps {
  payment: FailedPayment;
  status: 'budgeted' | 'deferred' | 'stopped' | 'pending_approval';
  score?: number;
  suggestedIntervention?: InterventionType;
  isApproved?: boolean;
  isExecuted?: boolean;
  executionReference?: string;
  observedStatus?: 'pending' | 'captured' | 'failed' | 'disputed';
  recoveredPaise?: number;
  auditHash?: string;
}

export const CaseRecoveryJourney: React.FC<CaseRecoveryJourneyProps> = ({
  payment,
  status,
  score = 0.65,
  suggestedIntervention = 'retry',
  isApproved = false,
  isExecuted = false,
  executionReference,
  observedStatus = 'pending',
  recoveredPaise = 0,
  auditHash,
}) => {
  const safetyResult = checkSafetyRules(payment);
  const isHighValue = payment.invoice_value_tier === 'high_value' || payment.amount >= 1_000_000;
  const evPaise = calculateExpectedValuePaise(payment.amount, probabilityToBps(score));

  // Stage 1: Detect
  const s1Status = 'completed';

  // Stage 2: Diagnose
  const s2Status = 'completed';

  // Stage 3: Intervene
  const s3Status = 'completed';

  // Stage 4: Eligibility
  const s4Status = safetyResult.eligible ? 'completed' : 'stopped';

  // Stage 5: Governance / Approval
  let s5Status: 'completed' | 'in_progress' | 'skipped' | 'stopped' = 'completed';
  if (isHighValue) {
    if (isApproved || isExecuted) {
      s5Status = 'completed';
    } else {
      s5Status = 'in_progress'; // Awaiting operator approval
    }
  } else if (!safetyResult.eligible) {
    s5Status = 'stopped';
  } else {
    s5Status = 'skipped'; // Auto-approved (under ₹10,000)
  }

  // Stage 6: Execution
  let s6Status: 'completed' | 'in_progress' | 'waiting' | 'stopped' = 'waiting';
  if (!safetyResult.eligible) {
    s6Status = 'stopped';
  } else if (isHighValue && !isApproved && !isExecuted) {
    s6Status = 'waiting';
  } else if (isExecuted) {
    s6Status = 'completed';
  } else {
    s6Status = 'in_progress';
  }

  // Stage 7: Outcome Observation
  let s7Status: 'recovered' | 'waiting' | 'failed' | 'stopped' = 'waiting';
  if (!safetyResult.eligible) {
    s7Status = 'stopped';
  } else if (isExecuted) {
    if (observedStatus === 'captured' && recoveredPaise > 0) {
      s7Status = 'recovered';
    } else if (observedStatus === 'disputed' || observedStatus === 'failed') {
      s7Status = 'failed';
    } else {
      s7Status = 'waiting';
    }
  }

  // Stage 8: Audit Ledger
  const s8Status = isExecuted || status === 'stopped' ? 'completed' : 'waiting';

  const stages = [
    {
      id: 1,
      title: 'Detect',
      subtitle: 'Revenue Risk Ingested',
      icon: ShieldAlert,
      status: s1Status,
      badge: `${formatPaiseToINR(payment.amount, true)} at risk`,
      detail: `Raw Gateway Error: "${payment.raw_gateway_error.slice(0, 45)}..."`,
      actor: 'system_engine',
    },
    {
      id: 2,
      title: 'Diagnose',
      subtitle: 'Failure Classification',
      icon: Search,
      status: s2Status,
      badge: `${payment.failure_category.replace(/_/g, ' ')}`,
      detail: `Model Confidence: ${(score * 100).toFixed(1)}% · ${payment.customer_payment_history.tenure_months}mo tenure`,
      actor: 'system_engine',
    },
    {
      id: 3,
      title: 'Intervene',
      subtitle: 'Strategy & EV Allocation',
      icon: Zap,
      status: s3Status,
      badge: `Action: ${suggestedIntervention.toUpperCase()}`,
      detail: `Expected Value: ${formatPaiseToINR(evPaise, true)} · Cycle ${payment.attempt_count}/3`,
      actor: 'system_engine',
    },
    {
      id: 4,
      title: 'Eligibility',
      subtitle: 'Safety Invariants Filter',
      icon: ShieldCheck,
      status: s4Status,
      badge: safetyResult.eligible ? 'Safety Pass' : 'Safety Halt',
      detail: safetyResult.eligible
        ? 'Opt-in confirmed · Active account · Under max attempts'
        : `Halt: ${safetyResult.stop_detail ?? 'Safety filter stop'}`,
      actor: 'system_engine',
    },
    {
      id: 5,
      title: 'Govern',
      subtitle: 'High-Value Approval Gate',
      icon: UserCheck,
      status: s5Status,
      badge: isHighValue
        ? isApproved || isExecuted
          ? 'Approved by Operator'
          : 'Awaiting Operator'
        : 'Auto-Approved (< ₹10k)',
      detail: isHighValue
        ? `Invoice ≥ ₹10,000 threshold (${formatPaiseToINR(payment.amount, true)}) requires dual-custody approval`
        : 'Value within automated policy limits',
      actor: 'reviewer',
    },
    {
      id: 6,
      title: 'Execute',
      subtitle: 'Test-Mode API Dispatch',
      icon: Send,
      status: s6Status,
      badge: isExecuted ? 'Dispatched (1x)' : 'Pending Dispatch',
      detail: isExecuted
        ? `Ref: ${executionReference ?? 'sim_txn_' + payment.payment_id} · Zero customer fund debit`
        : 'Single-execution idempotency locked',
      actor: 'system_engine',
    },
    {
      id: 7,
      title: 'Observe',
      subtitle: 'Status Polling & Outcome',
      icon: Eye,
      status: s7Status,
      badge:
        s7Status === 'recovered'
          ? `Settled: ${formatPaiseToINR(recoveredPaise, true)}`
          : isExecuted
            ? 'Polling Gateway (Pending)'
            : 'Awaiting Execution',
      detail:
        s7Status === 'recovered'
          ? 'Proactive status polling verified settlement'
          : 'Payment link created counts as ₹0 recovered until verified settlement',
      actor: 'outcome_observer',
    },
    {
      id: 8,
      title: 'Audit',
      subtitle: 'SHA-256 Ledger Block',
      icon: FileCheck,
      status: s8Status,
      badge: s8Status === 'completed' ? 'Block Chained' : 'Pending Block',
      detail: `Hash: ${auditHash ? auditHash.slice(0, 16) + '...' : '0x' + payment.payment_id.slice(0, 12) + '...'} · Immutable hash verification`,
      actor: 'system_engine',
    },
  ];

  return (
    <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-5 shadow-xl">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Fingerprint className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              End-to-End Recovery Journey
              <span className="text-[11px] font-mono font-normal px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                {payment.payment_id}
              </span>
            </h4>
            <p className="text-xs text-slate-400">
              Visible closed-loop lifecycle: Detect $\to$ Diagnose $\to$ Intervene $\to$ Eligibility $\to$ Govern $\to$ Execute $\to$ Observe $\to$ Audit
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs text-slate-400">Exposure Status</div>
          <span
            className={`inline-block px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wider ${
              s7Status === 'recovered'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : s4Status === 'stopped'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : s5Status === 'in_progress'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
            }`}
          >
            {s7Status === 'recovered'
              ? 'Recovered'
              : s4Status === 'stopped'
                ? 'Halted by Safety'
                : s5Status === 'in_progress'
                  ? 'Approval Required'
                  : 'In Process'}
          </span>
        </div>
      </div>

      {/* 8-Stage Interactive Stepper Grid */}
      <div className="space-y-3">
        {stages.map((stage) => {
          const Icon = stage.icon;

          let statusBadgeClass = 'bg-slate-800 text-slate-400 border-slate-700';
          let statusIcon = <Clock className="w-3.5 h-3.5 text-slate-500" />;

          if (stage.status === 'completed' || stage.status === 'recovered') {
            statusBadgeClass = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
            statusIcon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
          } else if (stage.status === 'in_progress') {
            statusBadgeClass = 'bg-amber-500/10 text-amber-300 border-amber-500/30';
            statusIcon = <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />;
          } else if (stage.status === 'stopped' || stage.status === 'failed') {
            statusBadgeClass = 'bg-rose-500/10 text-rose-300 border-rose-500/30';
            statusIcon = <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />;
          } else if (stage.status === 'skipped') {
            statusBadgeClass = 'bg-slate-800/60 text-slate-400 border-slate-700/60';
            statusIcon = <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />;
          }

          return (
            <div
              key={stage.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors"
            >
              <div className="w-7 h-7 rounded-md bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-3.5 h-3.5 text-slate-300" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-200">
                      {stage.id}. {stage.title}
                    </span>
                    <span className="text-[11px] text-slate-500">· {stage.subtitle}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                      actor: {stage.actor}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded border ${statusBadgeClass}`}
                    >
                      {statusIcon}
                      {stage.badge}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-400 mt-1 font-mono">{stage.detail}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>Settlement Accounting: Link creation = ₹0.00 recovered until verified capture</span>
        </div>
        <div className="flex items-center gap-1 text-slate-500 font-mono text-[11px]">
          <span>actor: outcome_observer</span>
          <ArrowRight className="w-3 h-3" />
          <span>immutable hash-chain</span>
        </div>
      </div>
    </div>
  );
};
