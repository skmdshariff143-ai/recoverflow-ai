'use client';

import React, { useEffect, useState } from 'react';
import { Zap, Store } from 'lucide-react';
import { LiveRecoveryStream } from '../../components/LiveRecoveryStream';
import type { CartEvent } from '@recoverflow/core';

export default function EcommerceRecoveryPage() {
  const [carts, setCarts] = useState<CartEvent[]>([]);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/recovery/events');
      if (res.ok) {
        const json = await res.json();
        setCarts(json.carts || []);
        setStats(json.stats || null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch('/api/recovery/events');
        if (res.ok && !ignore) {
          const json = await res.json();
          setCarts(json.carts || []);
          setStats(json.stats || null);
        }
      } catch (e) {
        console.error(e);
      }
    }
    void load();

    // Intent Pixel client listener
    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY <= 30) {
        void fetch('/api/v1/telemetry/intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'EXIT_INTENT_DETECTED',
            cartId: 'cart_edge_live_01',
            clientTimestamp: Date.now(),
            velocity: e.clientY,
          }),
        }).catch(() => {});
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      ignore = true;
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-indigo-500 selection:text-white">
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-[#09090b]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-blue-600 to-emerald-500 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
                <Zap className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-white">RecoverFlow AI</span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono">
                  Live Cart Sync
                </span>
              </div>
              <div className="text-xs text-zinc-400 flex items-center gap-1.5 font-mono">
                <Store className="w-3 h-3 text-zinc-500" />
                <span>Shopify &amp; WooCommerce Omni-Recovery</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LiveRecoveryStream carts={carts} stats={stats as Record<string, unknown> | undefined} onRefresh={fetchData} />
      </main>
    </div>
  );
}
