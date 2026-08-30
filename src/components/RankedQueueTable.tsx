/**
 * RecoverFlow AI — Ranked Payment Queue Component.
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

  const totalPages = Math.ceil(items.length / pageSize) || 1;
  const paginatedItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSort = (field: 'rank' | 'expected_value' | 'amount' | 'recovery_probability') => {
    if (sortField === field) {
      onSortAscToggle();
    } else {
      onSortFieldChange(field);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-4">
      {/* ── Filter and Search Bar ──────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
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
            <Filter className="w-3.5 h-3.5 text-slate-400" />
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
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <span>
            Showing <strong className="text-slate-800">{items.length}</strong> of {totalCount} records
          </span>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────── */}
      <div className="overflow-x-auto border border-slate-100 rounded-lg">
        <table className="min-w-full text-xs text-left">
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
                <td colSpan={10} className="py-8 text-center text-slate-400">
                  No payment records match the selected filters.
                </td>
              </tr>
            ) : (
              paginatedItems.map((item) => {
                const isRecovered = item.execution_status === 'recovered';
                const isStopped = item.status === 'stopped' || item.execution_status === 'stopped';
                const isDeferred = item.status === 'deferred';
                const isPending = item.status === 'pending_approval';

                return (
                  <tr
                    key={item.payment.payment_id}
                    onClick={() => onSelectPayment(item.payment.payment_id)}
                    className="hover:bg-indigo-50/40 cursor-pointer transition"
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
                    <td className="py-2.5 px-3 text-slate-500 font-mono">
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
                      ₹{(item.score.expected_value / 100).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
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
                        <span className="inline-flex items-center gap-1 font-bold text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Recovered
                        </span>
                      ) : isStopped ? (
                        <span
                          className="inline-flex items-center gap-1 font-semibold text-[11px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200"
                          title={item.stop_detail}
                        >
                          <ShieldAlert className="w-3 h-3 text-rose-600" />
                          Stopped
                        </span>
                      ) : isPending ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          Pending Approval
                        </span>
                      ) : isDeferred ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          <PauseCircle className="w-3 h-3 text-slate-400" />
                          Deferred
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                          <Clock className="w-3 h-3 text-blue-600" />
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
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="border border-slate-300 rounded px-2 py-1 bg-white text-slate-700"
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
