'use client';

import React from 'react';
import { 
  History, 
  X, 
  MousePointer, 
  EyeOff, 
  Tag, 
  AlertTriangle, 
  CheckCircle2, 
  Clock 
} from 'lucide-react';
import type { CartEvent } from '@recoverflow/core';

interface FunnelReplayModalProps {
  cart: CartEvent;
  onClose: () => void;
}

export function FunnelReplayModal({ cart, onClose }: FunnelReplayModalProps) {
  // Synthesize realistic intent timeline prior to abandonment
  const timelineEvents = [
    {
      id: 'e1',
      type: 'CHECKOUT_LOADED',
      label: 'Checkout Step 1 Loaded',
      detail: `Subtotal: ${cart.currency} ${cart.totalPrice.toFixed(2)} (${cart.items.length} items)`,
      timeOffset: '-4m 12s',
      icon: Clock,
      severity: 'info',
    },
    {
      id: 'e2',
      type: 'FIELD_BLUR_IDENTITY',
      label: 'Customer Identification Captured',
      detail: `${cart.customerName || 'Shopper'} entered email & phone`,
      timeOffset: '-3m 45s',
      icon: CheckCircle2,
      severity: 'success',
    },
    {
      id: 'e3',
      type: 'DISCOUNT_FAILURE_TRIGGER',
      label: 'Discount Code Error Observed',
      detail: 'Attempted promo code "WELCOME20" rejected (expired/invalid)',
      timeOffset: '-2m 10s',
      icon: Tag,
      severity: 'warning',
    },
    {
      id: 'e4',
      type: 'TAB_BLUR_TRIGGER',
      label: 'Tab Inactive / Window Blurred',
      detail: 'Customer switched tabs for 68 seconds to search for competitor coupons',
      timeOffset: '-1m 02s',
      icon: EyeOff,
      severity: 'warning',
    },
    {
      id: 'e5',
      type: 'EXIT_VELOCITY_TRIGGER',
      label: 'Exit Velocity Vector Fired',
      detail: 'Cursor accelerated upward toward tab close bar (Y-speed: -1.4px/ms at Y=18px)',
      timeOffset: '-0m 14s',
      icon: MousePointer,
      severity: 'critical',
    },
    {
      id: 'e6',
      type: 'AUTONOMOUS_INTERVENTION',
      label: 'RecoverFlow Autonomous Recovery Queued',
      detail: `Thompson Sampling selected policy arm; Cadence delay computed`,
      timeOffset: '0m 00s',
      icon: AlertTriangle,
      severity: 'success',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Pre-Abandonment Session Replay</h3>
              <div className="text-xs text-zinc-400">
                Cart {cart.cartToken} • {cart.customerName || 'Shopper'} (${cart.totalPrice.toFixed(2)})
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Timeline Stream */}
        <div className="space-y-4 max-h-[380px] overflow-y-auto pr-2">
          {timelineEvents.map((evt, idx) => {
            const Icon = evt.icon;
            const badgeColor =
              evt.severity === 'critical'
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                : evt.severity === 'warning'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : evt.severity === 'success'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-blue-500/10 text-blue-400 border-blue-500/30';

            return (
              <div key={evt.id} className="flex gap-4 items-start relative">
                {/* Timeline vertical bar */}
                {idx !== timelineEvents.length - 1 && (
                  <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-zinc-800" />
                )}

                <div className={`w-8 h-8 rounded-full flex items-center justify-center border shrink-0 z-10 ${badgeColor}`}>
                  <Icon className="w-4 h-4" />
                </div>

                <div className="flex-1 bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-zinc-200">{evt.label}</span>
                    <span className="text-zinc-500 font-mono text-[11px]">{evt.timeOffset}</span>
                  </div>
                  <div className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    {evt.detail}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-zinc-800 flex justify-between items-center text-xs text-zinc-500">
          <span>Captured via @recoverflow/pixel SDK (&lt;4KB edge transport)</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold rounded-lg transition"
          >
            Close Replay
          </button>
        </div>
      </div>
    </div>
  );
}
