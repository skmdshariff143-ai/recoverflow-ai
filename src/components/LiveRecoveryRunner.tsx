/**
 * RecoverFlow AI — Interactive Live Recovery Runner Workspace.
 *
 * Provides a stepped, real-time visualization of the deterministic closed-loop
 * recovery state machine, processing batch events with Play, Pause, Step,
 * Reset, and Judge Scenario selector.
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Clock,
  ArrowRight,
  UserCheck,
  Zap,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import type { FailedPayment } from '@/types';
import type {
  RecoveryWorkflowInstance,
  RecoveryState,
} from '@/lib/engine/stateMachine';
import {
  initRecoveryWorkflow,
  stepWorkflowDiagnosisAndEligibility,
  transitionWorkflowState,
  applyReviewerDecision,
} from '@/lib/engine/stateMachine';
import { formatPaiseToINR } from '@/lib/engine/financial';
import type { FrozenPotentialOutcomes } from '@/lib/engine/outcomeEnvironment';

interface LiveRecoveryRunnerProps {
  payments: FailedPayment[];
  outcomesMap: Map<string, FrozenPotentialOutcomes>;
  onWorkflowComplete?: (workflow: RecoveryWorkflowInstance) => void;
}

const LIFECYCLE_STEPS: { state: RecoveryState; label: string }[] = [
  { state: 'DETECTED', label: '1. Detected' },
  { state: 'DIAGNOSED', label: '2. Diagnosed' },
  { state: 'ELIGIBILITY_CHECKED', label: '3. Safety Check' },
  { state: 'SCHEDULED', label: '4. Scheduled' },
  { state: 'EXECUTING', label: '5. Executing' },
  { state: 'OUTCOME_OBSERVED', label: '6. Telemetry' },
  { state: 'RECOVERED', label: '7. Recovered / Stopped' },
];

export function LiveRecoveryRunner({
  payments,
  outcomesMap,
  onWorkflowComplete,
}: LiveRecoveryRunnerProps) {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speedMs, setSpeedMs] = useState<number>(1000);
  const [activeWorkflow, setActiveWorkflow] = useState<RecoveryWorkflowInstance>(() =>
    initRecoveryWorkflow(payments[0] ?? ({} as FailedPayment)),
  );
  const [manualReviewNote, setManualReviewNote] = useState<string>('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Step the current active workflow forward
  const stepForward = () => {
    if (!activeWorkflow) return;
    const current = { ...activeWorkflow };
    const outcomeMatrix = outcomesMap.get(current.payment.payment_id);

    if (current.currentState === 'DETECTED') {
      stepWorkflowDiagnosisAndEligibility(current, { autoApproveHighEV: false });
    } else if (current.currentState === 'APPROVAL_REQUIRED') {
      setIsPlaying(false);
      return;
    } else if (current.currentState === 'SCHEDULED') {
      current.cycleCount++;
      transitionWorkflowState(current, 'EXECUTING', 'system_engine', 'INTERVENTION_DISPATCHED', {
        cycle: current.cycleCount,
        intervention: current.activeIntervention,
      });
    } else if (current.currentState === 'EXECUTING') {
      const outcome =
        outcomeMatrix?.outcomes[current.activeIntervention]?.[current.cycleCount] ?? {
          recovered: false,
          settledAmountPaise: 0,
          disputed: false,
          reason: 'Attempt exhausted without settlement',
        };

      transitionWorkflowState(current, 'OUTCOME_OBSERVED', 'gateway_webhook', 'OUTCOME_TELEMETRY', {
        cycle: current.cycleCount,
        recovered: outcome.recovered,
        settledAmountPaise: outcome.settledAmountPaise,
        disputed: outcome.disputed,
      });

      if (outcome.recovered) {
        transitionWorkflowState(current, 'RECOVERED', 'gateway_webhook', 'INVOICE_SETTLED', {
          settledAmountPaise: outcome.settledAmountPaise,
        });
        current.recoveredAmountPaise = outcome.settledAmountPaise;
      } else if (outcome.disputed) {
        transitionWorkflowState(current, 'STOPPED', 'customer', 'DISPUTE_SIGNAL_HALT', {
          reason: 'Customer initiated chargeback signal',
        });
        current.terminalReason = 'Customer dispute halt enforced';
      } else if (current.cycleCount < 3) {
        transitionWorkflowState(current, 'RETRY_SCHEDULED', 'system_engine', 'EXPONENTIAL_BACKOFF_SCHEDULED', {
          nextAttempt: current.cycleCount + 1,
        });
      } else {
        transitionWorkflowState(current, 'STOPPED', 'system_engine', 'MAX_ATTEMPTS_EXCEEDED', {
          attempts: current.cycleCount,
        });
        current.terminalReason = 'Max recovery attempts (3/3) exhausted';
      }
    } else if (current.currentState === 'RETRY_SCHEDULED' || current.currentState === 'ESCALATED') {
      transitionWorkflowState(current, 'SCHEDULED', 'system_engine', 'BACKOFF_WINDOW_ELAPSED', {
        cycle: current.cycleCount + 1,
      });
    } else if (current.currentState === 'RECOVERED' || current.currentState === 'STOPPED') {
      if (onWorkflowComplete) onWorkflowComplete(current);
      if (currentIndex < payments.length - 1) {
        const nextIdx = currentIndex + 1;
        setCurrentIndex(nextIdx);
        if (payments[nextIdx]) {
          setActiveWorkflow(initRecoveryWorkflow(payments[nextIdx]));
        }
      } else {
        setIsPlaying(false);
      }
      return;
    }

    setActiveWorkflow({ ...current });
  };

  // Autoplay loop
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        stepForward();
      }, speedMs);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  });

  const handleReviewerAction = (action: 'approve' | 'reject') => {
    if (!manualReviewNote.trim()) {
      alert('Reviewer note is mandatory before taking an operational action.');
      return;
    }
    const current = { ...activeWorkflow };
    applyReviewerDecision(current, {
      action,
      actorId: 'live_operator',
      timestamp: new Date().toISOString(),
      reviewerNote: manualReviewNote,
    });
    setManualReviewNote('');
    setActiveWorkflow({ ...current });
  };

  const handleSelectScenario = (scenarioKey: string) => {
    setIsPlaying(false);
    let targetIdx = 0;

    if (scenarioKey === 'successful_recovery') {
      targetIdx = payments.findIndex((p) => !p.opt_out && p.failure_category === 'bank_downtime');
    } else if (scenarioKey === 'human_approval') {
      targetIdx = payments.findIndex((p) => p.invoice_value_tier === 'high_value' && !p.opt_out);
    } else if (scenarioKey === 'customer_opt_out') {
      targetIdx = payments.findIndex((p) => p.opt_out === true);
    } else if (scenarioKey === 'permanent_account') {
      targetIdx = payments.findIndex((p) => p.failure_category === 'permanent_account_closure');
    } else if (scenarioKey === 'quiet_hours') {
      targetIdx = payments.findIndex((p) => p.quiet_hours_window.start <= 22);
    }

    if (targetIdx === -1) targetIdx = 0;
    setCurrentIndex(targetIdx);
    if (payments[targetIdx]) {
      setActiveWorkflow(initRecoveryWorkflow(payments[targetIdx]));
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
    if (payments[0]) {
      setActiveWorkflow(initRecoveryWorkflow(payments[0]));
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Runner Controls Header ───────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Live Recovery Runner
            </h2>
            <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-200">
              Stepped Execution
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Observing deterministic state machine transitions with quiet-hours protection and manual approval gates.
          </p>
        </div>

        {/* Action Controls & Judge Preset Selector */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Judge Safety Scenario Selector */}
          <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 p-1 rounded-lg text-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-700 ml-1" />
            <select
              onChange={(e) => handleSelectScenario(e.target.value)}
              className="bg-transparent text-indigo-950 font-bold text-xs focus:outline-none pr-2 cursor-pointer"
              defaultValue=""
            >
              <option value="" disabled>⚡ Jump to Judge Scenario...</option>
              <option value="successful_recovery">1. Successful Recovery (Bank Downtime)</option>
              <option value="human_approval">2. Human Approval Gate (High Value)</option>
              <option value="customer_opt_out">3. Customer Opt-Out (Ineligible Stop)</option>
              <option value="permanent_account">4. Permanent Closure (Non-Recoverable)</option>
              <option value="quiet_hours">5. Quiet-Hours Scheduling Compliance</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <span className="text-slate-500 font-medium px-1">Speed:</span>
            <button
              onClick={() => setSpeedMs(1500)}
              className={`px-2 py-0.5 rounded ${speedMs === 1500 ? 'bg-white font-bold text-slate-900 shadow-2xs' : 'text-slate-600'}`}
            >
              1.5s
            </button>
            <button
              onClick={() => setSpeedMs(1000)}
              className={`px-2 py-0.5 rounded ${speedMs === 1000 ? 'bg-white font-bold text-slate-900 shadow-2xs' : 'text-slate-600'}`}
            >
              1.0s
            </button>
            <button
              onClick={() => setSpeedMs(500)}
              className={`px-2 py-0.5 rounded ${speedMs === 500 ? 'bg-white font-bold text-slate-900 shadow-2xs' : 'text-slate-600'}`}
            >
              0.5s
            </button>
          </div>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer ${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isPlaying ? 'Pause' : 'Play Auto'}
          </button>

          <button
            onClick={stepForward}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
          >
            <SkipForward className="w-3.5 h-3.5" />
            Step Single
          </button>

          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-700 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>

      {/* ── Active Workflow Dashboard ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Stepper & Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded">
                  Record #{currentIndex + 1} / {payments.length}
                </span>
                <span className="font-mono text-xs text-slate-500 font-bold">
                  {activeWorkflow.payment.payment_id}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                    activeWorkflow.currentState === 'RECOVERED'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : activeWorkflow.currentState === 'STOPPED'
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : activeWorkflow.currentState === 'APPROVAL_REQUIRED'
                          ? 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                          : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                  }`}
                >
                  State: {activeWorkflow.currentState}
                </span>
              </div>
            </div>

            {/* Payment Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 block">Amount</span>
                <span className="text-sm font-bold text-slate-900">
                  {formatPaiseToINR(activeWorkflow.payment.amount, true)}
                </span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 block">Failure Reason</span>
                <span className="font-semibold text-slate-800 capitalize">
                  {activeWorkflow.payment.failure_category.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 block">Intervention</span>
                <span className="font-bold text-indigo-600 uppercase">
                  {activeWorkflow.activeIntervention} (Cycle {activeWorkflow.cycleCount}/3)
                </span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 block">Quiet Hours</span>
                <span className="font-medium text-slate-700">
                  {activeWorkflow.payment.quiet_hours_window.start}:00–
                  {activeWorkflow.payment.quiet_hours_window.end}:00
                </span>
              </div>
            </div>

            {/* Lifecycle Progress Bar */}
            <div className="pt-2">
              <div className="text-xs font-semibold text-slate-700 mb-2">Workflow State Progression:</div>
              <div className="grid grid-cols-7 gap-1 text-[11px] text-center font-medium">
                {LIFECYCLE_STEPS.map((step) => {
                  const isActive = activeWorkflow.currentState === step.state;
                  return (
                    <div
                      key={step.state}
                      className={`p-2 rounded-md border transition ${
                        isActive
                          ? 'bg-indigo-600 text-white font-bold border-indigo-700 shadow-xs'
                          : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}
                    >
                      <span>{step.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Human Reviewer Gate Prompt if Required */}
            {activeWorkflow.currentState === 'APPROVAL_REQUIRED' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <UserCheck className="w-4 h-4 text-amber-600" />
                  <span>Manual Approval Required for High-Value Enterprise Invoice</span>
                </div>
                <p className="text-xs text-slate-700">
                  This transaction exceeds the high-value risk threshold ({formatPaiseToINR(activeWorkflow.payment.amount, true)}). An authenticated human operator must approve or reject recovery before execution.
                </p>

                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Enter mandatory reviewer note / rationale..."
                    value={manualReviewNote}
                    onChange={(e) => setManualReviewNote(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReviewerAction('approve')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                    >
                      Approve &amp; Schedule
                    </button>
                    <button
                      onClick={() => handleReviewerAction('reject')}
                      className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                    >
                      Reject &amp; Stop
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Real-time State Machine Event Trail */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-600" />
              Real-time State Transition Trail
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">
              {activeWorkflow.history.length} events
            </span>
          </div>

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {activeWorkflow.history.map((evt, idx) => (
              <div
                key={evt.eventId || idx}
                className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs space-y-1"
              >
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-mono">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                  <span className="bg-slate-200 text-slate-700 font-bold px-1.5 py-0.2 rounded uppercase">
                    {evt.actor}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-slate-800 font-semibold">
                  <span>{evt.previousState}</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                  <span className="text-indigo-600 font-bold">{evt.nextState}</span>
                </div>
                <div className="text-[11px] text-slate-500">Reason: {evt.reasonCode}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
