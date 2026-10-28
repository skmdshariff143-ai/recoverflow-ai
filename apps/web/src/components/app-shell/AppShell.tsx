'use client';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { UserSession } from '../../../../../packages/core/src/auth';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { GlobalCommandPalette } from './GlobalCommandPalette';
import { WorkspaceProvider } from '../console/WorkspaceProvider';

export function AppShell({ children, session, hostedDemo = false }: { children: React.ReactNode; session: UserSession; hostedDemo?: boolean }) {
  const [palette, setPalette] = useState(false);
  const navigation = useRef<HTMLDialogElement>(null);
  const demo = session.runtimeMode === 'DEMO' || session.runtimeMode === 'TEST';
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPalette((value) => !value); } };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  return <div className="min-h-screen bg-[#080b10] font-sans text-slate-100 antialiased selection:bg-emerald-400/25">
    <a href="#workspace-content" className="sr-only z-50 rounded-lg bg-emerald-400 px-4 py-3 text-slate-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
    <div className="fixed inset-y-0 left-0 z-30 hidden xl:block"><AppSidebar demo={demo}/></div>
    <dialog ref={navigation} aria-label="Mobile navigation" className="fixed inset-y-0 left-0 m-0 h-dvh max-h-dvh overflow-hidden border-0 bg-[#080b10] p-0 text-slate-100"><button onClick={() => navigation.current?.close()} aria-label="Close navigation" className="absolute right-2 top-1 rounded p-2 text-slate-400"><X size={16}/></button><AppSidebar demo={demo} onNavigate={() => navigation.current?.close()}/></dialog>
    <div className="xl:pl-60"><AppHeader session={session} onOpenCommandPalette={() => setPalette(true)} onOpenNavigation={() => navigation.current?.showModal()}/>
      {demo && <div className="flex flex-wrap items-center justify-between gap-1 border-b border-violet-400/10 bg-violet-400/5 px-4 py-2 text-[11px] text-slate-400 md:px-8"><span><span className="mr-2 font-semibold text-violet-300">Demo workspace</span>Explore with illustrative data. No real payments or messages.</span><span className="hidden sm:inline">{hostedDemo ? 'Shared demo · changes persist across visits.' : 'Changes reset when the server restarts.'}</span></div>}
      <main id="workspace-content" tabIndex={-1} className="mx-auto max-w-[1500px] space-y-7 p-4 pb-12 md:p-8"><WorkspaceProvider>{children}</WorkspaceProvider></main>
    </div><GlobalCommandPalette isOpen={palette} onClose={() => setPalette(false)}/>
  </div>;
}

