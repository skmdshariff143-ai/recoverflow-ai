/**
 * PayBack AI — Sticky Mini-Summary Bar.
 *
 * Slim, sticky strip that slides in when scrolling past the main KPI metrics row.
 * Displays revenue at risk, recovered amount, and budget utilization.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowUp, RotateCcw } from 'lucide-react';
import { formatPaiseToINR } from '@/lib/engine/financial';

interface StickySummaryBarProps {
  totalRevenueAtRisk: number;
  totalRevenueRecovered: number;
  overallRecoveryRate: number;
  budgetedCount: number;
  budgetLimit: number;
  brierScore: number;
  onReSimulate?: () => void;
}

export function StickySummaryBar({
  totalRevenueAtRisk,
  totalRevenueRecovered,
  overallRecoveryRate,
  budgetedCount,
  budgetLimit,
  brierScore,
  onReSimulate,
}: StickySummaryBarProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show when scrolled past KPI metric cards (approx 220px)
      if (window.scrollY > 220) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Initial check
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!isVisible) return null;

  return (
    <aside
      aria-label="Recovery Metrics Summary"
      className="fixed top-12 left-0 right-0 z-25 bg-slate-900/95 backdrop-blur-md border-b border-slate-700 text-white shadow-lg transition-all duration-200 animate-slide-down"
      data-testid="sticky-summary-bar"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between text-xs gap-3">
        {/* Left: Brand / Title */}
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="font-bold text-slate-200 hidden sm:inline">PayBack AI</span>
          <span className="text-slate-400 hidden md:inline text-[11px]">| Snapshot:</span>
        </div>

        {/* Center: Key Financial Numbers */}
        <div className="flex items-center flex-wrap gap-4 sm:gap-6 font-mono text-[11px]">
          <div>
            <span className="text-slate-400 text-[10px] block sm:inline mr-1 font-sans">At Risk:</span>
            <span className="font-bold text-rose-300">
              {formatPaiseToINR(totalRevenueAtRisk, true)}
            </span>
          </div>

          <div>
            <span className="text-slate-400 text-[10px] block sm:inline mr-1 font-sans">Recovered:</span>
            <span className="font-bold text-emerald-400">
              {formatPaiseToINR(totalRevenueRecovered, true)}
            </span>
            <span className="text-emerald-300/80 text-[10px] ml-1">({overallRecoveryRate}%)</span>
          </div>

          <div>
            <span className="text-slate-400 text-[10px] block sm:inline mr-1 font-sans">Budget:</span>
            <span className="font-bold text-indigo-300">
              {budgetedCount} / {budgetLimit} slots
            </span>
          </div>

          <div className="hidden lg:block">
            <span className="text-slate-400 text-[10px] mr-1 font-sans">Brier Score:</span>
            <span className="font-bold text-cyan-300">{brierScore.toFixed(3)}</span>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-2">
          {onReSimulate && (
            <button
              onClick={onReSimulate}
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1 rounded border border-slate-700 text-[11px] font-medium transition cursor-pointer"
              title="Re-Simulate Batch"
            >
              <RotateCcw className="w-3 h-3 text-emerald-400" />
              <span className="hidden sm:inline">Re-Simulate</span>
            </button>
          )}

          <button
            onClick={scrollToTop}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            title="Scroll to Top"
            aria-label="Scroll to Top"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
