'use client';

import React, { useEffect, useState } from 'react';
import { 
  Zap, 
  ShoppingBag, 
  TrendingUp, 
  Sliders, 
  MessageSquare, 
  Store,
  RefreshCw,
  Command,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { LiveRecoveryStream } from '../components/LiveRecoveryStream';
import { ConversionAnalytics } from '../components/ConversionAnalytics';
import { BrandToneCalibrationStudio } from '../components/BrandToneCalibrationStudio';
import { LiveChatMonitor } from '../components/LiveChatMonitor';
import { CartsExplorer } from '../components/CartsExplorer';
import { CommandPaletteModal } from '../components/CommandPaletteModal';
import { soundFx } from '../utils/soundEffects';
import type { CartEvent, Merchant, MessageLog, SuppressionEntry } from '@recoverflow/core';

type TabType = 'STREAM' | 'ANALYTICS' | 'TONE_STUDIO' | 'CHAT_MONITOR' | 'CARTS';

export default function MerchantDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('STREAM');
  const [loading, setLoading] = useState(true);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [soundActive, setSoundActive] = useState(soundFx.isEnabled());
  const [data, setData] = useState<{
    merchant: Merchant;
    carts: CartEvent[];
    messages: MessageLog[];
    suppressions: SuppressionEntry[];
    stats: Record<string, unknown>;
  } | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/recovery/events');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/recovery/events');
        if (res.ok && isMounted) {
          const json = await res.json();
          setData(json);
        }
      } catch (e) {
        console.error('Error fetching dashboard data:', e);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void load();
    const interval = setInterval(() => {
      void load();
    }, 15000); // 15s refresh
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Global keyboard shortcut for Command Palette (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        soundFx.playMechanicalClick();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleUpdateMerchant = (updated: Partial<Merchant>) => {
    if (data) {
      setData({
        ...data,
        merchant: { ...data.merchant, ...updated },
      });
    }
  };

  const handleTabChange = (tab: 'STREAM' | 'ANALYTICS' | 'TONE_STUDIO' | 'CHAT_MONITOR' | 'CARTS') => {
    soundFx.playMechanicalClick();
    setActiveTab(tab);
  };

  const toggleAudioFeedback = () => {
    const next = soundFx.toggle();
    setSoundActive(next);
  };

  const handleSimulateAbandonment = async () => {
    try {
      soundFx.playMechanicalClick();
      await fetch('/api/recovery/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'PAYMENT_FAILED' }),
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportCFOReport = () => {
    soundFx.playMechanicalClick();
    window.open('/api/recovery/reports/export?format=csv', '_blank');
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-[#09090b]/80 backdrop-blur-md">
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
                  Autonomous MAB
                </span>
              </div>
              <div className="text-xs text-zinc-400 flex items-center gap-1.5 font-mono">
                <Store className="w-3 h-3 text-zinc-500" />
                <span>{data?.merchant.storeName || 'Aurora Luxury Apparel'}</span>
                <span className="text-zinc-600">•</span>
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
                </span>
              </div>
            </div>
          </div>

          {/* Tab Navigation Buttons */}
          <nav className="hidden md:flex items-center gap-1 bg-zinc-900/90 border border-zinc-800 p-1 rounded-xl text-xs">
            {[
              { id: 'STREAM', label: 'Live Stream', icon: Zap },
              { id: 'ANALYTICS', label: 'Analytics & ROI', icon: TrendingUp },
              { id: 'TONE_STUDIO', label: 'Tone Studio', icon: Sliders },
              { id: 'CHAT_MONITOR', label: 'Concierge Chat', icon: MessageSquare },
              { id: 'CARTS', label: 'Carts & Suppression', icon: ShoppingBag },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id as TabType)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Quick Actions & Command Palette Trigger */}
          <div className="flex items-center gap-2">
            {/* Command Palette Button */}
            <button
              onClick={() => {
                soundFx.playMechanicalClick();
                setCommandPaletteOpen(true);
              }}
              className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-xl text-xs font-medium transition shadow-sm"
              title="Open Command Palette (Cmd+K)"
            >
              <Command className="w-3.5 h-3.5 text-zinc-400" />
              <span>Search</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 bg-zinc-800 rounded border border-zinc-700">
                ⌘K
              </kbd>
            </button>

            {/* Sound Toggle */}
            <button
              onClick={toggleAudioFeedback}
              title={soundActive ? 'Mute mechanical UI clicks' : 'Enable mechanical UI clicks'}
              className="p-2 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg transition"
            >
              {soundActive ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-zinc-500" />}
            </button>

            {/* Quick Refresh */}
            <button
              onClick={() => {
                soundFx.playMechanicalClick();
                fetchData();
              }}
              title="Refresh Data"
              className="p-2 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="md:hidden flex items-center overflow-x-auto px-4 py-2 border-t border-zinc-800/60 bg-zinc-950 gap-1 text-xs">
          {[
            { id: 'STREAM', label: 'Live Stream' },
            { id: 'ANALYTICS', label: 'Analytics' },
            { id: 'TONE_STUDIO', label: 'Tone Studio' },
            { id: 'CHAT_MONITOR', label: 'Concierge' },
            { id: 'CARTS', label: 'Carts' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id as TabType)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap ${
                activeTab === tab.id ? 'bg-indigo-600 text-white' : 'text-zinc-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && !data ? (
          <div className="py-24 text-center space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-500" />
            <div className="text-zinc-400 text-sm font-medium">Connecting to RecoverFlow AI Pipeline...</div>
          </div>
        ) : (
          <>
            {activeTab === 'STREAM' && (
              <LiveRecoveryStream
                carts={data?.carts || []}
                stats={data?.stats}
                onRefresh={fetchData}
              />
            )}

            {activeTab === 'ANALYTICS' && (
              <ConversionAnalytics stats={data?.stats} onExportReport={handleExportCFOReport} />
            )}

            {activeTab === 'TONE_STUDIO' && data?.merchant && (
              <BrandToneCalibrationStudio
                merchant={data.merchant}
                onUpdateMerchant={handleUpdateMerchant}
              />
            )}

            {activeTab === 'CHAT_MONITOR' && (
              <LiveChatMonitor
                carts={data?.carts || []}
                messages={data?.messages || []}
              />
            )}

            {activeTab === 'CARTS' && (
              <CartsExplorer
                carts={data?.carts || []}
                suppressions={data?.suppressions || []}
                onRefresh={fetchData}
              />
            )}
          </>
        )}
      </main>

      {/* Universal Command Palette Modal */}
      <CommandPaletteModal
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        carts={data?.carts || []}
        onSelectTab={handleTabChange}
        onSimulate={handleSimulateAbandonment}
        onExportReport={handleExportCFOReport}
      />
    </div>
  );
}
