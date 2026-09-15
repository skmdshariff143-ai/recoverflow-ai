'use client';

import React, { useState } from 'react';
import { 
  GitFork, 
  ShieldCheck, 
  Sparkles, 
  RefreshCw, 
  Award
} from 'lucide-react';
import { BanditPolicyArm, CartValueTier, ThompsonSamplerMarginGuardian } from '@recoverflow/agents';

type TierFilter = 'ALL' | CartValueTier;

interface ArmState {
  armId: BanditPolicyArm;
  name: string;
  description: string;
  alpha: number;
  beta: number;
  pulls: number;
  totalReward: number;
  color: string;
}

const INITIAL_ARM_DATA: Record<TierFilter, ArmState[]> = {
  ALL: [
    {
      armId: 'ARM_ZERO_DISCOUNT_URGENCY',
      name: 'Zero-Discount Urgency',
      description: 'Cart hold countdown & social proof without margin dilution',
      alpha: 48,
      beta: 52,
      pulls: 100,
      totalReward: 8450.0,
      color: 'from-emerald-500 to-teal-600',
    },
    {
      armId: 'ARM_FREE_SHIPPING',
      name: 'Free Express Shipping',
      description: 'Threshold shipping waiver saving customer cart dropoff',
      alpha: 58,
      beta: 42,
      pulls: 100,
      totalReward: 7820.0,
      color: 'from-blue-500 to-cyan-600',
    },
    {
      armId: 'ARM_DYNAMIC_MICRO_DISCOUNT',
      name: 'Dynamic Micro-Discount (3-7%)',
      description: 'Algorithmically bounded margin-protective incentive',
      alpha: 64,
      beta: 36,
      pulls: 100,
      totalReward: 6940.0,
      color: 'from-amber-500 to-orange-600',
    },
    {
      armId: 'ARM_BUNDLE_GIFT_SWAP',
      name: 'Bundle Gift Swap',
      description: 'Complimentary high-margin add-on accessory instead of cash off',
      alpha: 42,
      beta: 58,
      pulls: 100,
      totalReward: 5410.0,
      color: 'from-purple-500 to-indigo-600',
    },
  ],
  LOW: [
    {
      armId: 'ARM_ZERO_DISCOUNT_URGENCY',
      name: 'Zero-Discount Urgency',
      description: 'Cart hold countdown & social proof without margin dilution',
      alpha: 54,
      beta: 46,
      pulls: 100,
      totalReward: 3200.0,
      color: 'from-emerald-500 to-teal-600',
    },
    {
      armId: 'ARM_FREE_SHIPPING',
      name: 'Free Express Shipping',
      description: 'Threshold shipping waiver saving customer cart dropoff',
      alpha: 72,
      beta: 28,
      pulls: 100,
      totalReward: 4100.0,
      color: 'from-blue-500 to-cyan-600',
    },
    {
      armId: 'ARM_DYNAMIC_MICRO_DISCOUNT',
      name: 'Dynamic Micro-Discount (3-7%)',
      description: 'Algorithmically bounded margin-protective incentive',
      alpha: 38,
      beta: 62,
      pulls: 100,
      totalReward: 1950.0,
      color: 'from-amber-500 to-orange-600',
    },
    {
      armId: 'ARM_BUNDLE_GIFT_SWAP',
      name: 'Bundle Gift Swap',
      description: 'Complimentary high-margin add-on accessory instead of cash off',
      alpha: 30,
      beta: 70,
      pulls: 100,
      totalReward: 1400.0,
      color: 'from-purple-500 to-indigo-600',
    },
  ],
  MID: [
    {
      armId: 'ARM_ZERO_DISCOUNT_URGENCY',
      name: 'Zero-Discount Urgency',
      description: 'Cart hold countdown & social proof without margin dilution',
      alpha: 62,
      beta: 38,
      pulls: 100,
      totalReward: 9600.0,
      color: 'from-emerald-500 to-teal-600',
    },
    {
      armId: 'ARM_FREE_SHIPPING',
      name: 'Free Express Shipping',
      description: 'Threshold shipping waiver saving customer cart dropoff',
      alpha: 55,
      beta: 45,
      pulls: 100,
      totalReward: 7800.0,
      color: 'from-blue-500 to-cyan-600',
    },
    {
      armId: 'ARM_DYNAMIC_MICRO_DISCOUNT',
      name: 'Dynamic Micro-Discount (3-7%)',
      description: 'Algorithmically bounded margin-protective incentive',
      alpha: 68,
      beta: 32,
      pulls: 100,
      totalReward: 8900.0,
      color: 'from-amber-500 to-orange-600',
    },
    {
      armId: 'ARM_BUNDLE_GIFT_SWAP',
      name: 'Bundle Gift Swap',
      description: 'Complimentary high-margin add-on accessory instead of cash off',
      alpha: 45,
      beta: 55,
      pulls: 100,
      totalReward: 6100.0,
      color: 'from-purple-500 to-indigo-600',
    },
  ],
  HIGH: [
    {
      armId: 'ARM_ZERO_DISCOUNT_URGENCY',
      name: 'Zero-Discount Urgency',
      description: 'Cart hold countdown & social proof without margin dilution',
      alpha: 76,
      beta: 24,
      pulls: 100,
      totalReward: 18400.0,
      color: 'from-emerald-500 to-teal-600',
    },
    {
      armId: 'ARM_FREE_SHIPPING',
      name: 'Free Express Shipping',
      description: 'Threshold shipping waiver saving customer cart dropoff',
      alpha: 40,
      beta: 60,
      pulls: 100,
      totalReward: 8200.0,
      color: 'from-blue-500 to-cyan-600',
    },
    {
      armId: 'ARM_DYNAMIC_MICRO_DISCOUNT',
      name: 'Dynamic Micro-Discount (3-7%)',
      description: 'Algorithmically bounded margin-protective incentive',
      alpha: 50,
      beta: 50,
      pulls: 100,
      totalReward: 11200.0,
      color: 'from-amber-500 to-orange-600',
    },
    {
      armId: 'ARM_BUNDLE_GIFT_SWAP',
      name: 'Bundle Gift Swap',
      description: 'Complimentary high-margin add-on accessory instead of cash off',
      alpha: 68,
      beta: 32,
      pulls: 100,
      totalReward: 15600.0,
      color: 'from-purple-500 to-indigo-600',
    },
  ],
};

