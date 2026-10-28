import Link from 'next/link';
import { Workflow, Home, LayoutDashboard, Sparkles } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#080b10] text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Brand Header */}
      <header className="mx-auto flex h-20 max-w-5xl items-center justify-between gap-4 px-6 border-b border-slate-800/80 w-full">
        <Link href="/" className="flex items-center gap-2.5 text-base font-semibold tracking-tight">
          <span className="rounded-xl bg-emerald-400 p-2 text-slate-950">
            <Workflow size={20} />
          </span>
          <span>RecoverFlow <span className="text-emerald-400">AI</span></span>
        </Link>
        <span className="text-xs font-mono text-slate-400">HTTP 404</span>
      </header>

      {/* Main 404 Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center max-w-xl mx-auto space-y-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-700/80 bg-slate-900/60 text-slate-300 text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-rose-400" />
          <span>404 / PAGE NOT FOUND</span>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
            This page isn&rsquo;t available.
          </h1>
          <p className="text-sm leading-relaxed text-slate-400">
            The link you followed may be expired, mistyped, or part of a protected workspace that requires active operator authentication.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full pt-2">
          <Link
            href="/"
            className="rf-button w-full sm:w-auto px-5 py-2.5 flex items-center justify-center gap-2"
          >
            <Home size={15} />
            <span>Return to Home</span>
          </Link>
          <Link
            href="/login"
            className="rf-button-secondary w-full sm:w-auto px-5 py-2.5 flex items-center justify-center gap-2"
          >
            <LayoutDashboard size={15} />
            <span>Open Workspace</span>
          </Link>
          <Link
            href="/demo"
            className="rf-button-secondary w-full sm:w-auto px-5 py-2.5 flex items-center justify-center gap-2 text-slate-300"
          >
            <Sparkles size={15} className="text-violet-400" />
            <span>Benchmark Lab</span>
          </Link>
        </div>

        <div className="pt-8 border-t border-slate-800/80 w-full text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>Looking for documentation?</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-slate-200">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-slate-200">Terms of Service</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
