/**
 * PayBack AI — Self-Playing Guided Tour Mode ("Guide Me").
 *
 * Provides an automated or user-stepped presentation overlay walking evaluators
 * through the 7 primary proof pillars of PayBack AI.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Compass,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  Award,
  Target,
  LineChart,
  ListOrdered,
  Zap,
  ShieldAlert,
  Swords,
} from 'lucide-react';
import type { DashboardTab } from '@/types/pipeline';

interface TourStep {
  id: string;
  tab: DashboardTab;
  title: string;
  badge: string;
  caption: string;
  icon: React.ReactNode;
  selector?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'tour-kpi',
    tab: 'dashboard',
    title: 'Composite Trust Score & Financial KPIs',
    badge: 'Trust & Telemetry',
    caption: 'Real-time 0–100 composite trust index synthesized from calibration reliability (40 pts), 7/7 passing safety rules (35 pts), and cryptographic completeness (25 pts).',
    icon: <Award className="w-5 h-5 text-amber-400" />,
    selector: '[data-testid="trust-score-card"]',
  },
  {
    id: 'tour-calibration',
    tab: 'dashboard',
    title: 'Trained Logistic Calibration (v1.1)',
    badge: 'Machine Learning',
    caption: 'Compares trained logistic probability model against heuristic baseline, achieving a 2.98% calibration error (ECE) and +₹1,29,567 revenue recovery lift.',
    icon: <Target className="w-5 h-5 text-indigo-400" />,
    selector: '[data-testid="calibration-visualizer"]',
  },
  {
    id: 'tour-reliability',
    tab: 'dashboard',
    title: '5-Bin Empirical Reliability Diagram',
    badge: 'Statistical Proof',
    caption: 'The empirical reliability diagram proves recovery probability calibration is real: predicted probability bins align directly with actual empirical recovery yields.',
    icon: <LineChart className="w-5 h-5 text-emerald-400" />,
    selector: '[data-testid="reliability-diagram"]',
  },
  {
    id: 'tour-queue',
    tab: 'dashboard',
    title: 'Expected Value Ranked Queue',
    badge: 'Decision Engine',
    caption: 'Payments are prioritized by Expected Value (EV = Amount × Probability) with contrastive "Why Not The Others" peer explainability.',
    icon: <ListOrdered className="w-5 h-5 text-cyan-400" />,
    selector: '[data-testid="queue-row"]',
  },
  {
    id: 'tour-live-runner',
    tab: 'live_runner',
    title: 'Stepped Live Recovery Runner',
    badge: 'State Machine',
    caption: 'Simulates stepped state machine transitions with TRAI quiet-hours compliance, dual-custody human approval, and Web Audio cues.',
    icon: <Zap className="w-5 h-5 text-amber-400" />,
    selector: '[data-testid="toggle-sound-btn"]',
  },
  {
    id: 'tour-tamper',
    tab: 'audit_ledger',
    title: 'Adversarial Tamper Demo & SHA-256 Ledger',
    badge: 'Cryptographic Audit',
    caption: 'Append-only hash-chained ledger. The interactive "Try to Break It" tool allows live tampering to prove cryptographic chain invalidation.',
    icon: <ShieldAlert className="w-5 h-5 text-rose-400" />,
    selector: '[data-testid="tamper-demo-panel"]',
  },
  {
    id: 'tour-replay',
    tab: 'dashboard',
    title: 'Blind-Bot vs PayBack AI Replay Arena',
    badge: 'Head-to-Head Proof',
    caption: 'Side-by-side animated simulator proving PayBack AI prevents 3 severe regulatory violations while recovering +₹65,000 extra cash.',
    icon: <Swords className="w-5 h-5 text-purple-400" />,
    selector: '[data-testid="open-replay-arena-btn"]',
  },
];

interface GuideMeTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: DashboardTab) => void;
  onOpenReplayArena?: () => void;
}

export function GuideMeTourModal({
  isOpen,
  onClose,
  onNavigateTab,
  onOpenReplayArena,
}: GuideMeTourModalProps) {
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  const currentStep = TOUR_STEPS[stepIndex];

  // Sync active tab on step change
  useEffect(() => {
    if (isOpen && currentStep) {
      onNavigateTab(currentStep.tab);
    }
  }, [isOpen, currentStep, onNavigateTab]);

  // Auto-play progression timer (every 4 seconds when playing)
  useEffect(() => {
    if (!isOpen || !isPlaying) return;

    const timer = setTimeout(() => {
      if (stepIndex < TOUR_STEPS.length - 1) {
        setStepIndex((prev) => prev + 1);
      } else {
        setIsPlaying(false);
      }
    }, 4000);

    return () => clearTimeout(timer);
  }, [isOpen, isPlaying, stepIndex]);

  const handlePrev = useCallback(() => {
    setStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNext = useCallback(() => {
    if (stepIndex < TOUR_STEPS.length - 1) {
      setStepIndex((prev) => prev + 1);
    } else {
      onClose();
    }
  }, [stepIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="guide-me-tour-modal"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-2xl w-[92vw] animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto"
    >
      <div className="bg-slate-950/95 backdrop-blur-md text-white rounded-2xl border-2 border-indigo-500 shadow-2xl p-5 space-y-4">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-600/30 text-indigo-400 border border-indigo-500/40">
              <Compass className="w-5 h-5 animate-spin" style={{ animationDuration: '12s' }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  {currentStep.icon}
                  {currentStep.title}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  {currentStep.badge}
                </span>
              </div>
              <span className="text-[10px] font-semibold text-slate-400">
                Self-Playing Proof Tour · Highlight {stepIndex + 1} of {TOUR_STEPS.length}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            data-testid="exit-guide-tour-btn"
            className="text-slate-400 hover:text-white p-1.5 rounded-lg transition cursor-pointer"
            title="Exit Tour"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Caption */}
        <p
          data-testid="guide-tour-caption"
          className="text-xs text-slate-200 leading-relaxed font-medium bg-slate-900/80 p-3 rounded-xl border border-slate-800"
        >
          {currentStep.caption}
        </p>

        {/* Controls Bar */}
        <div className="flex items-center justify-between pt-1">
          {/* Progress Indicators */}
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((step, idx) => (
              <button
                key={step.id}
                onClick={() => setStepIndex(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  idx === stepIndex
                    ? 'w-6 bg-indigo-400'
                    : 'w-2 bg-slate-700 hover:bg-slate-600'
                }`}
                title={`Jump to step ${idx + 1}`}
              />
            ))}
          </div>

          {/* Stepper Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              data-testid="toggle-tour-autoplay-btn"
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-700 transition cursor-pointer"
              title={isPlaying ? 'Pause Auto-Play' : 'Resume Auto-Play'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{isPlaying ? 'Pause' : 'Auto-Play'}</span>
            </button>

            <button
              onClick={handlePrev}
              disabled={stepIndex === 0}
              data-testid="prev-tour-step-btn"
              className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded-lg border border-slate-700 transition cursor-pointer"
              title="Previous Highlight"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={handleNext}
              data-testid="next-tour-step-btn"
              className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition cursor-pointer"
            >
              <span>{stepIndex === TOUR_STEPS.length - 1 ? 'Finish Tour' : 'Next'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
