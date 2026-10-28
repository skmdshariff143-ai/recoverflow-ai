'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { AlertCircle, ArrowUpRight, Check, CheckCircle2, ShieldCheck, UserCheck, X } from 'lucide-react';
import { api, useWorkspace } from './WorkspaceProvider';
import { Empty, PageTitle, SourceNote, Status } from './ui';
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

  const pending = data.cases
    .filter((entry) => entry.status === 'APPROVAL_REQUIRED')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const allowed = ['ADMIN', 'OWNER', 'RECOVERY_MANAGER'].includes(data.session.role);

  async function addSample() {
    setBusy(true);
    setNotice('');
    try {
      await api('/api/console/demo', { method: 'POST', body: '{}' });
      await refresh();
      setNotice('A new sample case is ready for two independent operator reviews.');
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function open(record: ConsoleCase, decision: 'approve' | 'reject') {
    setSelected(record);
    setAction(decision);
    setReason('');
    setError('');
    dialog.current?.showModal();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;

    setBusy(true);
    setError('');
    try {
      const result = await api<{ status: string; approvals: number }>('/api/console/review', {
        method: 'POST',
        body: JSON.stringify({ caseId: selected.id, action, reason }),
      });
      await refresh();
      dialog.current?.close();

      if (action === 'reject') {
        setNotice('Review recorded. Recovery workflows for this case are permanently stopped.');
      } else if (result.approvals >= 2) {
        setNotice(
          'Dual approval recorded. Both cryptographic signatures are verified. Case is eligible for dispatch policy evaluation.'
        );
      } else {
        setNotice(
          'First signature recorded. Pursuant to dual-custody invariants, a distinct operator must co-sign.'
        );
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle
        eyebrow="DUAL-CUSTODY GOVERNANCE"
        title="Approval Inbox"
        description="Enforce two-person separation of duties on high-value recovery dispatches and policy exceptions."
        action={
          data.source === 'DEMO' && allowed ? (
            <button
              type="button"
              className="rf-button-secondary"
              disabled={busy}
              onClick={addSample}
            >
              Add Demo Review Case
            </button>
          ) : undefined
        }
      />

      <SourceNote source={data.source} />

      {/* Operator Authorization Banner */}
      <div className="rf-panel flex flex-wrap items-center justify-between gap-4 p-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-emerald-400">
            <UserCheck size={16} />
          </div>
          <div>
            <span className="font-semibold text-slate-200">Current Signer: </span>
            <span className="font-mono text-emerald-400">{data.session.name}</span>
            <span className="ml-2 rounded border border-slate-700 bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-slate-300">
              {data.session.role}
            </span>
          </div>
        </div>

        <div>
          {allowed ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 size={13} />
              Authorized to record decisions
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-amber-300">
              <AlertCircle size={13} />
              Read-only inspection role
            </span>
          )}
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200"
        >
          <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0 text-emerald-400" />
          <p className="leading-relaxed">{notice}</p>
        </div>
      )}

      {!allowed && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200">
          <AlertCircle size={18} className="mt-0.5 flex-shrink-0 text-amber-400" />
          <p className="leading-relaxed">
            Your current operator role ({data.session.role}) permits read-only inspection. An Owner, Admin, or Recovery Manager must authenticate to record a binding decision.
          </p>
        </div>
      )}

      {/* Pending Reviews List */}
      {pending.length ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>PENDING SIGNATURES ({pending.length})</span>
            <span>DUAL-CUSTODY REQUIRED</span>
          </div>

          {pending.map((entry) => {
            const displayId = entry.id.replace('rc_cart_evt_', 'CASE-');
            const probabilityPercent = (entry.probabilityBps / 100).toFixed(1);

            return (
              <article
                key={entry.id}
                className="rf-panel flex flex-col justify-between gap-6 p-6 transition-colors hover:border-slate-700/80 lg:flex-row lg:items-center"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/recovery/cases/${encodeURIComponent(entry.id)}`}
                      className="group flex items-center font-mono text-sm font-semibold text-slate-100 hover:text-emerald-400"
                    >
                      <span>{displayId}</span>
                      <ArrowUpRight
                        size={14}
                        className="ml-1 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-emerald-400"
                      />
                    </Link>
                    <Status value={entry.status} />
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-300">
                    <span className="font-medium text-slate-200">{entry.customer}</span>
                    <span className="text-slate-500">·</span>
                    <span>
                      Order Value:{' '}
                      <strong className="font-mono font-semibold text-slate-100 tabular-nums">
                        {formatMoney(entry.amountMinor, entry.currency)} {entry.currency}
                      </strong>
                    </span>
                    <span className="text-slate-500">·</span>
                    <span className="text-xs text-slate-400">
                      Model Est: <span className="text-emerald-400">{probabilityPercent}%</span>
                    </span>
                  </div>

                  <p className="text-xs text-slate-400">
                    Approval authorizes scheduled dispatch under merchant discount rules. It does not initiate financial debit.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="rf-button-secondary text-xs"
                    disabled={!allowed || busy}
                    onClick={() => open(entry, 'reject')}
                  >
                    <X size={14} />
                    Reject Case
                  </button>
                  <button
                    type="button"
                    className="rf-button text-xs"
                    disabled={!allowed || busy}
                    onClick={() => open(entry, 'approve')}
                  >
                    <Check size={14} />
                    Review & Co-Sign
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          title="All approvals settled"
          description="There are currently zero cases awaiting dual-custody authorization. Cases requiring human sign-off will appear here automatically."
          href="/recovery/cases"
          linkLabel="Inspect all recovery cases"
        />
      )}

      {/* Review Modal Dialog */}
      <dialog
        ref={dialog}
        aria-labelledby="review-title"
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-slate-800 bg-[#0F172A] p-6 text-slate-100 shadow-2xl backdrop:bg-black/80"
      >
        <form onSubmit={submit}>
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h2 id="review-title" className="text-base font-semibold text-white">
                  {action === 'approve' ? 'Co-Sign Case Approval' : 'Reject Recovery Attempt'}
                </h2>
                <p className="text-xs text-slate-400">
                  {selected ? selected.id.replace('rc_cart_evt_', 'CASE-') : ''}
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close dialog"
              disabled={busy}
              onClick={() => dialog.current?.close()}
              className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-300">
              <span className="font-semibold text-slate-200">Operator Identity: </span>
              {data.session.name} ({data.session.role})
              <p className="mt-1 text-[11px] text-slate-400">
                In adherence to SOX/SOC-2 separation of duties, the same operator cannot record both first and second signatures.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="review-reason" className="text-xs font-semibold text-slate-300">
                  Audit Justification & Rationale
                </label>
                <span className="font-mono text-[10px] text-slate-400">
                  {reason.length} / 1000 (min 10)
                </span>
              </div>
              <textarea
                id="review-reason"
                className="rf-input h-28 text-xs leading-relaxed"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                minLength={10}
                maxLength={1000}
                required
                placeholder="Explain the operational rationale for approving or stopping this recovery event..."
              />
            </div>

            {error && (
              <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                {error}
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
            <button
              type="button"
              disabled={busy}
              className="rf-button-secondary text-xs"
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || reason.trim().length < 10}
              className="rf-button text-xs"
            >
              {busy ? 'Recording Signature...' : action === 'approve' ? 'Sign & Approve' : 'Confirm Rejection'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
