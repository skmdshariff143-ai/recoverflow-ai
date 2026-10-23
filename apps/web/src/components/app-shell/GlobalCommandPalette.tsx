'use client';
import { createElement, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, ArrowUpRight } from 'lucide-react';
import { navigation } from './AppSidebar';
export function GlobalCommandPalette({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const commands = navigation.flatMap((group) => group.items.map((item) => ({ ...item, group: group.group }))).filter((item) => `${item.label} ${item.href}`.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => { if (isOpen) dialog.current?.showModal(); else dialog.current?.close(); }, [isOpen]);
  function choose(href: string) { router.push(href); setQuery(''); setSelected(0); onClose(); }
  return <dialog ref={dialog} aria-label="Command palette" onCancel={onClose} className="m-auto w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 p-0 text-slate-100" onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); setSelected((current) => (current + 1) % Math.max(commands.length, 1)); } if (event.key === 'ArrowUp') { event.preventDefault(); setSelected((current) => (current + commands.length - 1) % Math.max(commands.length, 1)); } if (event.key === 'Enter' && event.target instanceof HTMLInputElement && commands[selected]) { event.preventDefault(); choose(commands[selected].href); } }}><div className="flex items-center gap-3 border-b border-slate-700 px-4 py-3"><Search size={18} className="text-slate-400"/><input aria-label="Search pages" autoFocus className="min-h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Search pages and workflows…" value={query} onChange={(event) => { setQuery(event.target.value); setSelected(0); }}/><button onClick={onClose} aria-label="Close command palette" className="rounded p-2 text-slate-400"><X size={17}/></button></div><div className="max-h-96 overflow-y-auto p-2">{commands.length ? commands.map((item, index) => <button key={item.href} onClick={() => choose(item.href)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left ${index === selected ? 'bg-emerald-400/10 text-emerald-300' : 'text-slate-300 hover:bg-slate-800'}`}>{createElement(item.icon, { size: 17 })}<div className="flex-1"><p className="text-sm">{item.label}</p><p className="mt-1 text-[9px] tracking-wider text-slate-400">{item.group}</p></div><ArrowUpRight size={15}/></button>) : <p className="p-8 text-center text-sm text-slate-400">No matching pages. Try “cases” or “policy”.</p>}</div><p className="border-t border-slate-800 px-4 py-3 text-[10px] text-slate-400">↑ ↓ Navigate · Enter to open · Escape to close</p></dialog>;
}

