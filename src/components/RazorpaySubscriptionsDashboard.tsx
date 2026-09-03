/**
 * PayBack AI — Razorpay Official Subscriptions Dashboard View.
 *
 * Implements the exact Razorpay Subscriptions UI layout from:
 * https://dashboard.razorpay.com/app/subscriptions
 *
 * Columns:
 * [Subscription Id | Plan Id | Subscription Link | Customer Id | Next Due on | Created At | Status | Actions]
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  RotateCcw,
  Zap,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { TestSubscription } from '@/lib/server/subscriptionStore';

interface SubscriptionsDashboardProps {
  onNavigateToQueue?: () => void;
}

export function RazorpaySubscriptionsDashboard({ onNavigateToQueue }: SubscriptionsDashboardProps) {
  const [subscriptions, setSubscriptions] = useState<TestSubscription[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Subscription Form State
  const [newPlanName, setNewPlanName] = useState<string>('SaaS Enterprise Pro');
  const [newAmountRupees, setNewAmountRupees] = useState<number>(2499);
  const [newCustomerEmail, setNewCustomerEmail] = useState<string>('alex.founder@buildathon.in');

  const fetchSubscriptions = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/razorpay/subscriptions');
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data.subscriptions || []);
      }
    } catch (err) {
      console.error('Failed to fetch subscriptions:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch('/api/razorpay/subscriptions');
        if (res.ok && !ignore) {
          const data = await res.json();
          setSubscriptions(data.subscriptions || []);
        }
      } catch (err) {
        console.error('Failed to load subscriptions:', err);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleHaltSubscription = async (subscriptionId: string, action: 'halt' | 'cancel') => {
    try {
      setActionInProgress(subscriptionId);
      setActionMessage(null);

      const res = await fetch('/api/razorpay/subscriptions/halt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId,
          action,
          reason: action === 'halt' ? 'Bank debit mandate failure' : 'Customer cancelled autopay',
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setActionMessage({
          type: 'success',
          text: `Subscription ${subscriptionId} marked as '${action}ed'! Event pushed into recovery queue.`,
        });
        await fetchSubscriptions();
      } else {
        setActionMessage({
          type: 'error',
          text: data.error || 'Failed to update subscription status',
        });
      }
    } catch {
      setActionMessage({
        type: 'error',
        text: 'Network error communicating with webhook adapter',
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionInProgress('creating');
      const res = await fetch('/api/razorpay/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planName: newPlanName,
          amountRupees: newAmountRupees,
          customerEmail: newCustomerEmail,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsCreateModalOpen(false);
        setActionMessage({
          type: 'success',
          text: `Created new test subscription ${data.subscription?.subscription_id} (₹${newAmountRupees.toLocaleString('en-IN')})!`,
        });
        await fetchSubscriptions();
      }
    } catch (err) {
      console.error('Create subscription error:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  const filteredSubscriptions = subscriptions.filter((sub) => {
    const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
    const query = searchQuery.toLowerCase();
    const matchesQuery =
      !query ||
      sub.subscription_id.toLowerCase().includes(query) ||
      sub.plan_id.toLowerCase().includes(query) ||
      sub.customer_id.toLowerCase().includes(query) ||
      sub.plan_name.toLowerCase().includes(query) ||
      sub.customer_email.toLowerCase().includes(query);
    return matchesStatus && matchesQuery;
  });

  const getStatusBadge = (status: TestSubscription['status']) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50';
      case 'halted':
        return 'bg-rose-950/80 text-rose-300 border-rose-500/50 animate-pulse';
      case 'cancelled':
        return 'bg-slate-800 text-slate-300 border-slate-700';
      case 'created':
      case 'authenticated':
        return 'bg-blue-950/80 text-blue-300 border-blue-500/50';
      case 'paused':
        return 'bg-amber-950/80 text-amber-300 border-amber-500/50';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-indigo-400">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white tracking-tight">Subscriptions</h2>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                    Razorpay Test Mode
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Manage recurring subscription plans, mandate tokens, and live recovery triggers.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Subscription</span>
            </button>

            <button
              onClick={fetchSubscriptions}
              disabled={isLoading}
              title="Refresh subscriptions"
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition cursor-pointer"
            >
              <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {actionMessage && (
          <div
            className={`mt-4 p-3 rounded-xl border text-xs flex items-center justify-between animate-fade-in ${
              actionMessage.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
                : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>{actionMessage.text}</span>
            </div>
            {onNavigateToQueue && (
              <button
                onClick={onNavigateToQueue}
                className="underline text-emerald-300 hover:text-white font-bold ml-4 cursor-pointer"
              >
                View in Recovery Queue &rarr;
              </button>
            )}
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 text-xs font-medium">
            {['all', 'active', 'halted', 'cancelled', 'paused'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg capitalize transition cursor-pointer whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white font-bold shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Subscription, Plan, Customer..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Subscriptions Table / Empty State */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {filteredSubscriptions.length === 0 ? (
          <div className="py-20 px-4 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
              <Layers className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="text-base font-bold text-white">There are no subscriptions yet!!</h3>
              <p className="text-xs text-slate-400">
                Create a plan first to create a subscription or switch filters.
              </p>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition inline-flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Plan &amp; Subscription</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Subscription Id</th>
                  <th className="py-3.5 px-4">Plan Id</th>
                  <th className="py-3.5 px-4">Subscription Link</th>
                  <th className="py-3.5 px-4">Customer Id</th>
                  <th className="py-3.5 px-4">Next Due on</th>
                  <th className="py-3.5 px-4">Created At</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {filteredSubscriptions.map((sub) => (
                  <tr key={sub.subscription_id} className="hover:bg-slate-800/40 transition">
                    {/* Subscription ID */}
                    <td className="py-3.5 px-4 font-mono font-bold text-indigo-300">
                      <div className="flex items-center gap-1.5">
                        <span>{sub.subscription_id}</span>
                        <button
                          onClick={() => handleCopy(sub.subscription_id, `sub-${sub.subscription_id}`)}
                          className="text-slate-500 hover:text-slate-300 cursor-pointer"
                          title="Copy ID"
                        >
                          {copiedId === `sub-${sub.subscription_id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Plan ID */}
                    <td className="py-3.5 px-4">
                      <div className="font-mono text-slate-300 font-medium">{sub.plan_id}</div>
                      <div className="text-[10px] text-slate-500">{sub.plan_name} (₹{(sub.amount_paise / 100).toLocaleString('en-IN')})</div>
                    </td>

                    {/* Subscription Link */}
                    <td className="py-3.5 px-4">
                      <a
                        href={sub.subscription_link}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-indigo-400 hover:text-indigo-300 underline flex items-center gap-1 text-[11px]"
                      >
                        <span>{sub.subscription_link.replace('https://', '')}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>

                    {/* Customer ID */}
                    <td className="py-3.5 px-4">
                      <div className="font-mono text-slate-300">{sub.customer_id}</div>
                      <div className="text-[10px] text-slate-500">{sub.customer_email}</div>
                    </td>

                    {/* Next Due on */}
                    <td className="py-3.5 px-4 text-slate-300 font-mono text-[11px]">
                      {new Date(sub.next_due_on).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>

                    {/* Created At */}
                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                      {new Date(sub.created_at).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border capitalize ${getStatusBadge(sub.status)}`}>
                        {sub.status}
                      </span>
                    </td>

                    {/* Action Triggers */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {sub.status === 'active' ? (
                          <>
                            <button
                              onClick={() => handleHaltSubscription(sub.subscription_id, 'halt')}
                              disabled={actionInProgress === sub.subscription_id}
                              title="Halt mandate and simulate payment failure"
                              className="px-2.5 py-1 bg-amber-950/80 hover:bg-amber-900/80 text-amber-200 border border-amber-500/50 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <Zap className="w-3 h-3 text-amber-400" />
                              <span>Halt Mandate</span>
                            </button>

                            <button
                              onClick={() => handleHaltSubscription(sub.subscription_id, 'cancel')}
                              disabled={actionInProgress === sub.subscription_id}
                              title="Cancel subscription"
                              className="px-2 py-1 bg-slate-800 hover:bg-rose-950/80 text-slate-300 hover:text-rose-200 border border-slate-700 hover:border-rose-500/50 rounded-lg text-[10px] font-semibold transition cursor-pointer disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono italic">
                            Event Ingested
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Subscription Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Create Test Subscription</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-500 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubscription} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-slate-300">Plan Name</label>
                <input
                  type="text"
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-300">Amount (₹ INR)</label>
                <input
                  type="number"
                  min="100"
                  step="100"
                  value={newAmountRupees}
                  onChange={(e) => setNewAmountRupees(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-300">Customer Email</label>
                <input
                  type="email"
                  value={newCustomerEmail}
                  onChange={(e) => setNewCustomerEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-[11px] text-indigo-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <p>
                  Generates an authentic subscription with test-mode links and registers it in the local store &amp; Razorpay sandbox.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionInProgress === 'creating'}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {actionInProgress === 'creating' ? (
                    <>
                      <Activity className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Subscription</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
