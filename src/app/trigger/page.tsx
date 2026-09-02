/**
 * PayBack AI — Mobile Judge Live Failure Trigger Page.
 *
 * Route: /trigger
 *
 * Minimal, fast, mobile-first interface designed for judges or audience members
 * scanning the QR code during live presentations to trigger a real test-mode
 * payment failure event that instantly reflects in the Command Center queue.
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Zap,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Smartphone,
  Activity,
} from 'lucide-react';

const FAILURE_OPTIONS = [
  { id: 'bank_downtime', label: 'Bank Downtime (HDFC Outage)', desc: 'Temporary network failure at issuing bank' },
  { id: 'insufficient_funds', label: 'Insufficient Funds', desc: 'Customer account balance unavailable' },
  { id: 'auth_failure', label: 'Auth / 3D-Secure Timeout', desc: 'OTP expired or incorrect pin' },
  { id: 'expired_card', label: 'Expired Card Mandate', desc: 'Subscription card mandate needs update' },
  { id: 'gateway_degradation', label: 'Gateway Latency Spike', desc: 'Transient timeout during capture' },
];

const PRESET_AMOUNTS = [
  { rupees: 1499, label: '₹1,499' },
  { rupees: 4999, label: '₹4,999' },
  { rupees: 12500, label: '₹12,500' },
  { rupees: 52000, label: '₹52,000 (Dual-Custody)' },
];

export default function JudgeTriggerPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('bank_downtime');
  const [selectedAmountRupees, setSelectedAmountRupees] = useState<number>(4999);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [judgeName, setJudgeName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [responseMsg, setResponseMsg] = useState<{
    type: 'success' | 'error';
    title: string;
    detail: string;
    paymentId?: string;
    amountFormatted?: string;
    rateLimitRemaining?: number;
  } | null>(null);

  const handleTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResponseMsg(null);

    const effectiveRupees = customAmount && Number(customAmount) > 0
      ? Number(customAmount)
      : selectedAmountRupees;

    try {
      const res = await fetch('/api/live-trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: selectedCategory,
          amountRupees: effectiveRupees,
          judgeNote: judgeName.trim() ? `Injected by Judge ${judgeName.trim()}` : 'Live Demo Judge Injection',
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResponseMsg({
          type: 'success',
          title: 'Live Payment Failure Dispatched!',
          detail: `Event '${data.payment?.payment_id}' ingested into the live queue. Look at the main presentation screen!`,
          paymentId: data.payment?.payment_id,
          amountFormatted: `₹${(effectiveRupees).toLocaleString('en-IN')}`,
          rateLimitRemaining: data.rateLimitRemaining,
        });
      } else {
        setResponseMsg({
          type: 'error',
          title: 'Trigger Blocked',
          detail: data.message || data.error || 'Failed to dispatch test failure.',
        });
      }
    } catch {
      setResponseMsg({
        type: 'error',
        title: 'Connection Error',
        detail: 'Could not reach the live API endpoint. Please check connection.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <div className="max-w-md mx-auto w-full space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md text-sm">
              ⚡
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">PayBack AI</h1>
              <p className="text-[10px] text-slate-400 font-mono">Live Judge Injection</p>
            </div>
          </div>

          <Link
            href="/"
            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium px-2 py-1 rounded-md bg-indigo-950/60 border border-indigo-800/60 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </Link>
        </div>

        {/* Live Status Badge */}
        <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl flex items-center gap-2.5 text-xs text-indigo-200">
          <Smartphone className="w-4 h-4 text-indigo-400 shrink-0 animate-pulse" />
          <p className="leading-snug">
            <strong>Audience Participation:</strong> Trigger a test failure from your phone and watch it immediately appear and rank on the presentation display.
          </p>
        </div>

        {/* Feedback Alert */}
        {responseMsg && (
          <div
            data-testid="trigger-response-alert"
            className={`p-4 rounded-xl border text-xs space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200 ${
              responseMsg.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
                : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm">
              {responseMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{responseMsg.title}</span>
            </div>
            <p className="text-slate-300">{responseMsg.detail}</p>
            {responseMsg.paymentId && (
              <div className="pt-2 border-t border-emerald-500/30 flex items-center justify-between font-mono text-[11px]">
                <span className="text-emerald-400 font-bold">{responseMsg.paymentId}</span>
                <span className="text-white font-bold">{responseMsg.amountFormatted}</span>
              </div>
            )}
          </div>
        )}

        {/* Trigger Form */}
        <form onSubmit={handleTrigger} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
          {/* Failure Category */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              1. Failure Reason (Razorpay Error Code)
            </label>
            <div className="space-y-1.5">
              {FAILURE_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition text-xs ${
                    selectedCategory === opt.id
                      ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-xs'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="category"
                    value={opt.id}
                    checked={selectedCategory === opt.id}
                    onChange={() => setSelectedCategory(opt.id)}
                    className="mt-0.5 accent-indigo-500"
                  />
                  <div>
                    <span className="font-semibold block text-slate-200">{opt.label}</span>
                    <span className="text-[10px] text-slate-400 block">{opt.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Amount Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              2. Transaction Amount
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_AMOUNTS.map((amt) => (
                <button
                  type="button"
                  key={amt.rupees}
                  onClick={() => {
                    setSelectedAmountRupees(amt.rupees);
                    setCustomAmount('');
                  }}
                  className={`p-2 rounded-lg border text-xs font-semibold text-center transition cursor-pointer ${
                    selectedAmountRupees === amt.rupees && !customAmount
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {amt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Optional Judge Name */}
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-slate-400">
              3. Your Name / Judge Identifier (Optional)
            </label>
            <input
              type="text"
              value={judgeName}
              onChange={(e) => setJudgeName(e.target.value)}
              placeholder="e.g. Judge Priya / Staff Reviewer"
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Submit Trigger Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            data-testid="submit-live-trigger-btn"
            className="w-full py-3 px-4 bg-gradient-to-r from-rose-600 via-indigo-600 to-indigo-700 hover:from-rose-500 hover:to-indigo-600 text-white font-bold rounded-xl shadow-lg transition duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
          >
            {isSubmitting ? (
              <>
                <Activity className="w-4 h-4 animate-spin" />
                <span>Injecting Live Event...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                <span>Trigger Live Failure Event</span>
              </>
            )}
          </button>
        </form>

        {/* Safety & Rate Limit Footer */}
        <div className="text-center text-[10px] text-slate-500 space-y-1">
          <p className="flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Rate-limited to 15 triggers/min · Razorpay Sandbox Mode</span>
          </p>
          <p>PayBack AI Closed-Loop Autonomous Recovery Engine</p>
        </div>
      </div>
    </div>
  );
}
