'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  Wallet,
  CircleDollarSign,
  Target,
  FileCheck2,
  RefreshCw,
  Activity,
  Sliders,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useWorkspace } from './WorkspaceProvider';
import { PageTitle, SourceNote } from './ui';
import { CaseRows } from './CaseTable';
import { formatMoney } from '@/lib/console-types';

export function Overview({ analytics = false }: { analytics?: boolean }) {
  const { data, refresh } = useWorkspace();
  const [currency, setCurrency] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const selected = data.currencies.find((entry) => entry.currency === currency) || data.currencies[0];
  const code = selected?.currency || 'USD';
  const cases = data.cases.filter((entry) => entry.currency === code);
  const approvals = data.cases.filter((entry) => entry.status === 'APPROVAL_REQUIRED').length;

  const recoveryRate = selected?.total ? ((100 * selected.recoveredCount) / selected.total).toFixed(1) : '0.0';

  const metrics = [
    {
      id: 'recovered',
      label: 'Recovered Revenue',
      value: formatMoney(selected?.recovered || '0', code),
      icon: CircleDollarSign,
      note: `${selected?.recoveredCount || 0} cases successfully settled`,
      highlight: true,
      badge: 'Attributed Yield',
    },
    {
      id: 'at_risk',
      label: 'Revenue at Risk',
      value: formatMoney(selected?.atRisk || '0', code),
      icon: Wallet,
      note: 'Active open checkout & payment failures',
      highlight: false,
      badge: 'Unsettled Pipeline',
    },
    {
      id: 'recovery_rate',
      label: 'Pipeline Recovery Rate',
      value: `${recoveryRate}%`,
      icon: Target,
      note: `${selected?.recoveredCount || 0} / ${selected?.total || 0} cohort cases · ${code}`,
      highlight: false,
      badge: 'Conversion Rate',
    },
    {
      id: 'approvals',
      label: 'Dual-Review Pending',
      value: String(approvals).padStart(2, '0'),
      icon: FileCheck2,
      note: approvals > 0 ? 'Requires independent human co-signature' : 'All high-value cases reviewed',
      highlight: approvals > 0,
      badge: approvals > 0 ? 'Action Required' : 'Cleared',
    },
  ];

  const dayKeys = Array.from({ length: 14 }, (_, i) =>
    new Date(new Date(data.generatedAt).getTime() - (13 - i) * 86400000).toISOString().slice(0, 10)
  );

  const activity = dayKeys.map((day) => ({
    day,
    formattedDay: new Date(day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    all: cases.filter((entry) => entry.createdAt.startsWith(day)).length,
    recovered: cases.filter((entry) => entry.status === 'RECOVERED' && entry.updatedAt.startsWith(day)).length,
  }));

  const max = Math.max(1, ...activity.flatMap((day) => [day.all, day.recovered]));
  const activeCases = data.cases.filter((entry) => !['RECOVERED', 'STOPPED'].includes(entry.status));

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <PageTitle
        eyebrow={analytics ? 'PORTFOLIO ANALYTICS' : 'REVENUE RECOVERY OPERATIONS'}
        title={analytics ? 'Attributable Recovery Analytics' : `Control Console — ${data.merchant.name}`}
        description={
          analytics
            ? 'Deterministic performance metrics segregated by origin currency with continuous Merkle audit trails.'
            : 'Live monitoring, automated cadence timers, and policy guardrails behind every checkout decision.'
        }
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              aria-label="Display currency"
              className="rf-input w-auto font-mono text-xs font-medium"
              value={code}
              onChange={(event) => setCurrency(event.target.value)}
            >
              {data.currencies.length ? (
                data.currencies.map((entry) => <option key={entry.currency}>{entry.currency}</option>)
              ) : (
                <option>USD</option>
              )}
            </select>
            <button
              aria-label="Refresh workspace"
              disabled={refreshing}
              className="rf-button-secondary px-3"
              onClick={async () => {
                setRefreshing(true);
                await refresh();
                setRefreshing(false);
              }}
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <Link href="/recovery/queue" className="rf-button">
              <span>Open Queue</span>
              <ArrowUpRight size={15} />
            </Link>
          </div>
        }
      />

      <SourceNote source={data.source} count={data.cases.length} total={data.totalCases} />

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.id}
            className={`rf-panel relative overflow-hidden p-5 transition-all ${
              metric.highlight
                ? 'border-emerald-500/30 bg-[#0F172A]/90 shadow-[0_0_25px_rgba(16,185,129,0.08)]'
                : 'border-slate-800 bg-[#0F172A]/75'
            }`}
          >
            <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
              <span className="font-medium">{metric.label}</span>
              <div
                className={`rounded-lg p-2 ${
                  metric.highlight ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800/80 text-slate-400'
                }`}
              >
                <metric.icon size={16} />
              </div>
            </div>

            <div className="mt-4 flex items-baseline justify-between">
              <p
                className={`font-mono text-2xl font-bold tracking-tight tabular-nums sm:text-3xl ${
                  metric.highlight ? 'text-emerald-400' : 'text-slate-100'
                }`}
              >
                {metric.value}
              </p>
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                  metric.highlight
                    ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border border-slate-700 bg-slate-800/60 text-slate-300'
                }`}
              >
                {metric.badge}
              </span>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">{metric.note}</p>
          </div>
        ))}
      </div>

      {/* Primary Analytics & Policy Split View */}
      <div className="grid gap-6 lg:grid-cols-[1.75fr_1fr]">
        {/* 14-Day Activity Bar Visualizer */}
        <section className="rf-panel p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Activity size={17} className="text-emerald-400" />
                <h2 className="text-sm font-semibold tracking-tight text-slate-100">Recovery Cohort Velocity</h2>
              </div>
              <p className="mt-1 text-xs text-slate-400">14-day daily ingestion vs settled recovery volume (UTC)</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span className="h-2 w-2 rounded-sm bg-slate-600" />
                Detected Failures
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                <span className="h-2 w-2 rounded-sm bg-emerald-500" />
                Recovered
              </span>
              <span className="rounded-md border border-slate-700 bg-slate-800/80 px-2 py-0.5 font-mono text-[10px] text-slate-300">
                {code}
              </span>
            </div>
          </div>

          {/* Bar Chart Container */}
          <div
            role="img"
            aria-label={`Activity timeline: ${activity.reduce((sum, d) => sum + d.all, 0)} detected cases and ${activity.reduce(
              (sum, d) => sum + d.recovered,
              0
            )} recovered over past 14 days`}
            className="mt-8 flex h-48 items-end justify-between gap-1.5 border-b border-slate-800/90 pb-2"
          >
            {activity.map((d) => (
              <div
                key={d.day}
                title={`${d.day}: ${d.all} detected, ${d.recovered} recovered`}
                className="group flex h-full flex-1 flex-col items-center justify-end gap-1"
              >
                <div className="flex h-full w-full items-end justify-center gap-1">
                  <div
                    className="w-full max-w-[12px] rounded-t-sm bg-slate-700/80 transition-all group-hover:bg-slate-600"
                    style={{ height: `${Math.max(4, (d.all / max) * 92)}%` }}
                  />
                  <div
                    className="w-full max-w-[12px] rounded-t-sm bg-emerald-500 transition-all group-hover:bg-emerald-400"
                    style={{ height: `${Math.max(4, (d.recovered / max) * 92)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Chart Axis Labels */}
          <div className="mt-3 flex justify-between text-[10px] font-mono text-slate-400">
            <span>{activity[0]?.formattedDay}</span>
            <span>{activity[Math.floor(activity.length / 2)]?.formattedDay}</span>
            <span>{activity[activity.length - 1]?.formattedDay}</span>
          </div>

          <details className="mt-4 text-xs text-slate-400">
            <summary className="cursor-pointer select-none text-slate-400 hover:text-slate-200">
              Show detailed tabular records
            </summary>
            <table className="mt-3 w-full text-left">
              <thead className="border-b border-slate-800 text-[10px] uppercase text-slate-400">
                <tr>
                  <th className="py-2">Date</th>
                  <th className="py-2">Detected Cases</th>
                  <th className="py-2">Recovered Cases</th>
                  <th className="py-2">Daily Conversion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {activity.map((d) => (
                  <tr key={d.day} className="hover:bg-slate-800/40">
                    <td className="py-1.5">{d.day}</td>
                    <td className="py-1.5 text-slate-300">{d.all}</td>
                    <td className="py-1.5 text-emerald-400">{d.recovered}</td>
                    <td className="py-1.5 text-slate-400">{d.all > 0 ? `${((d.recovered / d.all) * 100).toFixed(0)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>

        {/* Human Oversight & Active Policies Card */}
        <section className="rf-panel flex flex-col p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-400" />
            <h2 className="text-sm font-semibold tracking-tight text-slate-100">Dual-Custody Governance</h2>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Two-person review is enforced for exceptional transactions. Every intervention requires an immutable ledger entry.
          </p>

          <Link
            href="/recovery/approvals"
            className="mt-5 flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 transition-colors hover:border-amber-500/40"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <p className="text-sm font-semibold text-amber-200">{approvals} Decisions Awaiting Co-Sign</p>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Two independent operator reviews required before dispatch</p>
            </div>
            <ArrowRight size={16} className="text-amber-300" />
          </Link>

          <div className="mt-5 space-y-1 divide-y divide-slate-800/80 border-t border-slate-800/80 pt-2 text-xs">
            <div className="flex items-center justify-between py-2.5">
              <span className="text-slate-400">Discount Ceiling Cap</span>
              <span className="font-mono font-medium text-emerald-400">{data.merchant.discountCeiling}% Max</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-slate-400">Minimum Net Margin Floor</span>
              <span className="font-mono font-medium text-slate-200">{data.merchant.minMargin}% Margin</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-slate-400">Cryptographic Ledger Events</span>
              <span className="font-mono text-slate-200">{data.audit.length} SHA-256 blocks</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-slate-400">Rate Limiter Status</span>
              <span className="inline-flex items-center gap-1 font-mono text-emerald-400 text-[11px]">
                <CheckCircle2 size={12} />
                50 req/s Atomic Sliding Window
              </span>
            </div>
          </div>

          <div className="mt-auto pt-6">
            <Link
              href="/policies"
              className="inline-flex items-center gap-2 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <Sliders size={14} />
              <span>Modify Merchant Guardrails</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </section>
      </div>

      {/* Active Recovery Cases Section */}
      <section className="rf-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Live Active Recovery Stream</h2>
            <p className="mt-0.5 text-xs text-slate-400">High Expected-Value cases currently progressing through cadence timers</p>
          </div>
          <Link
            href="/recovery/cases"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <span>View All Cases</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {activeCases.length ? (
          <CaseRows cases={activeCases.slice(0, 6)} />
        ) : (
          <div className="p-12 text-center">
            <AlertCircle className="mx-auto mb-2 text-slate-500" size={24} />
            <p className="text-sm text-slate-300">No active cases requiring attention.</p>
            <p className="mt-1 text-xs text-slate-500">New checkout dropoffs and payment failures stream here in real time.</p>
          </div>
        )}
      </section>

      <p className="text-[11px] text-slate-400">
        Refreshed {new Date(data.generatedAt).toLocaleTimeString()} · All minor integer values retain native currency
        integrity · Expected Value calculated via calibrated utility model
      </p>
    </div>
  );
}
