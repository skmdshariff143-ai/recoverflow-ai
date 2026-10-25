'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { ArrowUpRight, Check, ShieldCheck, X } from 'lucide-react';
import { api, useWorkspace } from './WorkspaceProvider';
import { PageTitle, SourceNote, Empty, Status } from './ui';
import { formatMoney, type ConsoleCase } from '@/lib/console-types';

export function Approvals() {
  const { data, refresh } = useWorkspace();
  const [selected, setSelected] = useState<ConsoleCase | null>(null);
  const [action, setAction] = useState<'approve' | 'reject'>('approve');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = data.cases.filter((entry) => entry.status === 'APPROVAL_REQUIRED').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const allowed = ['ADMIN', 'OWNER', 'RECOVERY_MANAGER'].includes(data.session.role);
  async function addSample() {
    setBusy(true);
    try { await api('/api/console/demo', { method: 'POST', body: '{}' }); await refresh(); setNotice('A new sample case is ready for two independent reviews.'); }
    catch (err) { setNotice((err as Error).message); }
    finally { setBusy(false); }
  }
  function open(record: ConsoleCase, decision: 'approve' | 'reject') { setSelected(record); setAction(decision); setReason(''); setError(''); dialog.current?.showModal(); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!selected) return;
    setBusy(true); setError('');
    try { const result = await api<{ status: string; approvals: number }>('/api/console/review', { method: 'POST', body: JSON.stringify({ caseId: selected.id, action, reason }) }); await refresh(); dialog.current?.close(); setNotice(action === 'reject' ? 'Review recorded. Recovery for this case is stopped.' : result.approvals >= 2 ? 'Both approvals recorded. The case is eligible for further policy checks; no payment was executed.' : 'First approval recorded. A different reviewer must co-sign this case.'); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6"><PageTitle eyebrow="HUMAN OVERSIGHT" title="Approval inbox" description="Review exceptional cases with two independent sign-offs and a recorded reason." action={data.source === 'DEMO' && allowed ? <button className="rf-button-secondary" disabled={busy} onClick={addSample}>Add demo case</button> : undefined}/><SourceNote source={data.source}/>{notice && <p role="status" className="rounded-xl border border-emerald-400/25 bg-emerald-400/5 p-4 text-sm text-emerald-200">{notice}</p>}{!allowed && <p className="rounded-lg border border-amber-400/20 p-4 text-sm text-amber-200">Your role can inspect these cases. An owner, admin, or recovery manager must record the decision.</p>}
  {pending.length ? <div className="space-y-4">{pending.map((entry) => <article key={entry.id} className="rf-panel flex flex-wrap items-center justify-between gap-5 p-6"><div><div className="flex flex-wrap items-center gap-3"><Link href={`/recovery/cases/${entry.id}`} className="text-sm font-semibold hover:text-emerald-300">{entry.id.replace('rc_cart_evt_', 'CASE-')}<ArrowUpRight size={13} className="ml-1 inline"/></Link><Status value={entry.status}/></div><p className="mt-3 text-sm text-slate-400">{entry.customer} · <span className="font-mono text-slate-200">{formatMoney(entry.amountMinor, entry.currency)}</span></p><p className="mt-2 text-xs text-slate-400">Approval authorizes further review. It does not mark revenue as recovered.</p></div><div className="flex gap-2"><button className="rf-button-secondary" disabled={!allowed} onClick={() => open(entry, 'reject')}><X size={14}/>Reject</button><button className="rf-button" disabled={!allowed} onClick={() => open(entry, 'approve')}><Check size={14}/>Review & approve</button></div></article>)}</div> : <Empty title="You’re all caught up" description="There are no pending approvals in the loaded cases." href="/recovery/cases" linkLabel="Browse recovery cases"/>}
  <dialog ref={dialog} aria-labelledby="review-title" onCancel={(event) => { if (busy) event.preventDefault(); }} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100"><form onSubmit={submit}><ShieldCheck className="text-emerald-400"/><h2 id="review-title" className="mt-4 text-xl font-semibold">{action === 'approve' ? 'Record your approval' : 'Reject this recovery'}</h2><p className="mt-2 text-sm text-slate-400">Signed as {data.session.name}. The same operator cannot co-sign twice.</p><label htmlFor="review-reason" className="mb-2 mt-5 block text-xs text-slate-300">Reason for this decision</label><textarea id="review-reason" className="rf-input h-28" value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} maxLength={1000} required placeholder="Explain why this case should proceed or stop…"/>{error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" disabled={busy} className="rf-button-secondary" onClick={() => dialog.current?.close()}>Cancel</button><button disabled={busy || reason.trim().length < 10} className="rf-button">{busy ? 'Recording…' : 'Confirm decision'}</button></div></form></dialog></div>;
}


