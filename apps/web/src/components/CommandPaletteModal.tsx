'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Zap, 
  TrendingUp, 
  Sliders, 
  MessageSquare, 
  ShoppingBag, 
  Volume2, 
  VolumeX, 
  Download, 
  Sparkles, 
  Command, 
  CornerDownLeft 
} from 'lucide-react';
import type { CartEvent } from '@recoverflow/core';
import { soundFx } from '../utils/soundEffects';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  carts: CartEvent[];
  onSelectTab: (tab: 'STREAM' | 'ANALYTICS' | 'TONE_STUDIO' | 'CHAT_MONITOR' | 'CARTS') => void;
  onSimulate: () => void;
  onExportReport: () => void;
}

export function CommandPaletteModal({
  isOpen,
  onClose,
  carts,
  onSelectTab,
  onSimulate,
  onExportReport,
}: CommandPaletteModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [soundActive, setSoundActive] = useState(soundFx.isEnabled());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const toggleAudio = () => {
    const next = soundFx.toggle();
    setSoundActive(next);
  };

  if (!isOpen) return null;

  // Build command list
  const navigationItems = [
    { id: 'tab_stream', category: 'Navigation', title: 'Live Recovery Stream', subtitle: 'View real-time event pipeline and active carts', icon: Zap, action: () => { onSelectTab('STREAM'); onClose(); } },
    { id: 'tab_analytics', category: 'Navigation', title: 'ROAS & Causal Lift Analytics', subtitle: '10% holdout group causal attribution & metrics', icon: TrendingUp, action: () => { onSelectTab('ANALYTICS'); onClose(); } },
    { id: 'tab_tone', category: 'Navigation', title: 'Brand Tone Studio', subtitle: 'Tune brand voice, urgency, and discount limits', icon: Sliders, action: () => { onSelectTab('TONE_STUDIO'); onClose(); } },
    { id: 'tab_chat', category: 'Navigation', title: 'Concierge Chat Monitor', subtitle: 'Inspect 2-way conversations & takeover chats', icon: MessageSquare, action: () => { onSelectTab('CHAT_MONITOR'); onClose(); } },
    { id: 'tab_carts', category: 'Navigation', title: 'Carts & Suppression List', subtitle: 'Manage cart tokens, opt-outs, and exports', icon: ShoppingBag, action: () => { onSelectTab('CARTS'); onClose(); } },
  ];

  const actionItems = [
    { id: 'act_sim', category: 'Actions', title: 'Simulate Cart Abandonment', subtitle: 'Trigger synthetic checkout drop-off event', icon: Sparkles, action: () => { onSimulate(); onClose(); } },
    { id: 'act_export', category: 'Actions', title: 'Export Causal Lift Report (CSV)', subtitle: 'Download executive CFO-ready CSV data sheet', icon: Download, action: () => { onExportReport(); onClose(); } },
    { id: 'act_sound', category: 'Actions', title: soundActive ? 'Disable UI Mechanical Sound' : 'Enable UI Mechanical Sound', subtitle: 'Toggle Web Audio synthesized audio clicks', icon: soundActive ? VolumeX : Volume2, action: toggleAudio },
  ];

  const cartItems = carts.slice(0, 8).map((c) => ({
    id: `cart_${c.id}`,
    category: 'Active Carts',
    title: `${c.customerName || 'Shopper'} — $${c.totalPrice.toFixed(2)}`,
    subtitle: `${c.cartToken} • ${c.abandonmentType} • ${c.recoveryStage}`,
    icon: ShoppingBag,
    action: () => {
      onSelectTab('STREAM');
      onClose();
    },
  }));

  const allItems = [...navigationItems, ...actionItems, ...cartItems];

  const filteredItems = allItems.filter((item) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
      soundFx.playMechanicalClick();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
      soundFx.playMechanicalClick();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredItems[selectedIndex];
      if (selected) {
        soundFx.playMechanicalClick();
        selected.action();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden text-zinc-100 flex flex-col font-sans"
        onKeyDown={handleKeyDown}
      >
        {/* Search Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center gap-3 bg-zinc-900/50">
          <Search className="w-5 h-5 text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command, search carts, or navigate (e.g. 'analytics', 'Sarah', 'export')..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-zinc-100 placeholder-zinc-500"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono font-semibold text-zinc-400 bg-zinc-800 rounded border border-zinc-700">
            ESC
          </kbd>
        </div>

        {/* Results Stream */}
        <div className="max-h-[380px] overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-500">
              No matching commands or carts found for &quot;{query}&quot;
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    soundFx.playMechanicalClick();
                    item.action();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all ${
                    isSelected
                      ? 'bg-zinc-800/90 text-white shadow-sm border border-zinc-700/80'
                      : 'text-zinc-300 hover:bg-zinc-900 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg ${isSelected ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-zinc-100 flex items-center gap-2">
                        <span>{item.title}</span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-500 border border-zinc-800">
                          {item.category}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="flex items-center gap-1 text-zinc-400 text-xs font-mono shrink-0 pl-2">
                      <CornerDownLeft className="w-3.5 h-3.5 text-zinc-400" />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Dismiss</span>
          </div>
          <div className="flex items-center gap-2">
            <Command className="w-3 h-3 text-zinc-600" />
            <span>RecoverFlow Universal Command Palette</span>
          </div>
        </div>
      </div>
    </div>
  );
}
