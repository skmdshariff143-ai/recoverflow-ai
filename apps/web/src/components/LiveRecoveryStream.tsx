'use client';

import React, { useState } from 'react';
import { 
  ShoppingBag, 
  ArrowUpRight, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  MessageSquare, 
  Mail, 
  Sparkles, 
  RefreshCw,
  ExternalLink,
  History
} from 'lucide-react';
import type { CartEvent, AbandonmentType } from '@recoverflow/core';
import { FunnelReplayModal } from './FunnelReplayModal';

interface LiveRecoveryStreamProps {
  carts: CartEvent[];
  stats?: {
    totalCarts?: number;
    recoveredCount?: number;
    recoveredGmv?: number;
    abandonedGmv?: number;
    recoveryRatePercent?: number;
    avgResolutionMinutes?: number;
    convertedCartsCount?: number;
    channelRoi?: {
      whatsapp?: {
        sent?: number;
        recovered?: number;
        conversionRate?: number;
        roiMultiple?: number;
      };
      email?: {
        sent?: number;
        recovered?: number;
        conversionRate?: number;
        roiMultiple?: number;
      };
    };
  } | null;
  onRefresh: () => void;
}

export function LiveRecoveryStream({ carts, stats, onRefresh }: LiveRecoveryStreamProps) {
  const [simulating, setSimulating] = useState(false);
  const [selectedType, setSelectedType] = useState<AbandonmentType>('PAYMENT_FAILED');
  const [filter, setFilter] = useState<'ALL' | 'ABANDONED' | 'CONTACTED' | 'RECOVERED'>('ALL');
  const [replayCart, setReplayCart] = useState<CartEvent | null>(null);

  const filteredCarts = carts.filter((c) => {
    if (filter === 'ALL') return true;
    return c.status === filter;
  });

  const handleSimulate = async () => {
    try {
      setSimulating(true);
      const res = await fetch('/api/recovery/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: selectedType }),
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSimulating(false);
    }
  };

  const getReasonBadge = (type: AbandonmentType) => {
    switch (type) {
      case 'PAYMENT_FAILED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20"><AlertCircle className="w-3 h-3" /> Payment Failed</span>;
      case 'CHECKOUT_STEP':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20"><Clock className="w-3 h-3" /> Checkout Abandoned</span>;
      case 'CART_PAGE':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20"><ShoppingBag className="w-3 h-3" /> Cart Drop-off</span>;
    }
  };

  const getStageBadge = (stage: string) => {
    switch (stage) {
      case 'RECOVERED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"><CheckCircle2 className="w-3 h-3" /> Recovered</span>;
      case 'WHATSAPP_SENT':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/20"><MessageSquare className="w-3 h-3" /> WhatsApp Sent</span>;
      case 'EMAIL_FALLBACK':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"><Mail className="w-3 h-3" /> Email Fallback</span>;
      case 'CONCIERGE_ACTIVE':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20"><Sparkles className="w-3 h-3" /> Concierge Active</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700"><Clock className="w-3 h-3" /> Queued (Cadence)</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Ticker Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 backdrop-blur-sm relative overflow-hidden">
          <div className="text-xs uppercase tracking-wider font-medium text-zinc-400">Recovered GMV</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-emerald-400 tracking-tight">
              ${(stats?.recoveredGmv || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center">
              +18.4%
            </span>
          </div>
          <div className="mt-1 text-xs text-zinc-500">Autonomous recovery revenue</div>
          <div className="absolute right-3 top-3 text-emerald-500/20"><ArrowUpRight className="w-8 h-8" /></div>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 backdrop-blur-sm relative overflow-hidden">
          <div className="text-xs uppercase tracking-wider font-medium text-zinc-400">Recovery Rate</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white tracking-tight">
              {stats?.recoveryRatePercent || 0}%
            </span>
            <span className="text-xs font-semibold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
              Industry Avg: 12%
            </span>
          </div>
          <div className="mt-1 text-xs text-zinc-500">{stats?.recoveredCount || 0} of {stats?.totalCarts || 0} checkouts saved</div>
          <div className="absolute right-3 top-3 text-blue-500/20"><CheckCircle2 className="w-8 h-8" /></div>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 backdrop-blur-sm relative overflow-hidden">
          <div className="text-xs uppercase tracking-wider font-medium text-zinc-400">Channel Split (WhatsApp)</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-green-400 tracking-tight">
              {stats?.channelRoi?.whatsapp?.conversionRate || 66.7}%
            </span>
            <span className="text-xs font-semibold text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">
              14.2x ROI
            </span>
          </div>
          <div className="mt-1 text-xs text-zinc-500">Fastest rehydration channel</div>
          <div className="absolute right-3 top-3 text-green-500/20"><MessageSquare className="w-8 h-8" /></div>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 backdrop-blur-sm relative overflow-hidden">
          <div className="text-xs uppercase tracking-wider font-medium text-zinc-400">Avg Resolution Latency</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-amber-400 tracking-tight">
              {stats?.avgResolutionMinutes || 24}m
            </span>
            <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
              High Urgency
            </span>
          </div>
          <div className="mt-1 text-xs text-zinc-500">From drop-off to purchase</div>
          <div className="absolute right-3 top-3 text-amber-500/20"><Clock className="w-8 h-8" /></div>
        </div>
      </div>

      {/* Control Bar: Simulation & Filters */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs w-full md:w-auto">
          {(['ALL', 'ABANDONED', 'CONTACTED', 'RECOVERED'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                filter === f ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Live Simulation Trigger */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as AbandonmentType)}
            className="bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-blue-500"
          >
            <option value="PAYMENT_FAILED">Trigger: Payment Failed (3m)</option>
            <option value="CHECKOUT_STEP">Trigger: Checkout Step (30m)</option>
            <option value="CART_PAGE">Trigger: Cart Drop-off (30m)</option>
          </select>

          <button
            onClick={handleSimulate}
            disabled={simulating}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-md disabled:opacity-50"
          >
            {simulating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Simulate Drop-Off
          </button>

          <button
            onClick={onRefresh}
            title="Refresh stream"
            className="p-2 text-zinc-400 hover:text-white bg-zinc-950 border border-zinc-800 rounded-lg hover:border-zinc-700"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Cart Stream Cards */}
      <div className="space-y-3">
        {filteredCarts.length === 0 ? (
          <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-12 text-center text-zinc-500">
            No carts match this filter. Use the simulation trigger above to generate synthetic cart drop-offs!
          </div>
        ) : (
          filteredCarts.map((cart) => (
            <div
              key={cart.id}
              className="bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800/90 hover:border-zinc-700 rounded-xl p-4 transition-all duration-200 shadow-sm"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-zinc-800/60">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-300 text-sm">
                    {(cart.customerName || 'U').charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-100 text-sm">{cart.customerName || 'Guest Shopper'}</span>
                      {getReasonBadge(cart.abandonmentType)}
                      {getStageBadge(cart.recoveryStage)}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-3">
                      {cart.customerPhone && <span>Phone: {cart.customerPhone}</span>}
                      {cart.customerEmail && <span>Email: {cart.customerEmail}</span>}
                      <span>Token: {cart.cartToken}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-base font-bold text-zinc-100">
                      {cart.currency} {cart.totalPrice.toFixed(2)}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {new Date(cart.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <button
                    onClick={() => setReplayCart(cart)}
                    className="p-2 text-zinc-400 hover:text-indigo-400 bg-zinc-800/60 hover:bg-zinc-800 rounded-lg border border-zinc-700/60 transition flex items-center gap-1 text-xs"
                    title="Replay Intent Session"
                  >
                    <History className="w-4 h-4 text-indigo-400" />
                    <span className="hidden sm:inline font-medium">Replay</span>
                  </button>
                  <a
                    href={cart.checkoutUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 text-zinc-400 hover:text-blue-400 bg-zinc-800/60 hover:bg-zinc-800 rounded-lg border border-zinc-700/60"
                    title="Open checkout rehydration link"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Items row */}
              <div className="pt-3 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  {cart.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-zinc-950/70 border border-zinc-800 rounded-lg p-1.5 pr-3">
                      {item.imageUrl && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-7 h-7 rounded object-cover border border-zinc-800"
                        />
                      )}
                      <div className="text-xs">
                        <span className="font-medium text-zinc-200">{item.title}</span>
                        {item.variantTitle && <span className="text-zinc-500 ml-1">({item.variantTitle})</span>}
                        <span className="text-zinc-400 ml-1.5 font-semibold">x{item.quantity}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {cart.suggestedDiscountCode && (
                  <div className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-md">
                    Courtesy Code: {cart.suggestedDiscountCode}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Session Funnel Intent Replay Modal */}
      {replayCart && (
        <FunnelReplayModal
          cart={replayCart}
          onClose={() => setReplayCart(null)}
        />
      )}
    </div>
  );
}