export function BanditConvergenceGraph() {
  const [selectedTier, setSelectedTier] = useState<TierFilter>('MID');
  const [armData, setArmData] = useState<Record<TierFilter, ArmState[]>>(INITIAL_ARM_DATA);
  const [lastSelectedArm, setLastSelectedArm] = useState<BanditPolicyArm | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const currentArms = armData[selectedTier];
  const totalPulls = currentArms.reduce((acc, curr) => acc + curr.pulls, 0);

  // Determine which arm has the highest expected conversion rate
  const bestArm = [...currentArms].sort((a, b) => {
    const meanA = a.alpha / (a.alpha + a.beta);
    const meanB = b.alpha / (b.alpha + b.beta);
    return meanB - meanA;
  })[0];

  const handleSimulatePull = () => {
    setIsSimulating(true);
    setTimeout(() => {
      // Create a ThompsonSampler instance initialized with current posterior parameters
      const sampler = new ThompsonSamplerMarginGuardian();
      const tier: CartValueTier = selectedTier === 'ALL' ? 'MID' : selectedTier;
      const cartVal = tier === 'LOW' ? 65 : tier === 'MID' ? 185 : 420;
      
      // Perform sampling across the current arms
      const selected = sampler.selectArm({
        merchantId: 'merchant_default_01',
        category: 'apparel',
        cartValue: cartVal,
        cartTier: tier,
      });
      setLastSelectedArm(selected.selectedArm);

      // Simulate binary conversion outcome based on true conversion probability
      const targetArm = currentArms.find((a) => a.armId === selected.selectedArm);
      const winProbability = targetArm ? targetArm.alpha / (targetArm.alpha + targetArm.beta) : 0.5;
      const converted = Math.random() < winProbability;
      const reward = converted ? cartVal * 0.7 - (selected.selectedArm === 'ARM_DYNAMIC_MICRO_DISCOUNT' ? cartVal * 0.05 : 0) : 0;

      setArmData((prev) => {
        const next = { ...prev };
        next[selectedTier] = next[selectedTier].map((arm) => {
          if (arm.armId === selected.selectedArm) {
            return {
              ...arm,
              alpha: converted ? arm.alpha + 1 : arm.alpha,
              beta: !converted ? arm.beta + 1 : arm.beta,
              pulls: arm.pulls + 1,
              totalReward: arm.totalReward + reward,
            };
          }
          return arm;
        });
        return next;
      });

      setIsSimulating(false);
    }, 350);
  };

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 space-y-6">
      {/* Header with Title and Tier Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <GitFork className="w-4 h-4" />
            </span>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Thompson Sampling Margin Guardian (MAB)
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              Real-Time Beta-Bernoulli
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
            Autonomous reinforcement learning engine allocating incentive policies across 4 arms. 
            Balances exploration of new pricing tactics with exploitation of maximum net gross margin yield.
          </p>
        </div>

        {/* Action Button & Segment Controls */}
        <div className="flex items-center gap-3">
          {/* Cart Value Tier Selector */}
          <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl p-1 text-xs">
            {(['ALL', 'LOW', 'MID', 'HIGH'] as TierFilter[]).map((tier) => (
              <button
                key={tier}
                onClick={() => setSelectedTier(tier)}
                className={`px-3 py-1 rounded-lg font-medium transition ${
                  selectedTier === tier
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {tier === 'ALL' ? 'All Carts' : tier === 'LOW' ? '< $100' : tier === 'MID' ? '$100–$300' : '> $300'}
              </button>
            ))}
          </div>

          {/* Simulate MAB Draw */}
          <button
            onClick={handleSimulatePull}
            disabled={isSimulating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
            <span>Simulate Step</span>
          </button>
        </div>
      </div>

      {/* Arm Statistics & Convergence Bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {currentArms.map((arm) => {
          const mean = arm.alpha / (arm.alpha + arm.beta);
          const meanPercent = (mean * 100).toFixed(1);
          const isWinningArm = arm.armId === bestArm.armId;
          const wasJustSampled = arm.armId === lastSelectedArm;
          const avgRewardPerPull = (arm.totalReward / arm.pulls).toFixed(2);
          const trafficAllocation = ((arm.pulls / totalPulls) * 100).toFixed(1);

          return (
            <div
              key={arm.armId}
              className={`rounded-xl border p-4 transition-all duration-300 ${
                wasJustSampled
                  ? 'bg-indigo-950/40 border-indigo-500/80 shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-500/40'
                  : isWinningArm
                  ? 'bg-zinc-950/90 border-emerald-500/30'
                  : 'bg-zinc-950/60 border-zinc-800'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{arm.name}</span>
                    {isWinningArm && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                        <Award className="w-3 h-3" /> Exploitation Leader
                      </span>
                    )}
                    {wasJustSampled && (
                      <span className="text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-md animate-pulse">
                        Target Sampled
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">{arm.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-extrabold text-white">{meanPercent}%</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Conv. Mean (E[θ])</div>
                </div>
              </div>

              {/* Visual Distribution Progress Bar */}
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>Posterior Beta({arm.alpha}, {arm.beta})</span>
                  <span>Traffic Share: {trafficAllocation}%</span>
                </div>
                <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800 p-0.5">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${arm.color} transition-all duration-500`}
                    style={{ width: `${meanPercent}%` }}
                  />
                </div>
              </div>

              {/* Metrics Footer */}
              <div className="mt-3 pt-3 border-t border-zinc-800/80 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-zinc-900/50 rounded-lg p-1.5 border border-zinc-800/50">
                  <div className="text-[10px] text-zinc-500">Allocations</div>
                  <div className="font-semibold text-zinc-200 mt-0.5">{arm.pulls} pulls</div>
                </div>
                <div className="bg-zinc-900/50 rounded-lg p-1.5 border border-zinc-800/50">
                  <div className="text-[10px] text-zinc-500">Net Profit Yield</div>
                  <div className="font-semibold text-emerald-400 mt-0.5">${arm.totalReward.toLocaleString()}</div>
                </div>
                <div className="bg-zinc-900/50 rounded-lg p-1.5 border border-zinc-800/50">
                  <div className="text-[10px] text-zinc-500">Avg Reward / Pull</div>
                  <div className="font-semibold text-indigo-300 mt-0.5">${avgRewardPerPull}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mathematical Principle Callout */}
      <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>
            <strong className="text-zinc-200">Objective Function:</strong> Maximizes cumulative reward <code className="text-indigo-300">R = (Recovered_GMV - Discount_Cost - Meta_SLA_Fee) × Converted</code>. 
            High-value baskets automatically prioritize zero-discount urgency over costly percentage giveaways.
          </span>
        </div>
        <div className="shrink-0 flex items-center gap-1.5 text-zinc-500 font-mono text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Zero Margin Bleed Guard</span>
        </div>
      </div>
    </div>
  );
}
