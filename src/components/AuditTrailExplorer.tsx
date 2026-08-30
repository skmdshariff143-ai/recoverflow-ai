/**
 * PayBack AI — Global Audit Trail Explorer Component.
 *
 * Searchable, filterable, and exportable (CSV / JSON) view of every
 * audit event logged across the entire recovery lifecycle.
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
} from 'lucide-react';
import type { AuditRecord } from '@/lib/engine/auditTrail';

interface AuditTrailExplorerProps {
  records: AuditRecord[];
  onExportCSV: () => void;
  onExportJSON: () => void;
  onSelectPayment: (paymentId: string) => void;
}

export function AuditTrailExplorer({
  records,
  onExportCSV,
  onExportJSON,
  onSelectPayment,
}: AuditTrailExplorerProps) {
  const [search, setSearch] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  const filteredRecords = records.filter((r) => {
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
      {/* ── Explorer Header & Export Actions ───────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            Append-Only Audit Trail Explorer
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Chronological audit log of all {records.length} decisions across scoring, safety, ranking, and execution.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            Export CSV
          </button>
          <button
            onClick={onExportJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition"
          >
            <FileCode className="w-3.5 h-3.5 text-indigo-600" />
            Export JSON
          </button>
        </div>
      </div>

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

      {/* ── Audit Records Table ────────────────────────────────── */}
      <div className="overflow-x-auto border border-slate-100 rounded-lg">
        <table className="min-w-full text-xs text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
            <tr>
              <th className="py-2.5 px-3">Audit ID</th>
              <th className="py-2.5 px-3">Payment ID</th>
              <th className="py-2.5 px-3">Timestamp</th>
              <th className="py-2.5 px-3">Stage</th>
              <th className="py-2.5 px-3">Decision</th>
              <th className="py-2.5 px-3">Audit Reason &amp; Rationale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {paginatedRecords.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  No audit events found matching criteria.
                </td>
              </tr>
            ) : (
              paginatedRecords.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-2.5 px-3 font-mono text-slate-500 font-medium">
                    {r.id}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">
                    <button
                      onClick={() => onSelectPayment(r.payment_id)}
                      className="hover:underline focus:outline-none"
                    >
                      {r.payment_id}
                    </button>
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                    {new Date(r.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className="inline-block uppercase tracking-wider text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {r.stage.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900 max-w-xs">
                    {r.decision}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 max-w-md">
                    {r.reason}
                  </td>
                </tr>
              ))
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
