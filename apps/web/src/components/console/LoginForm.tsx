'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, LockKeyhole, Workflow, FlaskConical, LoaderCircle } from 'lucide-react';
import { api } from './WorkspaceProvider';

export function LoginForm({ mode }: { mode: string }) {
  const router = useRouter();
  const demo = mode === 'DEMO' || mode === 'TEST';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function signIn(body: object) {
    setBusy(true); setError('');
    try { await api('/api/auth/session', { method: 'POST', body: JSON.stringify(body) }); router.replace('/overview'); router.refresh(); }
    catch (err) { setError((err as Error).message); setBusy(false); }
  }
  return <main className="grid min-h-dvh bg-slate-950 lg:grid-cols-2">
    <div className="relative hidden flex-col justify-between overflow-hidden border-r border-slate-800 bg-[#080f1b] p-14 lg:flex"><Link href="/" className="flex items-center gap-3 font-semibold"><Workflow className="text-emerald-400"/>RecoverFlow AI</Link><div><p className="mb-6 text-xs font-semibold uppercase tracking-[.2em] text-emerald-400">EVERY RECOVERY HAS A REASON</p><h1 className="max-w-lg text-5xl font-semibold leading-tight tracking-tight">A clearer path<br/>from failed payment<br/>to recovered revenue.</h1><p className="mt-7 max-w-md text-base leading-relaxed text-slate-400">Prioritize the right cases. Keep your team in control. Understand every decision.</p><div className="mt-10 flex gap-3">{['Explainable', 'Accountable', 'Measurable'].map((label) => <span key={label} className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300">{label}</span>)}</div></div><p className="text-xs text-slate-400">Built for thoughtful recovery operations.</p></div>
    <div className="flex items-center justify-center p-6"><div className="w-full max-w-sm"><Link href="/" className="mb-12 flex items-center gap-2 font-semibold lg:hidden"><Workflow className="text-emerald-400"/>RecoverFlow AI</Link><span className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300"><LockKeyhole size={14}/>{mode} environment</span><h2 className="mt-6 text-3xl font-semibold tracking-tight">Welcome to your workspace</h2><p className="mt-3 text-sm leading-relaxed text-slate-400">{demo ? 'Explore the complete console with a demo identity and sample merchant data.' : 'Sign in with the operator credentials provisioned by your workspace administrator.'}</p>
    {error && <p role="alert" className="mt-5 rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-300">{error}</p>}
    {demo ? <div className="mt-8 space-y-4"><button className="rf-button w-full" disabled={busy} onClick={() => signIn({ method: 'demo', role: 'ADMIN' })}>{busy ? <LoaderCircle size={16} className="animate-spin"/> : <FlaskConical size={16}/>}Open demo workspace<ArrowRight size={16}/></button><p className="text-center text-xs leading-relaxed text-slate-400">No credentials required. Demo roles are available inside the console. External provider actions are disabled.</p><Link href="/demo" className="block pt-4 text-center text-sm text-slate-300 hover:text-emerald-300">Explore the benchmark lab →</Link></div> : <form className="mt-8 space-y-5" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); signIn({ method: 'password', email: form.get('email'), password: form.get('password'), organization: form.get('organization') }); }}><div><label htmlFor="workspace" className="mb-2 block text-xs font-medium text-slate-300">Workspace slug</label><input id="workspace" name="organization" autoComplete="organization" placeholder="your-company" className="rf-input" required maxLength={100}/></div><div><label htmlFor="email" className="mb-2 block text-xs font-medium text-slate-300">Work email</label><input id="email" name="email" type="email" autoComplete="username" className="rf-input" required maxLength={254}/></div><div><label htmlFor="password" className="mb-2 block text-xs font-medium text-slate-300">Password</label><input id="password" name="password" type="password" autoComplete="current-password" className="rf-input" required maxLength={256}/></div><button disabled={busy} className="rf-button w-full">{busy ? 'Signing in…' : 'Sign in'}<ArrowRight size={16}/></button><p className="text-xs leading-relaxed text-slate-400">Need access? Ask your administrator to provision your account. Demo identities cannot sign in here.</p></form>}
    <div className="mt-10 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400"><span>Sessions expire after 8 hours.</span><div className="flex items-center gap-4"><Link href="/" className="text-slate-300 hover:underline">Home</Link><Link href="/privacy" className="text-slate-300 hover:underline">Privacy</Link><Link href="/terms" className="text-slate-300 hover:underline">Terms</Link></div></div></div></div>
  </main>;
}


