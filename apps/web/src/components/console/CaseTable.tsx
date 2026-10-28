'use client';

import Link from 'next/link';
import { ArrowUpRight, ChevronLeft, ChevronRight, Filter, RefreshCw, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, useWorkspace } from './WorkspaceProvider';
import { Empty, PageTitle, SourceNote, Status } from './ui';
import { formatMoney, type ConsoleCase } from '@/lib/console-types';

export function CaseRows({ cases }: { cases: ConsoleCase[] }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-xs">
        <thead className="border-b border-slate-800 bg-slate-900/60 text-[10px] uppercase tracking-wider text-slate-400">
          <tr>
            <th scope="col" className="px-5 py-3.5 font-medium">Case & Customer</th>
            <th scope="col" className="px-5 py-3.5 font-medium">Status</th>
            <th scope="col" className="px-5 py-3.5 font-medium">Amount</th>
            <th scope="col" className="px-5 py-3.5 font-medium">Expected Recovery</th>
            <th scope="col" className="px-5 py-3.5 font-medium">Attempts</th>
            <th scope="col" className="px-5 py-3.5 text-right font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {cases.map((item) => {
            const displayId = item.id.replace('rc_cart_evt_', 'CASE-');
            const probabilityPercent = (item.probabilityBps / 100).toFixed(1);
            const customerInitial = item.customer.charAt(0).toUpperCase() || 'C';

            return (
              <tr
                key={item.id}
                className="group transition-colors hover:bg-slate-800/40"
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      aria-hidden="true"
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-xs font-semibold text-emerald-400"
                    >
                      {customerInitial}
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/recovery/cases/${encodeURIComponent(item.id)}`}
                        className="font-mono text-xs font-semibold text-slate-200 transition-colors group-hover:text-emerald-400"
                      >
                        {displayId}
                      </Link>
                      <p className="truncate text-[11px] text-slate-400">{item.customer}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <Status value={item.status} />
                </td>
                <td className="px-5 py-4 font-mono tabular-nums text-slate-200">
                  <span className="text-sm font-semibold">{formatMoney(item.amountMinor, item.currency)}</span>
                  <span className="ml-1.5 text-[10px] text-slate-400">{item.currency}</span>
                </td>
                <td className="px-5 py-4">
                  <div className="font-mono text-xs font-semibold tabular-nums text-slate-300">
                    {formatMoney(item.expectedValueMinor, item.currency)}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-emerald-400 transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, item.probabilityBps / 100))}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400">{probabilityPercent}% model est.</span>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className="font-mono text-xs tabular-nums">
                      {item.attempts} / {item.maxAttempts}
                    </span>
                    {item.attempts >= item.maxAttempts && (
                      <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-rose-300">
                        Max
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4 text-right">
                  <Link
                    aria-label={`Inspect case ${item.id}`}
                    href={`/recovery/cases/${encodeURIComponent(item.id)}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/40 text-slate-400 transition hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-300"
                  >
                    <ArrowUpRight size={15} />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
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
      setBusy(true);
      setError('');
      const query = new URLSearchParams({
        search,
        status,
        sort,
        page: String(page),
        active: String(queue),
      });

      api<{ items: ConsoleCase[]; total: number; page: number }>(`/api/console/cases?${query}`, {
        signal: controller.signal,
      })
        .then(setResult)
        .catch((err) => {
          if (!controller.signal.aborted) setError((err as Error).message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setBusy(false);
        });
    }, search ? 200 : 0);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, status, sort, page, queue, retry, data.generatedAt]);

  const total = result?.total || 0;
  const pageCount = Math.ceil(total / 10);
  const canExport = ['OWNER', 'ADMIN', 'RECOVERY_MANAGER', 'ANALYST'].includes(data.session.role);

  return (
    <div className="space-y-6">
      <PageTitle
        eyebrow="RECOVERY OPERATIONS"
        title={queue ? 'Recovery queue' : 'All recovery cases'}
        description={
          queue
            ? 'Active abandoned checkout opportunities under automated recovery diagnostics and dispatch.'
            : 'A cryptographic and auditable record of recovery activity, from checkout detection through resolution.'
        }
        action={
          canExport ? (
            <a href="/api/console/export" className="rf-button-secondary">
              Export CSV
              <ArrowUpRight size={15} />
            </a>
          ) : undefined
        }
      />

      <SourceNote source={data.source} />

      <div className="rf-panel overflow-hidden">
        {/* Filter and Search Bar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-900/40 p-4">
          <div className="relative min-w-56 flex-1">
            <Search size={15} className="absolute left-3.5 top-3.5 text-slate-400" />
            <input
              aria-label="Search cases"
              maxLength={150}
              className="rf-input pl-10 pr-9 text-xs"
              placeholder="Search by case ID, payment, or customer..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setSearch('');
                  setPage(0);
                }}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-200"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex items-center">
              <Filter size={13} className="pointer-events-none absolute left-3 text-slate-400" />
              <select
                aria-label="Filter case status"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(0);
                }}
                className="rf-input w-auto pl-8 text-xs"
              >
                <option value="all">All statuses</option>
                {[
                  'DETECTED',
                  'DIAGNOSED',
                  'ELIGIBILITY_CHECKED',
                  'APPROVAL_REQUIRED',
                  'SCHEDULED',
                  'EXECUTING',
                  'OUTCOME_OBSERVED',
                  'RECOVERED',
                  'RETRY_SCHEDULED',
                  'STOPPED',
                ].map((entry) => (
                  <option key={entry} value={entry}>
                    {entry.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <select
              aria-label="Sort cases"
              className="rf-input w-auto text-xs"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(0);
              }}
            >
              <option value="recent">Newest first</option>
              <option value="value">Highest expected value</option>
            </select>
          </div>
        </div>

        {/* Content Table / States */}
        <div aria-busy={busy}>
          {busy ? (
            <div role="status" className="flex items-center justify-center p-14 text-sm text-slate-400">
              <RefreshCw size={16} className="mr-2 animate-spin text-emerald-400" />
              <span>Querying cases...</span>
            </div>
          ) : error ? (
            <div className="p-10 text-center">
              <p role="alert" className="mb-4 text-sm text-rose-300">
                {error}
              </p>
              <button className="rf-button-secondary" onClick={() => setRetry((r) => r + 1)}>
                Retry query
              </button>
            </div>
          ) : result?.items.length ? (
            <CaseRows cases={result.items} />
          ) : (
            <Empty
              title="No matching cases"
              description="No recovery records match the specified filters. New cart checkout events appear as they are ingested."
            />
          )}
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 bg-slate-900/30 px-5 py-3.5 text-xs text-slate-400">
          <div>
            {total > 0 ? (
              <span>
                Showing <strong className="font-semibold text-slate-200">{page * 10 + 1}</strong> to{' '}
                <strong className="font-semibold text-slate-200">{Math.min(page * 10 + 10, total)}</strong> of{' '}
                <strong className="font-semibold text-slate-200">{total}</strong> cases
              </span>
            ) : (
              <span>0 cases</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-400">
              Page <strong className="text-slate-200">{page + 1}</strong> of{' '}
              <strong className="text-slate-200">{pageCount || 1}</strong>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Previous page"
                className="rf-button-secondary h-8 px-2.5"
                disabled={busy || page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                aria-label="Next page"
                className="rf-button-secondary h-8 px-2.5"
                disabled={busy || page + 1 >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-slate-400">
        Expected values are Bayesian-calibrated heuristic estimates and strictly do not represent realized revenue.
        Sorting by expected value groups records by ISO currency code. CSV exports are limited to the 500 most recent records per export request.
      </p>
    </div>
  );
}
