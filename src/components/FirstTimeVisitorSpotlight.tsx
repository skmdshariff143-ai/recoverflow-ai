/**
 * PayBack AI — First-Time Visitor Spotlight Sequence.
 *
 * Provides a lightweight, session-based dismissible onboarding tour highlighting:
 * 1. Cmd/Ctrl+K Command Palette
 * 2. Guided Judge Mode Walkthrough
 * 3. Explainability & Safety Trust Score
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Command,
  Award,
  ShieldCheck,
  ChevronRight,
  X,
} from 'lucide-react';

interface SpotlightStep {
  id: string;
  title: string;
  caption: string;
  icon: React.ReactNode;
  targetTestId: string;
}

const SPOTLIGHT_STEPS: SpotlightStep[] = [
  {
    id: 'step-command-palette',
    title: 'Instant Command Palette (Cmd/Ctrl+K)',
    caption: 'Press Cmd/Ctrl+K anywhere to fuzzy-search payments, switch workspaces, or trigger batch simulations instantly.',
    icon: <Command className="w-4 h-4 text-emerald-400" />,
    targetTestId: 'spotlight-step-1',
  },
  {
    id: 'step-judge-mode',
    title: 'Guided Evaluator Walkthrough',
    caption: 'Click "Judge Mode" or "Cheat Sheet" in the header for a 10-step evaluation guide and printable 1-page summary.',
    icon: <Award className="w-4 h-4 text-amber-400" />,
    targetTestId: 'spotlight-step-2',
  },
  {
    id: 'step-trust-score',
    title: 'Explainability & Safety Trust Score',
    caption: 'The Trust Score is a real-time 0–100 index derived from calibration reliability (40 pts), 7/7 hard safety rules (35 pts), and SHA-256 ledger integrity (25 pts).',
    icon: <ShieldCheck className="w-4 h-4 text-cyan-400" />,
    targetTestId: 'spotlight-step-3',
  },
];

const STORAGE_KEY = 'payback_spotlight_dismissed_v1';

export function FirstTimeVisitorSpotlight() {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [stepIndex, setStepIndex] = useState<number>(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const dismissed = sessionStorage.getItem(STORAGE_KEY);
      if (!dismissed) {
        // Short delay so DOM is fully painted
        const timer = setTimeout(() => setIsVisible(true), 300);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY, 'true');
    }
  }, []);

  const handleNext = useCallback(() => {
    if (stepIndex < SPOTLIGHT_STEPS.length - 1) {
      setStepIndex((prev) => prev + 1);
    } else {
      handleDismiss();
    }
  }, [stepIndex, handleDismiss]);

  // Global Escape key listener to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible) {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, handleDismiss]);

  if (!isVisible) return null;

  const currentStep = SPOTLIGHT_STEPS[stepIndex];

  return (
    <div
      data-testid="spotlight-overlay"
      className="fixed bottom-6 right-6 z-50 max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto"
    >
      <div
        data-testid="spotlight-card"
        className="bg-slate-900/95 backdrop-blur-md text-white rounded-2xl border border-indigo-500/50 shadow-2xl p-5 space-y-4"
      >
        {/* Header with step counter & dismiss button */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
              <Sparkles className="w-4 h-4 text-indigo-400" />
            </span>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                First-Time Spotlight · Step {stepIndex + 1} of {SPOTLIGHT_STEPS.length}
              </span>
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5 mt-0.5">
                {currentStep.icon}
                {currentStep.title}
              </h4>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            data-testid="dismiss-spotlight-btn"
            className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
            title="Dismiss Tour (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Caption */}
        <p
          data-testid="spotlight-caption"
          className="text-xs text-slate-300 leading-relaxed"
        >
          {currentStep.caption}
        </p>

        {/* Progress dots & action buttons */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            {SPOTLIGHT_STEPS.map((step, idx) => (
              <span
                key={step.id}
                className={`h-1.5 rounded-full transition-all ${
                  idx === stepIndex
                    ? 'w-5 bg-indigo-400'
                    : 'w-1.5 bg-slate-700'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDismiss}
              data-testid="skip-spotlight-btn"
              className="text-[11px] font-semibold text-slate-400 hover:text-slate-200 px-2 py-1 rounded transition cursor-pointer"
            >
              Skip
            </button>
            <button
              onClick={handleNext}
              data-testid="next-spotlight-btn"
              className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition cursor-pointer"
            >
              <span>{stepIndex === SPOTLIGHT_STEPS.length - 1 ? 'Got it!' : 'Next'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
