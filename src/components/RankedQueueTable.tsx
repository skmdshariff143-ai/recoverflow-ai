/**
 * PayBack AI — Ranked Payment Queue Component.
 *
 * Interactive, searchable, sortable, and filterable view of all 100 payments.
 * Clicking any row opens the explainable decision drill-down drawer.
 */

'use client';

import React, { useState } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  ShieldAlert,
  AlertCircle,
  PauseCircle,
  ExternalLink,
  FilterX,
  RotateCcw,
} from 'lucide-react';
import type { ExecutedItem } from '@/types';
import { FAILURE_CATEGORIES } from '@/types';

interface RankedQueueTableProps {
  items: ExecutedItem[];
  totalCount: number;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (cat: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sortField: 'rank' | 'expected_value' | 'amount' | 'recovery_probability';
  onSortFieldChange: (field: 'rank' | 'expected_value' | 'amount' | 'recovery_probability') => void;
  onSortAscToggle: () => void;
  onSelectPayment: (paymentId: string) => void;
}

export function RankedQueueTable({
  items,
  totalCount,
  statusFilter,
  onStatusFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  searchQuery,
  onSearchChange,
  sortField,
  onSortFieldChange,
  onSortAscToggle,
  onSelectPayment,
}: RankedQueueTableProps) {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  const totalPages = Math.ceil(items.length / pageSize) || 1;
  const paginatedItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const maxExpectedValue = Math.max(...items.map((i) => i.score.expected_value), 1);

  const handleSort = (field: 'rank' | 'expected_value' | 'amount' | 'recovery_probability') => {
    if (sortField === field) {
      onSortAscToggle();
    } else {
      onSortFieldChange(field);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (targetTag === 'input' || targetTag === 'select') return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => Math.min(prev + 1, Math.max(0, paginatedItems.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (paginatedItems[focusedIndex]) {
        onSelectPayment(paginatedItems[focusedIndex].payment.payment_id);
      }
    }
  };

  const handleClearAllFilters = () => {
    onSearchChange('');
    onStatusFilterChange('all');
    onCategoryFilterChange('all');
    setCurrentPage(1);
  };

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-4 focus:outline-none focus:ring-1 focus:ring-indigo-300"
    >
      {/* ── Table Header & Evidence Provenance ─────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 text-sm">
              Prioritized Recovery Queue ({items.length} of {totalCount} Invoices)
            </h3>
            <span className="text-[10px] font-mono font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200 uppercase">
              {totalCount === 6 ? 'HAND-CURATED SAFETY FIXTURE' : 'SYNTHETIC'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Ranked by Expected Value (EV = Amount × Probability). Click any row to inspect explainability waterfall.
          </p>
        </div>
      </div>

      {/* ── Filter and Search Bar ──────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" aria-hidden="true" />
            <input
              type="text"
              aria-label="Search payment records"
              placeholder="Search ID, customer, error..."
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Filter className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            <select
              aria-label="Filter by workflow status"
              data-testid="status-filter"
              value={statusFilter}
              onChange={(e) => {
                onStatusFilterChange(e.target.value);
                setCurrentPage(1);
              }}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Statuses ({totalCount})</option>
              <option value="recovered">Recovered</option>
              <option value="budgeted">Budgeted (Active)</option>
              <option value="deferred">Deferred</option>
              <option value="stopped">Stopped (Safety)</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="retry_scheduled">Retry Scheduled</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <select
              aria-label="Filter by failure category"
              value={categoryFilter}
              onChange={(e) => {
                onCategoryFilterChange(e.target.value);
                setCurrentPage(1);
              }}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Failure Categories</option>
              {FAILURE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Total records badge */}
        <div aria-live="polite" aria-atomic="true" className="text-xs text-slate-500 flex items-center gap-2">
          <span>
            Showing <strong className="text-slate-800">{items.length}</strong> of {totalCount} records
          </span>
        </div>
      </div>

      {/* ── Mobile Card List (sm:hidden) ───────────────────────── */}
      <div className="block sm:hidden space-y-3" data-testid="mobile-queue-card-list">
        {paginatedItems.length === 0 ? (
          <div className="py-8 text-center bg-slate-50 rounded-lg p-4 border border-slate-200" data-testid="empty-queue-mobile">
            <FilterX className="w-6 h-6 text-slate-500 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-800">No payments match your filters</p>
            <button
              onClick={handleClearAllFilters}
              className="mt-2 text-xs text-indigo-700 font-semibold bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          paginatedItems.map((item) => {
            const isRecovered = item.execution_status === 'recovered';
            const isStopped = item.status === 'stopped' || item.execution_status === 'stopped';
            const isPending = item.status === 'pending_approval';
            const isDeferred = item.status === 'deferred';

            return (
              <div
                key={item.payment.payment_id}
                data-testid="mobile-queue-card"
                onClick={() => onSelectPayment(item.payment.payment_id)}
                className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5 active:bg-indigo-50/60 transition cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {item.rank ? (
                      <span className="bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded text-[11px]">
                        #{item.rank}
                      </span>
                    ) : null}
                    <span className="font-mono font-bold text-xs text-slate-900">
                      {item.payment.payment_id}
                    </span>
                  </div>
                  {isRecovered ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Recovered
                    </span>
                  ) : isStopped ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                      Stopped
                    </span>
                  ) : isPending ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                      Pending
                    </span>
                  ) : isDeferred ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      Deferred
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                      Retry Scheduled
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-600 block">Amount / Cust</span>
                    <span className="font-bold text-slate-900">
                      ₹{(item.payment.amount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-slate-700 font-mono block">{item.payment.customer_id}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-600 block">Prob / Expected Value</span>
                    <span className="font-bold text-emerald-700">
                      ₹{(item.score.expected_value / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-indigo-700 font-semibold block">
                      {(item.score.recovery_probability * 100).toFixed(1)}% prob
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                  <span className="text-[10px] uppercase font-semibold text-slate-600">
                    {item.suggested_intervention}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPayment(item.payment.payment_id);
                    }}
                    className="text-indigo-600 font-bold flex items-center gap-1 text-xs"
                  >
                    Explain Drilldown <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Desktop Table (hidden sm:block) ────────────────────── */}
      <div className="hidden sm:block overflow-x-auto border border-slate-100 rounded-lg">
        <table data-testid="ranked-queue-table" className="min-w-full text-xs text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
            <tr>
              <th
                onClick={() => handleSort('rank')}
                className="py-2.5 px-3 cursor-pointer hover:text-indigo-600 select-none text-center"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Rank</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-3">Payment ID</th>
              <th className="py-2.5 px-3">Customer</th>
              <th
                onClick={() => handleSort('amount')}
                className="py-2.5 px-3 cursor-pointer hover:text-indigo-600 select-none text-right"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Amount</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-3">Failure Reason</th>
              <th
                onClick={() => handleSort('recovery_probability')}
                className="py-2.5 px-3 cursor-pointer hover:text-indigo-600 select-none text-right"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Rec. Prob</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('expected_value')}
                className="py-2.5 px-3 cursor-pointer hover:text-indigo-600 select-none text-right"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Expected Value</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-3 text-center">Intervention</th>
              <th className="py-2.5 px-3 text-center">Status</th>
              <th className="py-2.5 px-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {paginatedItems.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center" data-testid="empty-queue-state">
                  <div className="flex flex-col items-center justify-center space-y-3 max-w-sm mx-auto">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <FilterX className="w-6 h-6 text-slate-500" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">
                        No payments match your filters
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Try adjusting your search query, status filter, or category selection to see recovery records.
                      </p>
                    </div>
                    <button
                      onClick={handleClearAllFilters}
                      data-testid="clear-filters-btn"
                      className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold px-3 py-1.5 rounded-lg text-xs border border-indigo-200 transition cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Clear All Filters
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedItems.map((item, idx) => {
                const isRecovered = item.execution_status === 'recovered';
                const isStopped = item.status === 'stopped' || item.execution_status === 'stopped';
                const isDeferred = item.status === 'deferred';
                const isPending = item.status === 'pending_approval';
                const isFocused = idx === focusedIndex;

                return (
                  <tr
                    key={item.payment.payment_id}
                    data-testid="queue-row"
                    data-focused={isFocused}
                    tabIndex={0}
                    onFocus={() => setFocusedIndex(idx)}
                    onClick={() => onSelectPayment(item.payment.payment_id)}
                    className={`hover:bg-indigo-50/40 cursor-pointer transition focus:outline-none ${
                      isFocused ? 'bg-indigo-50/70 ring-1.5 ring-indigo-500 ring-inset' : ''
                    }`}
                  >
                    {/* Rank */}
                    <td className="py-2.5 px-3 text-center font-bold text-slate-500">
                      {item.rank ? (
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[11px] ${
                            item.rank <= 40
                              ? 'bg-indigo-100 text-indigo-800 font-bold'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          #{item.rank}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Payment ID (Masked) */}
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-900">
                      {item.payment.payment_id}
                    </td>

                    {/* Customer ID */}
                    <td className="py-2.5 px-3 text-slate-700 font-mono font-medium">
                      {item.payment.customer_id}
                    </td>

                    {/* Amount */}
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      ₹{(item.payment.amount / 100).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                      {item.payment.invoice_value_tier === 'high_value' && (
                        <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 font-bold px-1 py-0.2 rounded">
                          HIGH
                        </span>
                      )}
                    </td>

                    {/* Failure Category */}
                    <td className="py-2.5 px-3 text-slate-700 capitalize">
                      {item.payment.failure_category.replace(/_/g, ' ')}
                    </td>

                    {/* Probability */}
                    <td className="py-2.5 px-3 text-right font-semibold text-indigo-600">
                      {(item.score.recovery_probability * 100).toFixed(1)}%
                    </td>

                    {/* Expected Value */}
                    <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                      <div className="flex items-center justify-end gap-2">
                        <div className="hidden sm:block w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.max(4, Math.min(100, (item.score.expected_value / maxExpectedValue) * 100))}%`,
                            }}
                          />
                        </div>
                        <span className="font-mono text-xs text-slate-900">
                          ₹{(item.score.expected_value / 100).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </td>

                    {/* Suggested Intervention */}
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-block uppercase tracking-wider text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {item.suggested_intervention}
                      </span>
                    </td>

                    {/* Execution / Pipeline Status */}
                    <td className="py-2.5 px-3 text-center">
                      {isRecovered ? (
                        <span
                          role="status"
                          aria-label="Status: Recovered"
                          className="inline-flex items-center gap-1 font-bold text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                          Recovered
                        </span>
                      ) : isStopped ? (
                        <span
                          role="status"
                          aria-label={`Status: Stopped (${item.stop_detail || 'Safety rule enforced'})`}
                          className="inline-flex items-center gap-1 font-semibold text-[11px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200"
                          title={item.stop_detail}
                        >
                          <ShieldAlert className="w-3 h-3 text-rose-600" aria-hidden="true" />
                          Stopped
                        </span>
                      ) : isPending ? (
                        <span
                          role="status"
                          aria-label="Status: Pending Enterprise Approval"
                          className="inline-flex items-center gap-1 font-semibold text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200"
                        >
                          <AlertCircle className="w-3 h-3 text-amber-600" aria-hidden="true" />
                          Pending Approval
                        </span>
                      ) : isDeferred ? (
                        <span
                          role="status"
                          aria-label="Status: Deferred outside current contact budget"
                          className="inline-flex items-center gap-1 font-semibold text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200"
                        >
                          <PauseCircle className="w-3 h-3 text-slate-400" aria-hidden="true" />
                          Deferred
                        </span>
                      ) : (
                        <span
                          role="status"
                          aria-label="Status: Retry Scheduled"
                          className="inline-flex items-center gap-1 font-semibold text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200"
                        >
                          <Clock className="w-3 h-3 text-blue-600" aria-hidden="true" />
                          Retry Scheduled
                        </span>
                      )}
                    </td>

                    {/* Drill-down action link */}
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPayment(item.payment.payment_id);
                        }}
                        className="text-indigo-600 hover:text-indigo-900 font-semibold inline-flex items-center gap-1 text-[11px]"
                      >
                        Explain <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination Bar ────────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-slate-600 pt-2">
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            aria-label="Select rows per page"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="border border-slate-300 rounded px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value={10}>10</option>
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
              type="button"
              aria-label="Previous page"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Next page"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
