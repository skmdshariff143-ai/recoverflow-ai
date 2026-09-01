/**
 * PayBack AI — Merchant Policy Builder.
 *
 * Interactive configuration form exposing live policy knobs:
 *  1. Active Budget Capacity (slots)
 *  2. High-Value Approval Ceiling (INR / Paise)
 *  3. Maximum Attempt Cap (1–3 attempts; bounded by hard safety ceiling)
 *
 * Re-runs simulation against frozen dataset upon parameter change.
 */

'use client';

import { useState } from 'react';
import { Sliders, ShieldCheck, AlertTriangle, UserCheck, Sparkles } from 'lucide-react';
import {
  type MerchantPolicyConfig,
  type PersonaId,
  validatePolicyConfig,
  DEFAULT_POLICY_CONFIG,
  MERCHANT_PERSONAS,
} from '@/lib/engine/policyConfig';
import { MAX_RECOVERY_ATTEMPTS } from '@/lib/engine/safetyFilter';
import { formatPaiseToINR } from '@/lib/engine/financial';

interface MerchantPolicyBuilderProps {
  currentConfig?: MerchantPolicyConfig;
  onApplyConfig: (config: MerchantPolicyConfig) => void;
}

export function MerchantPolicyBuilder({
  currentConfig = DEFAULT_POLICY_CONFIG,
  onApplyConfig,
}: MerchantPolicyBuilderProps) {
  const [budget, setBudget] = useState<number>(currentConfig.budget);
  const [approvalThresholdINR, setApprovalThresholdINR] = useState<number>(
    Math.round(currentConfig.approvalThresholdPaise / 100),
  );
  const [maxAttempts, setMaxAttempts] = useState<number>(currentConfig.maxAttemptsCap);
  const [selectedPersona, setSelectedPersona] = useState<PersonaId | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const handleApply = (newBudget: number, newThresholdINR: number, newMaxAttempts: number) => {
    const configToValidate: Partial<MerchantPolicyConfig> = {
      budget: newBudget,
      approvalThresholdPaise: newThresholdINR * 100,
      maxAttemptsCap: newMaxAttempts,
    };

    const validation = validatePolicyConfig(configToValidate);
    setValidationErrors(validation.errors);

    onApplyConfig(validation.sanitizedConfig);
    setLastSaved(new Date().toLocaleTimeString());
  };

  const handleSelectPersona = (personaId: PersonaId) => {
    const persona = MERCHANT_PERSONAS[personaId];
    if (!persona) return;

    setSelectedPersona(personaId);
    const pBudget = persona.config.budget;
    const pThresholdINR = Math.round(persona.config.approvalThresholdPaise / 100);
    const pAttempts = persona.config.maxAttemptsCap;

    setBudget(pBudget);
    setApprovalThresholdINR(pThresholdINR);
    setMaxAttempts(pAttempts);
    handleApply(pBudget, pThresholdINR, pAttempts);
  };

  return (
    <div
      className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4"
      data-testid="merchant-policy-builder"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-600" />
            Merchant-Configurable Policy Builder
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Tune live operational thresholds or pick a pre-calibrated risk persona.
          </p>
        </div>

        {lastSaved && (
          <span className="text-[11px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            Updated: {lastSaved}
          </span>
        )}
      </div>

      {/* ── Merchant Risk-Appetite Persona Picker ─────────────── */}
      <div data-testid="persona-picker" className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
            Merchant Risk-Appetite Personas
          </span>
          <span className="text-[11px] text-slate-400">
            Pre-fills compliant parameters; customize below at any time
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {(Object.keys(MERCHANT_PERSONAS) as PersonaId[]).map((pId) => {
            const p = MERCHANT_PERSONAS[pId];
            const isSelected = selectedPersona === pId;

            return (
              <button
                key={pId}
                type="button"
                data-testid={`persona-btn-${pId}`}
                onClick={() => handleSelectPersona(pId)}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-indigo-50/90 border-indigo-400 shadow-2xs ring-1.5 ring-indigo-500'
                    : 'bg-slate-50/70 border-slate-200 hover:border-indigo-300 hover:bg-slate-100/80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold ${isSelected ? 'text-indigo-900' : 'text-slate-900'}`}>
                      {p.name}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                        isSelected
                          ? 'bg-indigo-200 text-indigo-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {p.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-tight">
                    {p.description}
                  </p>
                </div>

                <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span>{p.config.budget} slots</span>
                  <span>{formatPaiseToINR(p.config.approvalThresholdPaise, true)}</span>
                  <span>max {p.config.maxAttemptsCap}x</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Form Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        {/* Knob 1: Contact Budget Capacity */}
        <div className="bg-slate-50/80 border border-slate-200/80 rounded-lg p-3 space-y-2">
          <div className="flex justify-between items-center">
            <label htmlFor="policy-budget-input" className="font-bold text-slate-800">
              Budget Capacity
            </label>
            <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded text-[11px]">
              {budget} Slots
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-tight">
            Maximum failed invoices selected for proactive recovery intervention.
          </p>
          <div className="space-y-1 pt-1">
            <input
              id="policy-budget-input"
              type="range"
              min="10"
              max="80"
              step="5"
              value={budget}
              onChange={(e) => {
                const val = Number(e.target.value);
                setBudget(val);
                handleApply(val, approvalThresholdINR, maxAttempts);
              }}
              className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>10 slots</span>
              <span>40 slots</span>
              <span>80 slots</span>
            </div>
          </div>
          {validationErrors.budget && (
            <p className="text-rose-600 text-[10px]">{validationErrors.budget}</p>
          )}
        </div>

        {/* Knob 2: High-Value Review Ceiling */}
        <div className="bg-slate-50/80 border border-slate-200/80 rounded-lg p-3 space-y-2">
          <div className="flex justify-between items-center">
            <label htmlFor="policy-threshold-input" className="font-bold text-slate-800">
              Approval Ceiling
            </label>
            <span className="font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[11px]">
              {formatPaiseToINR(approvalThresholdINR * 100, true)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-tight">
            Invoices above this amount require manual operator authorization.
          </p>
          <div className="pt-1">
            <input
              id="policy-threshold-input"
              type="number"
              min="5000"
              max="200000"
              step="5000"
              value={approvalThresholdINR}
              onChange={(e) => {
                const val = Number(e.target.value);
                setApprovalThresholdINR(val);
                handleApply(budget, val, maxAttempts);
              }}
              className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-900 font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          {validationErrors.approvalThresholdPaise && (
            <p className="text-rose-600 text-[10px]">{validationErrors.approvalThresholdPaise}</p>
          )}
        </div>

        {/* Knob 3: Max Attempts Cap (Hard Safety Floor) */}
        <div className="bg-slate-50/80 border border-slate-200/80 rounded-lg p-3 space-y-2">
          <div className="flex justify-between items-center">
            <label htmlFor="policy-max-attempts-select" className="font-bold text-slate-800">
              Max Attempts Cap
            </label>
            <span className="font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded text-[11px]">
              Max {maxAttempts} Attempts
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-tight">
            Safety floor preventing customer fatigue. Cannot exceed hard limit of 3.
          </p>
          <div className="pt-1">
            <select
              id="policy-max-attempts-select"
              value={maxAttempts}
              onChange={(e) => {
                const val = Number(e.target.value);
                setMaxAttempts(val);
                handleApply(budget, approvalThresholdINR, val);
              }}
              className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-900 font-semibold text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="1">1 Attempt (Ultra Conservative)</option>
              <option value="2">2 Attempts (Standard Low-Friction)</option>
              <option value="3">3 Attempts (Maximum Allowed Safety Ceiling)</option>
            </select>
          </div>
          {validationErrors.maxAttemptsCap && (
            <p className="text-rose-600 text-[10px] flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {validationErrors.maxAttemptsCap}
            </p>
          )}
        </div>
      </div>

      {/* Live Sync Status Banner */}
      <div className="flex items-center justify-between bg-indigo-50/40 border border-indigo-100 rounded-lg px-3 py-2 text-[11px] text-slate-600">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Safety Invariant Enforced: Attempt cap locked at &le; {MAX_RECOVERY_ATTEMPTS}. Changes evaluate synchronously.
          </span>
        </div>
        {lastSaved && (
          <span className="text-[10px] font-mono text-indigo-700 font-medium shrink-0">
            Updated: {lastSaved}
          </span>
        )}
      </div>
    </div>
  );
}
