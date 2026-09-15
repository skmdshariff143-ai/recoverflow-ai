'use client';

import React, { useState } from 'react';
import { 
  ShoppingBag, 
  Search, 
  ShieldBan, 
  ExternalLink, 
  Plus
} from 'lucide-react';
import type { CartEvent, SuppressionEntry } from '@recoverflow/core';

interface CartsExplorerProps {
  carts: CartEvent[];
  suppressions: SuppressionEntry[];
  onRefresh: () => void;
}

export function CartsExplorer({ carts, suppressions, onRefresh }: CartsExplorerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'CARTS' | 'SUPPRESSION'>('CARTS');
  const [newSuppressionInput, setNewSuppressionInput] = useState('');
  const [addingSuppression, setAddingSuppression] = useState(false);

  const filteredCarts = carts.filter((c) => {
    const term = searchTerm.toLowerCase();
    return (
      (c.customerName && c.customerName.toLowerCase().includes(term)) ||
      (c.customerEmail && c.customerEmail.toLowerCase().includes(term)) ||
      (c.customerPhone && c.customerPhone.includes(term)) ||
      c.cartToken.toLowerCase().includes(term)
    );
  });

  const handleAddSuppression = async () => {
    if (!newSuppressionInput.trim()) return;
    try {
      setAddingSuppression(true);
      // Determine type
      const isEmail = newSuppressionInput.includes('@');
      await fetch('/api/recovery/suppress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: newSuppressionInput.trim(),
          type: isEmail ? 'EMAIL' : 'PHONE',
          reason: 'MANUAL',
        }),
      });
      setNewSuppressionInput('');
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setAddingSuppression(false);
    }
  };

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 space-y-6">
      {/* Header Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-2 bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs">
          <button
            onClick={() => setActiveTab('CARTS')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md font-semibold transition ${
              activeTab === 'CARTS' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" /> All Abandoned Carts ({carts.length})
          </button>
          <button
            onClick={() => setActiveTab('SUPPRESSION')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md font-semibold transition ${
              activeTab === 'SUPPRESSION' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <ShieldBan className="w-3.5 h-3.5 text-rose-400" /> Suppression Registry ({suppressions.length})
          </button>
        </div>

        {activeTab === 'CARTS' && (
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by customer, email, token..."
              className="bg-zinc-950 border border-zinc-800 focus:border-blue-500 text-xs rounded-lg pl-9 pr-3 py-2 text-zinc-200 outline-none w-64"
            />
          </div>
        )}
      </div>

      {activeTab === 'CARTS' ? (
        /* Carts Table */
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950/80 text-zinc-400 uppercase font-semibold border-b border-zinc-800">
              <tr>
                <th className="p-3">Customer</th>
                <th className="p-3">Products</th>
                <th className="p-3">Value</th>
                <th className="p-3">Reason</th>
                <th className="p-3">Stage</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredCarts.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-800/30 transition">
                  <td className="p-3">
                    <div className="font-semibold text-white">{c.customerName || 'Shopper'}</div>
                    <div className="text-zinc-500 text-[11px]">{c.customerPhone || c.customerEmail || 'No contact'}</div>
                  </td>
                  <td className="p-3">
                    <div className="text-zinc-200">{c.items[0]?.title}</div>
                    {c.items.length > 1 && (
                      <div className="text-zinc-500 text-[11px]">+{c.items.length - 1} more items</div>
                    )}
                  </td>
                  <td className="p-3 font-bold text-zinc-100">
                    {c.currency} {c.totalPrice.toFixed(2)}
                  </td>
                  <td className="p-3">
                    <span className="text-[11px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-300">
                      {c.abandonmentType}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {c.recoveryStage}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <a
                      href={c.checkoutUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
                    >
                      Rehydrate <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Suppression List Management */
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={newSuppressionInput}
              onChange={(e) => setNewSuppressionInput(e.target.value)}
              placeholder="Enter phone (+1...) or email to suppress..."
              className="flex-1 bg-zinc-950 border border-zinc-800 focus:border-blue-500 text-xs rounded-lg px-4 py-2.5 text-zinc-200 outline-none"
            />
            <button
              onClick={handleAddSuppression}
              disabled={addingSuppression || !newSuppressionInput.trim()}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" /> Suppress Contact
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-950/80 text-zinc-400 uppercase font-semibold border-b border-zinc-800">
                <tr>
                  <th className="p-3">Suppressed Contact</th>
                  <th className="p-3">Channel Type</th>
                  <th className="p-3">Opt-out Reason</th>
                  <th className="p-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {suppressions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-zinc-500">
                      No suppressed contacts found. Customers who reply STOP on WhatsApp or unsubscribe via email will automatically appear here.
                    </td>
                  </tr>
                ) : (
                  suppressions.map((s) => (
                    <tr key={s.id} className="hover:bg-zinc-800/30">
                      <td className="p-3 font-semibold text-rose-300">{s.identifier}</td>
                      <td className="p-3">{s.type}</td>
                      <td className="p-3">{s.reason}</td>
                      <td className="p-3 text-zinc-500">{new Date(s.optedOutAt).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
