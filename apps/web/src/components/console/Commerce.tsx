'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, useWorkspace } from './WorkspaceProvider';
import { Empty, PageTitle, SourceNote, Status } from './ui';
import { formatMoney } from '@/lib/console-types';

type CommerceData = {
  totalCarts: number;
  carts: { id: string; customer: string; status: string; stage: string; amountMinor: string | null; currency: string; items: { title: string; quantity: number }[]; updatedAt: string }[];
  experiments: { armId: string; strategyName: string; impressions: number; conversions: number; conversionRateBps: number }[];
};

export function CommercePage({ experiments = false }: { experiments?: boolean }) {
  const { data } = useWorkspace();
  const [records, setRecords] = useState<CommerceData | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api<CommerceData>('/api/console/commerce', { signal: controller.signal }).then((value) => { setRecords(value); setError(''); }).catch((err) => { if (!controller.signal.aborted) setError((err as Error).message); });
    return () => controller.abort();
  }, [retry]);
  const carts = records?.carts.filter((cart) => `${cart.id} ${cart.customer} ${cart.items.map((item) => item.title).join(' ')}`.toLowerCase().includes(query.toLowerCase())) || [];
  return <div className="space-y-6"><PageTitle eyebrow={experiments ? 'MEASUREMENT' : 'COMMERCE'} title={experiments ? 'Experiment observations' : 'Abandoned carts'} description={experiments ? 'Recorded exposures and conversions for strategy variants. These counts alone do not establish causal lift.' : 'Inspect the latest cart records and their recorded recovery stage.'}/><SourceNote source={data.source}/>
    {error ? <div className="rf-panel p-6"><p role="alert" className="mb-4 text-rose-300">{error}</p><button className="rf-button-secondary" onClick={() => setRetry(retry + 1)}>Try again</button></div> : !records ? <p role="status" className="text-sm text-slate-400">Loading records…</p> : experiments ? <>
      {records.experiments.length ? <div className="grid gap-4 md:grid-cols-2">{records.experiments.map((arm) => <article key={arm.armId} className="rf-panel p-6"><p className="text-xs text-emerald-300">{arm.armId}</p><h2 className="mt-2 text-lg font-semibold">{arm.strategyName}</h2><dl className="mt-6 grid grid-cols-3 gap-4">{[['Exposures', arm.impressions], ['Conversions', arm.conversions], ['Observed rate', `${(arm.conversionRateBps / 100).toFixed(1)}%`]].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-2 font-mono text-lg">{value}</dd></div>)}</dl></article>)}</div> : <Empty title="No experiment observations" description="Exposures and outcomes appear when an experiment is recorded for this merchant. No uplift is reported without supporting observations."/>}
      <div className="rf-panel p-6"><h2 className="font-semibold">Measure before making claims</h2><p className="mt-3 text-sm leading-relaxed text-slate-400">Use a predefined control group, stable assignment, sufficient sample size, and verified outcomes. Benchmark simulations remain separate from merchant observations.</p>{data.source === 'DEMO' && <Link href="/demo" className="rf-button-secondary mt-5">Explore frozen benchmark cohorts</Link>}</div>
    </> : <><input aria-label="Search carts" className="rf-input" placeholder="Search cart, customer, or item…" value={query} onChange={(event) => setQuery(event.target.value)}/><p className="text-xs text-slate-400">{carts.length} matching carts within the latest {records.carts.length} of {records.totalCarts} records.</p>
      {carts.length ? <div className="grid gap-4 lg:grid-cols-2">{carts.map((cart) => <article key={cart.id} className="rf-panel min-w-0 p-5"><div className="flex flex-wrap justify-between gap-3"><span className="break-all font-mono text-xs text-slate-400">{cart.id}</span><Status value={cart.status}/></div><h2 className="mt-4 text-sm font-semibold">{cart.customer}</h2><ul className="mt-3 space-y-2 text-sm text-slate-300">{cart.items.map((item, index) => <li key={index}>{item.quantity} × {item.title}</li>)}</ul><div className="mt-5 flex flex-wrap justify-between gap-3 border-t border-slate-800 pt-4"><span className="font-mono text-sm">{cart.amountMinor === null ? 'Total unavailable' : formatMoney(cart.amountMinor, cart.currency)}</span><span className="text-xs text-slate-400">{cart.stage.replaceAll('_', ' ')}</span></div><p className="mt-3 text-xs text-slate-400">Updated {new Date(cart.updatedAt).toLocaleString()}</p></article>)}</div> : <Empty title="No matching carts" description="Try a different search, or ingest cart records for this merchant."/>}</>}
  </div>;
}
