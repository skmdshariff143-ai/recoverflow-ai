/**
 * PayBack AI — Promise-to-Pay Management Workspace.
 *
 * Tracks customer payment commitments across life-cycle states:
 * created -> reminder_scheduled -> due -> kept -> broken -> extended -> escalated -> stopped.
 */

'use client';

import React, { useState } from 'react';
import {
  HandCoins,
  Search,
  Filter,
} from 'lucide-react';
import { formatPaiseToINR } from '@/lib/engine/financial';

export interface MockPromiseRecord {
  promiseId: string;
  paymentId: string;
  customerId: string;
  customerName: string;
  promisedAmountPaise: number;
  promisedDueDate: string;
  status: 'created' | 'reminder_scheduled' | 'due' | 'kept' | 'broken' | 'extended' | 'escalated' | 'stopped';
  contactChannel: 'sms' | 'whatsapp' | 'email';
  notes: string;
}

const INITIAL_PROMISES: MockPromiseRecord[] = [
  {
    promiseId: 'ptp_001',
    paymentId: 'pay_00016',
    customerId: 'cust_0095',
    customerName: 'Customer cust_0095',
    promisedAmountPaise: 4965974,
    promisedDueDate: '2025-08-31T18:00:00Z',
    status: 'kept',
    contactChannel: 'whatsapp',
    notes: 'Customer confirmed RTGS transfer scheduled with treasury.',
  },
  {
    promiseId: 'ptp_002',
    paymentId: 'pay_00028',
    customerId: 'cust_0049',
    customerName: 'Customer cust_0049',
    promisedAmountPaise: 4941300,
    promisedDueDate: '2025-09-01T12:00:00Z',
    status: 'reminder_scheduled',
    contactChannel: 'email',
    notes: 'Requested 48h grace period to clear pending credit line.',
  },
  {
    promiseId: 'ptp_003',
    paymentId: 'pay_00079',
    customerId: 'cust_0394',
    customerName: 'Customer cust_0394',
    promisedAmountPaise: 4122471,
    promisedDueDate: '2025-08-30T20:00:00Z',
    status: 'due',
    contactChannel: 'sms',
    notes: 'Agreed to manual UPI link payment by evening.',
  },
  {
    promiseId: 'ptp_004',
    paymentId: 'pay_00021',
    customerId: 'cust_0387',
    customerName: 'Customer cust_0387',
    promisedAmountPaise: 3487025,
    promisedDueDate: '2025-08-28T10:00:00Z',
    status: 'broken',
    contactChannel: 'whatsapp',
    notes: 'Payment failed to clear by promised due date; escalated to retry cycle 2.',
  },
  {
    promiseId: 'ptp_005',
    paymentId: 'pay_00044',
    customerId: 'cust_0371',
    customerName: 'Customer cust_0371',
    promisedAmountPaise: 4104307,
    promisedDueDate: '2025-09-02T15:00:00Z',
    status: 'extended',
    contactChannel: 'email',
    notes: 'Mandate renewal requested; extended window by 3 business days.',
  },
];

export function PromiseToPayTracker() {
  const [promises] = useState<MockPromiseRecord[]>(INITIAL_PROMISES);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filtered = promises.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return (
        p.paymentId.toLowerCase().includes(q) ||
        p.customerId.toLowerCase().includes(q) ||
        p.notes.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPromisedPaise = promises.reduce((sum, p) => sum + p.promisedAmountPaise, 0);
  const keptPaise = promises
    .filter((p) => p.status === 'kept')
    .reduce((sum, p) => sum + p.promisedAmountPaise, 0);

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <HandCoins className="w-5 h-5 text-indigo-600" />
              Promise-to-Pay (PTP) Lifecycle Tracker
            </h2>
            <span className="text-xs bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
              Active Commitments
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manages verbal and digital customer payment promises, quiet-hour notifications, and automated escalation on broken commitments.
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs">
          <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
            <span className="text-slate-500 block">Total PTP Volume</span>
            <span className="text-sm font-bold text-slate-900">{formatPaiseToINR(totalPromisedPaise, true)}</span>
          </div>
          <div className="bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200 text-emerald-900">
            <span className="text-emerald-700 block">Settled via PTP</span>
            <span className="text-sm font-bold">{formatPaiseToINR(keptPaise, true)}</span>
          </div>
        </div>
      </div>

      {/* ── Table & Filters ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search payment ID, customer, notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white text-slate-700 focus:outline-none"
            >
              <option value="all">All PTP States ({promises.length})</option>
              <option value="created">Created</option>
              <option value="reminder_scheduled">Reminder Scheduled</option>
              <option value="due">Due Today</option>
              <option value="kept">Kept (Settled)</option>
              <option value="broken">Broken (Default)</option>
              <option value="extended">Extended</option>
              <option value="escalated">Escalated</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-lg">
          <table className="min-w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Promise ID</th>
                <th className="py-2.5 px-3">Payment ID</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3 text-right">Promised Amount</th>
                <th className="py-2.5 px-3">Due Date</th>
                <th className="py-2.5 px-3 text-center">Channel</th>
                <th className="py-2.5 px-3 text-center">PTP State</th>
                <th className="py-2.5 px-3">Notes &amp; Operator Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.map((ptp) => (
                <tr key={ptp.promiseId} className="hover:bg-slate-50 transition">
                  <td className="py-2.5 px-3 font-mono font-medium text-slate-900">{ptp.promiseId}</td>
                  <td className="py-2.5 px-3 font-mono text-indigo-600">{ptp.paymentId}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-500">{ptp.customerId}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                    {formatPaiseToINR(ptp.promisedAmountPaise, true)}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">
                    {new Date(ptp.promisedDueDate).toLocaleDateString()}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
                      {ptp.contactChannel}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`inline-block font-bold text-[10px] px-2.5 py-0.5 rounded-full border ${
                        ptp.status === 'kept'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : ptp.status === 'broken'
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : ptp.status === 'due'
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-blue-100 text-blue-800 border-blue-200'
                      }`}
                    >
                      {ptp.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 text-[11px] max-w-xs truncate">
                    {ptp.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
