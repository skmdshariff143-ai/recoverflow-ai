/**
 * PayBack AI — Cost-of-Inaction Live Counter.
 *
 * Renders a dynamic, client-side ticking counter illustrating the hourly decay
 * and accumulated loss of leaving failed payments unprocessed.
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Flame, Clock, Info } from 'lucide-react';
import { calculateCostOfInaction } from '@/lib/engine/costOfInaction';

interface CostOfInactionCounterProps {
  totalRevenueAtRiskPaise: number;
  hourlyDecayRateBps?: number;
}

export function CostOfInactionCounter({
  totalRevenueAtRiskPaise,
  hourlyDecayRateBps = 75,
}: CostOfInactionCounterProps) {
  const metrics = useMemo(
    () => calculateCostOfInaction(totalRevenueAtRiskPaise, hourlyDecayRateBps),
    [totalRevenueAtRiskPaise, hourlyDecayRateBps],
  );

  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [showTooltip, setShowTooltip] = useState<boolean>(false);

  // Smooth client-side timer ticking every 100ms
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      setElapsedSeconds(elapsed);
    }, 100);

    return () => clearInterval(interval);
  }, [totalRevenueAtRiskPaise]);

  // Accumulated simulated loss in rupees
  const accumulatedLossPaise = elapsedSeconds * metrics.lossPerSecondPaise;
  const accumulatedLossRupees = (accumulatedLossPaise / 100).toFixed(2);

  return (
    <div
      data-testid="cost-of-inaction-counter"
      className="mt-3 pt-3 border-t border-slate-100 bg-rose-50/40 -mx-4 -mb-4 p-3 rounded-b-xl border-t-rose-100"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          </span>
          <span className="text-[11px] font-bold text-rose-900 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-rose-600" />
            Cost of Inaction:
          </span>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowTooltip(!showTooltip)}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            aria-label="Cost of inaction assumptions"
            className="text-slate-400 hover:text-slate-600 transition cursor-pointer p-0.5"
          >
            <Info className="w-3.5 h-3.5" />
          </button>

          {showTooltip && (
            <div className="absolute right-0 bottom-full mb-2 w-72 p-2.5 bg-slate-900 text-white text-[11px] rounded-lg shadow-xl border border-slate-700 z-40 leading-relaxed space-y-1.5">
              <span className="font-bold block text-rose-300 flex items-center gap-1">
                <Clock className="w-3 h-3 text-rose-400" />
                Industry Delinquency Decay
              </span>
              <p>
                Standard subscription benchmarks assume a{' '}
                <strong>{metrics.decayRatePercentage}% / hour</strong> decay rate (~18% in 24h) due to card churn, invalid mandates, and customer inertia.
              </p>
              <div className="pt-1 border-t border-slate-800 text-[10px] text-slate-400 italic">
                Methodology note: Simulated metric based on current cohort revenue at risk and internal dunning decay formulas; not third-party validated.
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-1.5 flex items-baseline justify-between">
        <div>
          <span
            data-testid="cost-of-inaction-rate"
            className="text-sm font-extrabold text-rose-700 font-mono"
          >
            ₹{metrics.hourlyLossRupees.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            <span className="text-[10px] font-bold text-rose-800 font-sans ml-0.5">/hr</span>
          </span>
          <span className="text-[10px] text-slate-600 block font-medium">
            estimated loss rate
          </span>
        </div>

        <div className="text-right">
          <span
            data-testid="cost-of-inaction-accumulated"
            className="text-xs font-bold text-rose-900 font-mono bg-rose-100/90 px-2 py-0.5 rounded border border-rose-300"
          >
            +₹{accumulatedLossRupees}
          </span>
          <span className="text-[10px] text-slate-600 font-medium block mt-0.5">
            lost since load ({elapsedSeconds.toFixed(1)}s)
          </span>
        </div>
      </div>
    </div>
  );
}
