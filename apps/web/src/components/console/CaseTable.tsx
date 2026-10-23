'use client';
import Link from 'next/link';
import { ArrowUpRight, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, useWorkspace } from './WorkspaceProvider';
import { Empty, PageTitle, SourceNote, Status } from './ui';
import { formatMoney, type ConsoleCase } from '@/lib/console-types';

export function CaseRows({ cases }: { cases: ConsoleCase[] }) {
  return <div className="relative overflow-x-auto"><table className="w-full min-w-[650px] text-left text-xs"><thead className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400"><tr>{['Case / customer', 'Status', 'Amount', 'Expected value', 'Attempts', ''].map((title, i) => <th key={i} scope="col" className="px-5 py-3 font-medium">{title || <span className="sr-only">Open</span>}</th>)}</tr></thead><tbody className="divide-y divide-slate-800/70">{cases.map((item) => <tr key={item.id} className="transition-colors hover:bg-slate-800/35"><td className="px-5 py-4"><Link href={`/recovery/cases/${encodeURIComponent(item.id)}`} className="font-mono text-slate-200 hover:text-emerald-300">{item.id.replace('rc_cart_evt_', 'CASE-')}</Link><p className="mt-1 text-[11px] text-slate-400">{item.customer}</p></td><td className="px-5 py-4"><Status value={item.status}/></td><td className="px-5 py-4 font-mono tabular-nums text-slate-200">{formatMoney(item.amountMinor, item.currency)}<span className="ml-1 text-[9px] text-slate-400">{item.currency}</span></td><td className="px-5 py-4 font-mono text-slate-300">{formatMoney(item.expectedValueMinor, item.currency)}<p className="mt-1 font-sans text-[10px] text-slate-400">{(item.probabilityBps / 100).toFixed(1)}% model estimate</p></td><td className="px-5 py-4 text-slate-400">{item.attempts} / {item.maxAttempts}</td><td className="px-5 py-4"><Link aria-label={`View case ${item.id}`} href={`/recovery/cases/${encodeURIComponent(item.id)}`} className="inline-flex rounded p-2 text-slate-400 hover:text-emerald-300"><ArrowUpRight size={16}/></Link></td></tr>)}</tbody></table></div>;
}

export function CasesPage({ queue = false }: { queue?: boolean }) {
  const { data } = useWorkspace();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<{ items: ConsoleCase[]; total: number; page: number } | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setBusy(true); setError('');
      const query = new URLSearchParams({ search, status, sort, page: String(page), active: String(queue) });
      api<{ items: ConsoleCase[]; total: number; page: number }>(`/api/console/cases?${query}`, { signal: controller.signal })
        .then(setResult).catch((err) => { if (!controller.signal.aborted) setError((err as Error).message); })
        .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    }, search ? 200 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, status, sort, page, queue, retry, data.generatedAt]);
  const total = result?.total || 0;
  const pageCount = Math.ceil(total / 10);
  const canExport = ['OWNER', 'ADMIN', 'RECOVERY_MANAGER', 'ANALYST'].includes(data.session.role);
  return <div className="space-y-6"><PageTitle eyebrow="RECOVERY OPERATIONS" title={queue ? 'Recovery queue' : 'All recovery cases'} description={queue ? 'Focus on active opportunities and understand the next step for every case.' : 'A searchable record of recovery activity, from detection through resolution.'} action={canExport ? <a href="/api/console/export" className="rf-button-secondary">Export CSV<ArrowUpRight size={15}/></a> : undefined}/><SourceNote source={data.source}/>
    <div className="rf-panel overflow-hidden"><div className="flex flex-wrap gap-3 border-b border-slate-800 p-4"><div className="relative min-w-52 flex-1"><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input aria-label="Search cases" maxLength={150} className="rf-input pl-9" placeholder="Search case, payment, or customer…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }}/></div><select aria-label="Filter case status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }} className="rf-input w-auto"><option value="all">All statuses</option>{['DETECTED', 'DIAGNOSED', 'ELIGIBILITY_CHECKED', 'APPROVAL_REQUIRED', 'SCHEDULED', 'EXECUTING', 'OUTCOME_OBSERVED', 'RECOVERED', 'RETRY_SCHEDULED', 'STOPPED'].map((entry) => <option key={entry} value={entry}>{entry.replaceAll('_', ' ')}</option>)}</select><select aria-label="Sort cases" className="rf-input w-auto" value={sort} onChange={(event) => { setSort(event.target.value); setPage(0); }}><option value="recent">Newest first</option><option value="value">Expected value (by currency)</option></select></div>
    <div aria-busy={busy}>{busy ? <p role="status" className="p-12 text-center text-sm text-slate-400">Loading cases…</p> : error ? <div className="p-8 text-center"><p role="alert" className="mb-4 text-sm text-rose-300">{error}</p><button className="rf-button-secondary" onClick={() => setRetry(retry + 1)}>Try again</button></div> : result?.items.length ? <CaseRows cases={result.items}/> : <Empty title="No matching cases" description="Try a different search or status. New merchant records appear as they are ingested."/>}</div><div className="flex items-center justify-between border-t border-slate-800 px-5 py-4 text-xs text-slate-400"><span>{total ? page * 10 + 1 : 0}–{Math.min(page * 10 + 10, total)} of {total} cases</span><div className="flex items-center gap-2"><button aria-label="Previous page" className="rf-button-secondary px-2" disabled={busy || page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={15}/></button><span>{page + 1} / {pageCount || 1}</span><button aria-label="Next page" className="rf-button-secondary px-2" disabled={busy || page + 1 >= pageCount} onClick={() => setPage(page + 1)}><ChevronRight size={15}/></button></div></div></div><p className="text-xs text-slate-400">Search covers all merchant cases. Expected values are estimates; value sorting groups currencies separately. CSV exports include up to 500 newest cases.</p></div>;
}

