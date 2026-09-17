/**
 * PayBack AI — Regulatory Footprint & Compliance Verification Badge.
 *
 * Surfaces verified regulatory compliance mappings directly to evaluators,
 * linking regulatory mandates to the exact engine files enforcing them.
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { ShieldCheck, Scale, CheckCircle2, X } from 'lucide-react';

interface ComplianceRuleItem {
  id: string;
  regulation: string;
  engineFile: string;
  ruleCheck: string;
  description: string;
}

const ENFORCED_COMPLIANCE_RULES: ComplianceRuleItem[] = [
  {
    id: 'trai-quiet-hours',
    regulation: 'TRAI / RBI Quiet-Hours Standard',
    engineFile: 'src/lib/engine/quietHours.ts',
    ruleCheck: 'isInsideQuietHours() & calculateNextContactTime()',
    description: 'Guarantees customer messages are strictly held outside 09:00–20:00 recipient local time.',
  },
  {
    id: 'dpdp-opt-out',
    regulation: 'DPDP Act 2023 Consent & Opt-Out',
    engineFile: 'src/lib/engine/safetyFilter.ts',
    ruleCheck: 'checkSafetyRules() → customer_opted_out',
    description: 'Opted-out customers are permanently stopped prior to recovery queue allocation with zero contact.',
  },
  {
    id: 'anti-harassment-cap',
    regulation: 'Anti-Harassment Attempt Limits',
    engineFile: 'src/lib/engine/safetyFilter.ts',
    ruleCheck: 'MAX_RECOVERY_ATTEMPTS = 3',
    description: 'Hard safety cap stops automated interventions at 3 attempts to prevent customer fatigue.',
  },
  {
    id: 'rbi-dual-custody',
    regulation: 'RBI High-Value Dual-Custody Gating',
    engineFile: 'src/lib/engine/approvalGate.ts',
    ruleCheck: 'evaluateApprovalRequirement()',
    description: 'Invoices exceeding approval threshold (₹50,000) require explicit human maker-checker signoff.',
  },
  {
    id: 'audit-immutability',
    regulation: 'Fintech Audit Immutability (SHA-256)',
    engineFile: 'src/lib/engine/hashChainLedger.ts',
    ruleCheck: 'verifyHashChainIntegrity()',
    description: 'Cryptographic SHA-256 HMAC hash chain guarantees tamper detection across all recovery events.',
  },
];

export function RegulatoryFootprintBadge({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    onOpenChange?.(true);
  }, [onOpenChange]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    onOpenChange?.(false);
  }, [onOpenChange]);

  // Global Escape key listener to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        data-testid="regulatory-footprint-badge"
        onClick={() => {
          if (isOpen) {
            handleClose();
          } else {
            handleOpen();
          }
        }}
        aria-label="View verified regulatory compliance footprint"
        aria-expanded={isOpen}
        className="flex items-center gap-1.5 bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-700/50 text-[11px] font-semibold px-2.5 py-1 rounded-full transition cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
      >
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        <span className="truncate">RBI Quiet-Hours · DPDP Opt-Out Enforced</span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in"
          onClick={handleClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="regulatory-footprint-title"
        >
          <div
            data-testid="regulatory-footprint-popover"
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 max-w-lg w-full p-5 z-50 text-xs space-y-4 focus:outline-none max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                  <Scale className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 id="regulatory-footprint-title" className="text-sm font-bold text-white flex items-center gap-2">
                    Verified Regulatory Footprint
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                      5 Rules Enforced
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Pure, deterministically tested code checks in PayBack AI
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close Regulatory Footprint Modal"
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[11px] text-slate-300">
              Every badge claim maps directly to pure, deterministically tested code checks in PayBack AI:
            </p>

            <div className="space-y-2.5">
              {ENFORCED_COMPLIANCE_RULES.map((rule) => (
                <div
                  key={rule.id}
                  data-testid="compliance-rule-item"
                  className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      {rule.regulation}
                    </span>
                    <code className="text-[10px] text-cyan-300 font-mono bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
                      {rule.engineFile.split('/').pop()}
                    </code>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    {rule.description}
                  </p>
                  <div className="pt-0.5 text-[10px] font-mono text-emerald-400/90">
                    Check: {rule.ruleCheck}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>All rules verified in automated test suite</span>
              <span className="font-semibold text-slate-400">100% Deterministic</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
