/**
 * PayBack AI — Global Audit Trail & Cryptographic Ledger Explorer.
 *
 * Searchable, filterable, and exportable (CSV / JSON) view of every
 * audit event logged across the entire recovery lifecycle, with cryptographic
 * SHA-256 hash-chain verification.
 */

'use client';

import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  FileCode,
  Lock,
  AlertOctagon,
  Flame,
  RotateCcw,
  Bug,
} from 'lucide-react';
import type { ChainedAuditRecord, LedgerVerificationResult } from '@/lib/engine/hashChainLedger';
import { tamperWorkingLedgerCopy, verifyLedgerIntegrity } from '@/lib/engine/hashChainLedger';

interface AuditTrailExplorerProps {
  records: ChainedAuditRecord[];
  verification?: LedgerVerificationResult;
  onExportCSV: () => void;
  onExportJSON: () => void;
  onSelectPayment: (paymentId: string) => void;
}

export function AuditTrailExplorer({
  records,
  verification,
  onExportCSV,
  onExportJSON,
  onSelectPayment,
}: AuditTrailExplorerProps) {
  const [search, setSearch] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Live Tamper Demo State (Operates purely on working copies)
  const [tamperRecordId, setTamperRecordId] = useState<string>(records[2]?.id ?? records[0]?.id ?? '');
  const [tamperField, setTamperField] = useState<'decision' | 'reason'>('decision');
  const [tamperValue, setTamperValue] = useState<string>(
    'FORGED: Force-approved without manager authorization',
  );
  const [isTamperActive, setIsTamperActive] = useState<boolean>(false);
  const [workingLedger, setWorkingLedger] = useState<ChainedAuditRecord[] | null>(null);
  const [workingVerification, setWorkingVerification] = useState<LedgerVerificationResult | null>(null);

  const handleTamperAndVerify = () => {
    const targetId = tamperRecordId || (records[0]?.id ?? '');
    const { tamperedLedger } = tamperWorkingLedgerCopy(records, targetId, tamperField, tamperValue);
    const result = verifyLedgerIntegrity(tamperedLedger);
    setWorkingLedger(tamperedLedger);
    setWorkingVerification(result);
    setIsTamperActive(true);
  };

  const handleResetDemo = () => {
    setIsTamperActive(false);
    setWorkingLedger(null);
    setWorkingVerification(null);
  };

  const activeRecords = isTamperActive && workingLedger ? workingLedger : records;
  const activeVerification = isTamperActive && workingVerification ? workingVerification : verification;
  const isVerified = activeVerification ? activeVerification.isValid : true;

  const filteredRecords = activeRecords.filter((r) => {
    if (stageFilter !== 'all' && r.stage !== stageFilter) return false;
    if (search.trim() !== '') {
      const q = search.toLowerCase();
      const matchId = r.payment_id.toLowerCase().includes(q);
      const matchDec = r.decision.toLowerCase().includes(q);
      const matchRea = r.reason.toLowerCase().includes(q);
      const matchAud = r.id.toLowerCase().includes(q);
      if (!matchId && !matchDec && !matchRea && !matchAud) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
      {/* ── Explorer Header & Export Actions ───────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              Append-Only Tamper-Evident Audit Ledger
            </h2>
            <span className="bg-cyan-100 text-cyan-800 text-[11px] font-bold px-2 py-0.5 rounded-full border border-cyan-300 flex items-center gap-1">
              <Lock className="w-3 h-3 text-cyan-700" />
              SHA-256 Hash Chained
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Chronological cryptographic ledger of all {records.length} decision events across scoring, safety, ranking, and execution.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            Export CSV
          </button>
          <button
            onClick={onExportJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition cursor-pointer"
          >
            <FileCode className="w-3.5 h-3.5 text-indigo-600" />
            Export Signed JSON
          </button>
        </div>
      </div>

      {/* ── Live Tamper Demo Panel ("Try to Break It") ─────────── */}
      <div
        data-testid="tamper-demo-panel"
        className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-indigo-500/10 border border-amber-300/80 rounded-xl p-4 space-y-3"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-rose-600 shrink-0" />
            <h3 className="text-xs font-bold text-slate-900">
              Interactive Adversarial Verification Demo (&ldquo;Try to Break It&rdquo;)
            </h3>
            <span className="text-[10px] bg-amber-200/80 text-amber-900 font-semibold px-2 py-0.5 rounded border border-amber-300">
              Isolated Working Copy
            </span>
          </div>
          {isTamperActive && (
            <button
              onClick={handleResetDemo}
              data-testid="tamper-reset-btn"
              className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-2.5 py-1 rounded-lg transition cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-3 h-3 text-emerald-400" />
              Reset Demo
            </button>
          )}
        </div>

        <p className="text-[11px] text-slate-600">
          Pick any audit block, alter its decision or audit reason payload, and execute verification to watch SHA-256 cryptographic chain invalidation in real time.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center text-xs">
          <div className="md:col-span-4">
            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Target Audit Record</label>
            <select
              data-testid="tamper-record-select"
              value={tamperRecordId || (records[2]?.id ?? records[0]?.id ?? '')}
              onChange={(e) => setTamperRecordId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs bg-white text-slate-800 font-mono"
            >
              {records.slice(0, 15).map((r) => (
                <option key={r.id} value={r.id}>
                  #{r.sequenceIndex} · {r.id} ({r.payment_id} - {r.stage.replace(/_/g, ' ')})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Field</label>
            <select
              value={tamperField}
              onChange={(e) => setTamperField(e.target.value as 'decision' | 'reason')}
              className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs bg-white text-slate-800"
            >
              <option value="decision">Decision</option>
              <option value="reason">Audit Reason</option>
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Tampered Value</label>
            <input
              type="text"
              data-testid="tamper-value-input"
              value={tamperValue}
              onChange={(e) => setTamperValue(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          </div>

          <div className="md:col-span-2 flex items-end pt-4 md:pt-0">
            <button
              onClick={handleTamperAndVerify}
              data-testid="tamper-submit-btn"
              className="w-full flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm transition cursor-pointer"
            >
              <Bug className="w-3.5 h-3.5" />
              Tamper &amp; Verify
            </button>
          </div>
        </div>
      </div>

      {/* ── Cryptographic Integrity Status Banner ──────────────── */}
      {activeVerification && (
        <div
          data-testid="ledger-integrity-banner"
          className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2 ${
            isVerified
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-950 font-medium animate-pulse'
          }`}
        >
          <div className="flex items-center gap-2">
            {isVerified ? (
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <div>
              <div className="font-bold flex items-center gap-2">
                <span>
                  {isVerified
                    ? 'Cryptographic Verification Passed: All records hash-linked without tampering.'
                    : `INTEGRITY BREACH DETECTED: TAMPERED AT RECORD #${activeVerification.tamperedIndex}`}
                </span>
                {!isVerified && (
                  <span
                    data-testid="chain-invalid-badge"
                    className="bg-rose-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded uppercase"
                  >
                    CHAIN INVALID
                  </span>
                )}
              </div>
              {!isVerified && (
                <div className="text-[11px] text-rose-800 mt-0.5">
                  {activeVerification.errorDetail}
                </div>
              )}
            </div>
          </div>
          <div className="font-mono text-[11px] text-slate-600 shrink-0">
            Latest Hash: <span className="text-slate-900 font-bold">{activeVerification.latestHash.slice(0, 16)}...</span>
          </div>
        </div>
      )}

      {/* ── Search & Filter Controls ───────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search payment ID, audit ID, decision..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={stageFilter}
              onChange={(e) => {
                setStageFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Pipeline Stages</option>
              <option value="feature_scoring">Feature Scoring</option>
              <option value="safety_filter">Safety Filter</option>
              <option value="approval_gate">Approval Gate</option>
              <option value="quiet_hours_scheduling">Quiet-Hours Scheduling</option>
              <option value="budget_allocation">Budget Allocation</option>
              <option value="intervention_execution">Intervention Execution</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Showing <strong>{filteredRecords.length}</strong> of {records.length} events
        </div>
      </div>

      {/* ── Audit Records Table with Hash Chain ────────────────── */}
      <div className="overflow-x-auto border border-slate-100 rounded-lg">
        <table className="min-w-full text-xs text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
            <tr>
              <th className="py-2.5 px-3 text-center">Seq #</th>
              <th className="py-2.5 px-3">Audit ID</th>
              <th className="py-2.5 px-3">Payment ID</th>
              <th className="py-2.5 px-3">Timestamp</th>
              <th className="py-2.5 px-3">Stage</th>
              <th className="py-2.5 px-3">Decision</th>
              <th className="py-2.5 px-3">Audit Reason</th>
              <th className="py-2.5 px-3">SHA-256 Hash</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {paginatedRecords.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400">
                  No audit events found matching criteria.
                </td>
              </tr>
            ) : (
              paginatedRecords.map((r) => {
                const isTamperedRow =
                  isTamperActive &&
                  !isVerified &&
                  typeof activeVerification?.tamperedIndex === 'number' &&
                  r.sequenceIndex >= activeVerification.tamperedIndex;
                const isTamperOrigin =
                  isTamperActive &&
                  !isVerified &&
                  r.sequenceIndex === activeVerification?.tamperedIndex;

                return (
                  <tr
                    key={r.id}
                    data-testid={isTamperedRow ? 'tampered-row' : undefined}
                    className={`transition ${
                      isTamperedRow
                        ? 'bg-rose-50/90 hover:bg-rose-100/90 text-rose-950 font-medium border-l-4 border-l-rose-600'
                        : 'hover:bg-slate-50/80 text-slate-700'
                    }`}
                  >
                    <td className="py-2.5 px-3 text-center font-mono font-bold">
                      {isTamperOrigin ? (
                        <span className="inline-block bg-rose-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded">
                          #{r.sequenceIndex} 💥
                        </span>
                      ) : (
                        <span className={isTamperedRow ? 'text-rose-700 font-bold' : 'text-slate-400'}>
                          {r.sequenceIndex ?? 0}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-medium">
                      <span className={isTamperedRow ? 'text-rose-900 font-bold' : 'text-slate-500'}>
                        {r.id}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold">
                      <button
                        onClick={() => onSelectPayment(r.payment_id)}
                        className={`hover:underline focus:outline-none cursor-pointer ${
                          isTamperedRow ? 'text-rose-700' : 'text-indigo-600'
                        }`}
                      >
                        {r.payment_id}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">
                      {new Date(r.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`inline-block uppercase tracking-wider text-[10px] font-semibold px-2 py-0.5 rounded border ${
                          isTamperedRow
                            ? 'bg-rose-200 text-rose-900 border-rose-300'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {r.stage.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className={`py-2.5 px-3 font-semibold max-w-xs ${isTamperedRow ? 'text-rose-950' : 'text-slate-900'}`}>
                      {r.decision}
                    </td>
                    <td className={`py-2.5 px-3 max-w-sm ${isTamperedRow ? 'text-rose-900' : 'text-slate-600'}`}>
                      {r.reason}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[10px]">
                      {isTamperOrigin ? (
                        <span className="text-rose-700 font-bold bg-rose-200 px-1 py-0.5 rounded">
                          HASH BREAK
                        </span>
                      ) : isTamperedRow ? (
                        <span className="text-rose-600">
                          {r.currentHash ? `${r.currentHash.slice(0, 8)}...` : '—'}
                        </span>
                      ) : (
                        <span className="text-slate-400">
                          {r.currentHash ? `${r.currentHash.slice(0, 10)}...` : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-slate-600 pt-2">
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="border border-slate-300 rounded px-2 py-1 bg-white text-slate-700"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
