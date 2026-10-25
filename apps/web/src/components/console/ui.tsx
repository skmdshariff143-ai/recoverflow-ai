import Link from 'next/link';
import { ArrowUpRight, Inbox } from 'lucide-react';

export function PageTitle({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="flex flex-wrap items-end justify-between gap-4"><div className="min-w-0 max-w-full break-words">{eyebrow && <p className="mb-2 text-[11px] font-semibold uppercase tracking-[.18em] text-emerald-400">{eyebrow}</p>}<h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">{description}</p></div>{action}</div>;
}
export function Status({ value }: { value: string }) {
  const color = /RECOVERED|READY|APPROVED|DELIVERED|READ|VERIFIED/.test(value) ? 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20' : /APPROVAL|PENDING|QUEUED/.test(value) ? 'text-amber-300 bg-amber-400/10 border-amber-400/20' : /STOPPED|FAILED|UNAVAILABLE/.test(value) ? 'text-rose-300 bg-rose-400/10 border-rose-400/20' : 'text-slate-300 bg-slate-400/10 border-slate-400/20';
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1 text-[10px] font-semibold tracking-wide ${color}`}><span className="h-1 w-1 rounded-full bg-current"/>{value.replaceAll('_', ' ')}</span>;
}
export function Empty({ title = 'Nothing here yet', description, href, linkLabel }: { title?: string; description: string; href?: string; linkLabel?: string }) {
  return <div className="rf-panel flex flex-col items-center px-6 py-14 text-center"><Inbox className="mb-4 text-slate-400" size={30}/><h2 className="font-semibold text-slate-200">{title}</h2><p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">{description}</p>{href && <Link href={href} className="mt-5 inline-flex items-center gap-2 text-sm text-emerald-300">{linkLabel || 'Go to overview'}<ArrowUpRight size={15}/></Link>}</div>;
}
export function SourceNote({ source, count, total }: { source: string; count?: number; total?: number }) {
  return <p className="text-xs leading-relaxed text-slate-400"><span className="mr-2 rounded border border-slate-700 px-1.5 py-0.5 font-mono text-[10px]">{source}</span>{source === 'DEMO' ? 'Illustrative records. No real payments or messages.' : 'Recorded merchant data. Recovered status is not a claim of causal lift.'}{count !== undefined && total !== undefined && count < total && ` Showing ${count} of ${total} cases; summaries and exports cover this loaded set.`}</p>;
}

