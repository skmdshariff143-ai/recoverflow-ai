/**
 * PayBack AI — Global Command Palette (Cmd/Ctrl+K).
 *
 * Fuzzy-search overlay: jump to any payment, navigate tabs,
 * or trigger key actions. Fully keyboard-operable.
 */

'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search,
  ArrowRight,
  Activity,
  Zap,
  FlaskConical,
  HandCoins,
  FileSpreadsheet,
  BookOpen,
  RotateCcw,
  ShieldCheck,
  Award,
  CreditCard,
  Command,
  X,
} from 'lucide-react';
import { filterCommands, type CommandItem } from '@/lib/utils/fuzzyMatch';
import type { ExecutedItem, DashboardTab } from '@/types/pipeline';

// ── Tab icon map ──────────────────────────────────────────────────

const TAB_ICONS: Record<string, React.ReactNode> = {
  dashboard: <Activity className="w-4 h-4 text-indigo-400" />,
  live_runner: <Zap className="w-4 h-4 text-amber-400" />,
  evaluation_lab: <FlaskConical className="w-4 h-4 text-emerald-400" />,
  promise_to_pay: <HandCoins className="w-4 h-4 text-purple-400" />,
  audit_ledger: <FileSpreadsheet className="w-4 h-4 text-cyan-400" />,
  methodology_guide: <BookOpen className="w-4 h-4 text-amber-400" />,
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  payment: <CreditCard className="w-4 h-4 text-slate-400" />,
  navigation: <ArrowRight className="w-4 h-4 text-indigo-400" />,
  action: <Command className="w-4 h-4 text-emerald-400" />,
};

// ── Static commands ───────────────────────────────────────────────

const NAVIGATION_COMMANDS: CommandItem[] = [
  { id: 'nav-dashboard', label: 'Command Center & Queue', keywords: ['dashboard', 'queue', 'command center', 'home', 'kpi'], category: 'navigation' },
  { id: 'nav-live_runner', label: 'Live Recovery Runner', keywords: ['live', 'runner', 'execute', 'dispatch'], category: 'navigation' },
  { id: 'nav-evaluation_lab', label: 'Evaluation Lab & Simulator', keywords: ['evaluation', 'lab', 'simulator', 'counterfactual', 'policy'], category: 'navigation' },
  { id: 'nav-promise_to_pay', label: 'Promise-to-Pay Tracker', keywords: ['promise', 'pay', 'commitment', 'lifecycle'], category: 'navigation' },
  { id: 'nav-audit_ledger', label: 'Audit Trail & Ledger', keywords: ['audit', 'ledger', 'hash', 'sha256', 'trail'], category: 'navigation' },
  { id: 'nav-methodology_guide', label: 'Methodology & Guide', keywords: ['methodology', 'guide', 'architecture', 'post-mortem'], category: 'navigation' },
];

const ACTION_COMMANDS: CommandItem[] = [
  { id: 'act-reset-demo', label: 'Reset Demo State (Clean Slate · Shift+R)', keywords: ['reset', 'demo', 'state', 'clean', 'slate', 'defaults', 'restart', 'clear'], category: 'action' },
  { id: 'act-guide-tour', label: 'Guide Me (Self-Playing Proof Tour)', keywords: ['guide', 'tour', 'me', 'autoplay', 'walkthrough', 'presentation'], category: 'action' },
  { id: 'act-resimulate', label: 'Re-Simulate Batch', keywords: ['resimulate', 'batch', 'seed', 'rerun'], category: 'action' },
  { id: 'act-verify-ledger', label: 'Verify Ledger Integrity', keywords: ['verify', 'ledger', 'integrity', 'hash', 'sha256'], category: 'action' },
  { id: 'act-replay-arena', label: 'Blind-Bot vs PayBack AI Replay Arena', keywords: ['replay', 'arena', 'blind', 'bot', 'versus', 'side-by-side', 'comparison'], category: 'action' },
  { id: 'act-judge-mode', label: 'Toggle Judge Mode', keywords: ['judge', 'mode', 'evaluator', 'walkthrough'], category: 'action' },
  { id: 'act-judge-cheat-sheet', label: 'Judge Cheat Sheet (Printable Summary)', keywords: ['cheat', 'sheet', 'print', 'pdf', 'qr', 'script', 'summary'], category: 'action' },
];

