'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import type { ConsoleSnapshot } from '@/lib/console-types';

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers }, cache: 'no-store' });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Unable to complete the request.');
  return body as T;
}
const WorkspaceContext = createContext<{ data: ConsoleSnapshot; refresh: () => Promise<void> } | null>(null);
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('WorkspaceProvider is required.');
  return context;
}
export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<ConsoleSnapshot | null>(null);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try { const next = await api<ConsoleSnapshot>('/api/console'); setData(next); setError(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to load workspace.'); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    api<ConsoleSnapshot>('/api/console', { signal: controller.signal }).then(setData).catch((err) => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, []);
  if (error) return <div role="alert" className="rf-panel p-8"><AlertCircle className="mb-4 text-amber-300" /><h1 className="text-xl font-semibold">Workspace unavailable</h1><p className="mt-2 text-slate-400">{error}</p><button className="rf-button mt-5" onClick={refresh}><RefreshCw size={15} />Try again</button></div>;
  if (!data) return <div role="status" aria-label="Loading workspace" className="space-y-6"><div className="h-10 w-64 animate-pulse rounded-lg bg-slate-800"/><div className="grid gap-4 sm:grid-cols-3">{[1, 2, 3].map((n) => <div key={n} className="h-36 animate-pulse rounded-xl bg-slate-900"/>)}</div><p className="text-sm text-slate-400">Loading your workspace…</p></div>;
  return <WorkspaceContext.Provider value={{ data, refresh }}>{children}</WorkspaceContext.Provider>;
}

