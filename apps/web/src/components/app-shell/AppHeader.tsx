'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Menu, Search, Building2 } from 'lucide-react';
import type { UserSession } from '../../../../../packages/core/src/auth';
import { api } from '../console/WorkspaceProvider';

export function AppHeader({ session, onOpenCommandPalette, onOpenNavigation }: { session: UserSession; onOpenCommandPalette: () => void; onOpenNavigation: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const demo = session.runtimeMode === 'DEMO' || session.runtimeMode === 'TEST';
  async function changeRole(role: string) {
    setBusy(true);
    try { await api('/api/auth/session', { method: 'POST', body: JSON.stringify({ method: 'demo', role }) }); window.location.reload(); }
    catch (err) { setError((err as Error).message); setBusy(false); }
  }
  async function signOut() {
    setBusy(true);
    try { await api('/api/auth/session', { method: 'DELETE' }); router.replace('/login'); router.refresh(); }
    catch (err) { setError((err as Error).message); setBusy(false); }
  }
  return <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-[#080b10]/95 backdrop-blur-xl">
    <div className="flex h-20 items-center justify-between gap-3 px-4 md:px-8">
      <div className="flex min-w-0 items-center gap-3"><button onClick={onOpenNavigation} aria-label="Open navigation" className="rounded-lg p-2 text-slate-300 xl:hidden"><Menu size={20}/></button><Building2 className="hidden text-slate-400 sm:block" size={17}/><span className="hidden truncate text-xs text-slate-300 md:block">{demo ? 'Aurora workspace' : session.organizationSlug}</span><span className={`rounded border px-2 py-1 text-[9px] font-bold tracking-[.12em] ${demo ? 'border-violet-400/25 bg-violet-400/10 text-violet-300' : 'border-amber-400/25 bg-amber-400/10 text-amber-300'}`}>{session.runtimeMode}</span></div>
      <div className="flex items-center gap-2 md:gap-4"><button onClick={onOpenCommandPalette} aria-label="Search workspace" className="flex min-h-10 items-center gap-3 rounded-lg border border-slate-800 px-3 text-xs text-slate-400 hover:border-slate-600"><Search size={15}/><span className="hidden lg:inline">Search workspace</span><kbd className="hidden rounded bg-slate-800 px-1.5 py-0.5 text-[10px] md:inline">Ctrl K</kbd></button>{demo ? <select aria-label="Demo role" className="min-h-10 max-w-28 rounded-lg border border-slate-800 bg-slate-900 px-2 text-xs text-slate-300 sm:max-w-40" value={session.role} disabled={busy} onChange={(e) => changeRole(e.target.value)}><option value="ADMIN">Demo admin</option><option value="OWNER">Demo owner</option><option value="RECOVERY_MANAGER">Recovery manager</option><option value="ANALYST">Analyst</option><option value="VIEWER">Viewer</option></select> : <span className="text-xs text-slate-300">{session.role.replaceAll('_', ' ')}</span>}<button disabled={busy} onClick={signOut} aria-label="Sign out" title="Sign out" className="rounded-lg p-2 text-slate-400 hover:text-white"><LogOut size={17}/></button></div>
    </div>{error && <p role="alert" className="px-6 pb-3 text-xs text-rose-300">{error}</p>}
  </header>;
}