// ── Props ─────────────────────────────────────────────────────────

interface CommandPaletteProps {
  /** All executed items for payment search. */
  items: ExecutedItem[];
  /** Navigate to a specific tab. */
  onNavigateTab: (tab: DashboardTab) => void;
  /** Open a payment's drill-down. */
  onSelectPayment: (paymentId: string) => void;
  /** Trigger batch re-simulation. */
  onReSimulate: () => void;
  /** Open Audit Ledger and trigger verification. */
  onVerifyLedger: () => void;
  /** Open Judge Mode modal. */
  onOpenJudgeMode: () => void;
  /** Open Blind-Bot Replay Arena. */
  onOpenReplayArena?: () => void;
  /** Open Judge Cheat Sheet. */
  onOpenCheatSheet?: () => void;
  /** Open Self-Playing Guide Tour. */
  onOpenGuideTour?: () => void;
  /** Reset all session-based demo state back to defaults. */
  onResetDemoState?: () => void;
}

export function CommandPalette({
  items,
  onNavigateTab,
  onSelectPayment,
  onReSimulate,
  onVerifyLedger,
  onOpenJudgeMode,
  onOpenReplayArena,
  onOpenCheatSheet,
  onOpenGuideTour,
  onResetDemoState,
}: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build payment commands from executed items
  const paymentCommands: CommandItem[] = useMemo(
    () =>
      items.map((item) => ({
        id: `pay-${item.payment.payment_id}`,
        label: item.payment.payment_id,
        keywords: [
          item.payment.payment_id,
          item.payment.customer_id,
          item.payment.failure_category,
          item.payment.raw_gateway_error,
        ],
        category: 'payment' as const,
      })),
    [items],
  );

  // Combine all commands
  const allCommands = useMemo(
    () => [...NAVIGATION_COMMANDS, ...ACTION_COMMANDS, ...paymentCommands],
    [paymentCommands],
  );

  // Filter results
  const filteredResults = useMemo(
    () => filterCommands(allCommands, query),
    [allCommands, query],
  );

  // Cap visible results
  const visibleResults = filteredResults.slice(0, 20);

  // Query change handler — resets selection index inline
  const handleQueryChange = useCallback((newQuery: string) => {
    setQuery(newQuery);
    setSelectedIndex(0);
  }, []);

  // Toggle palette open/close, resetting state on open
  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) {
        // Opening: reset query and selection
        setQuery('');
        setSelectedIndex(0);
      }
      return !prev;
    });
  }, []);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.querySelector('[data-selected="true"]');
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Global keyboard shortcut: Cmd/Ctrl+K and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        toggleOpen();
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleOpen, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  // Execute the selected command
  const executeCommand = useCallback(
    (item: CommandItem) => {
      setIsOpen(false);

      if (item.category === 'navigation') {
        const tab = item.id.replace('nav-', '') as DashboardTab;
        onNavigateTab(tab);
      } else if (item.category === 'payment') {
        const paymentId = item.id.replace('pay-', '');
        onNavigateTab('dashboard');
        // Slight delay so the tab renders first
        requestAnimationFrame(() => onSelectPayment(paymentId));
      } else if (item.id === 'act-reset-demo') {
        onResetDemoState?.();
      } else if (item.id === 'act-guide-tour') {
        onOpenGuideTour?.();
      } else if (item.id === 'act-resimulate') {
        onReSimulate();
      } else if (item.id === 'act-verify-ledger') {
        onVerifyLedger();
      } else if (item.id === 'act-replay-arena') {
        onOpenReplayArena?.();
      } else if (item.id === 'act-judge-mode') {
        onOpenJudgeMode();
      } else if (item.id === 'act-judge-cheat-sheet') {
        onOpenCheatSheet?.();
      }
    },
    [onNavigateTab, onSelectPayment, onReSimulate, onVerifyLedger, onOpenJudgeMode, onOpenReplayArena, onOpenCheatSheet, onOpenGuideTour, onResetDemoState],
  );

  // Keyboard navigation within the palette
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, visibleResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (visibleResults[selectedIndex]) {
          executeCommand(visibleResults[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
      }
    },
    [visibleResults, selectedIndex, executeCommand],
  );

  if (!isOpen) return null;

  // Group results by category for visual separation
  const groupedResults: Record<string, typeof visibleResults> = {};
  for (const item of visibleResults) {
    if (!groupedResults[item.category]) groupedResults[item.category] = [];
    groupedResults[item.category].push(item);
  }

  const categoryOrder: Array<CommandItem['category']> = ['navigation', 'action', 'payment'];
  const categoryLabels: Record<string, string> = {
    navigation: 'Navigation',
    action: 'Actions',
    payment: 'Payments',
  };

  // Compute global index for each item across groups
  let globalIndex = 0;
  const indexedGroups: Array<{
    category: string;
    label: string;
    items: Array<(typeof visibleResults)[number] & { globalIdx: number }>;
  }> = [];

  for (const cat of categoryOrder) {
    const catItems = groupedResults[cat];
    if (!catItems || catItems.length === 0) continue;
    const indexed = catItems.map((item) => ({ ...item, globalIdx: globalIndex++ }));
    indexedGroups.push({ category: cat, label: categoryLabels[cat], items: indexed });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={() => setIsOpen(false)}
        data-testid="command-palette-backdrop"
      />

      {/* Palette */}
      <div
        className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-xl z-50"
        role="dialog"
        aria-label="Command Palette"
        data-testid="command-palette"
      >
        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/60">
            <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search payments, navigate, or trigger actions…"
              className="flex-1 bg-transparent text-white text-sm placeholder:text-slate-500 focus:outline-none"
              data-testid="command-palette-input"
              autoComplete="off"
              spellCheck={false}
            />
            <kbd className="hidden sm:flex items-center gap-1 text-[10px] text-slate-500 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded font-mono">
              ESC
            </kbd>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-500 hover:text-white transition sm:hidden"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Results List */}
          <div ref={listRef} className="max-h-72 overflow-y-auto py-1" data-testid="command-palette-results">
            {visibleResults.length === 0 && query.trim() !== '' && (
              <div className="px-4 py-6 text-center text-sm text-slate-500">
                No results for &ldquo;{query}&rdquo;
              </div>
            )}

            {indexedGroups.map((group) => (
              <div key={group.category}>
                <div className="px-4 pt-2.5 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {group.label}
                </div>
                {group.items.map((item) => {
                  const isSelected = item.globalIdx === selectedIndex;
                  const icon =
                    item.category === 'navigation'
                      ? TAB_ICONS[item.id.replace('nav-', '')] || CATEGORY_ICONS[item.category]
                      : item.id === 'act-resimulate'
                        ? <RotateCcw className="w-4 h-4 text-emerald-400" />
                        : item.id === 'act-verify-ledger'
                          ? <ShieldCheck className="w-4 h-4 text-cyan-400" />
                          : item.id === 'act-judge-mode'
                            ? <Award className="w-4 h-4 text-amber-400" />
                            : CATEGORY_ICONS[item.category];

                  return (
                    <button
                      key={item.id}
                      data-selected={isSelected ? 'true' : 'false'}
                      data-testid="command-palette-item"
                      onClick={() => executeCommand(item)}
                      onMouseEnter={() => setSelectedIndex(item.globalIdx)}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600/20 text-white'
                          : 'text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="flex-shrink-0">{icon}</span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {isSelected && (
                        <kbd className="text-[10px] text-slate-500 font-mono">↵</kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Footer hints */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-slate-700/60 text-[10px] text-slate-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="bg-slate-800 border border-slate-700 px-1 rounded font-mono">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="bg-slate-800 border border-slate-700 px-1 rounded font-mono">↵</kbd>
                select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="bg-slate-800 border border-slate-700 px-1 rounded font-mono">esc</kbd>
                close
              </span>
            </div>
            <span>{filteredResults.length} results</span>
          </div>
        </div>
      </div>
    </>
  );
}
