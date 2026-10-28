import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Shield, Lock, Eye, Database } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Data handling disclosures regarding synthetic evaluation benchmarks, Razorpay test mode telemetry, stateless Gemini AI advisory queries, and prototype session state.',
  alternates: {
    canonical: '/privacy',
  },
};

export default function PrivacyPolicyPage() {
  const lastUpdated = 'October 27, 2026';

  return (
    <div className="min-h-screen bg-[#060c16] text-slate-100 selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Navigation Header */}
      <header className="mx-auto flex h-20 max-w-5xl items-center justify-between gap-4 px-6 border-b border-slate-800/80">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          Back to RecoverFlow AI
        </Link>
        <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-full">
          Transparency &amp; Prototype Governance
        </span>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-14 space-y-12">
        {/* Document Header */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-emerald-400">
            <Shield size={16} />
            <span>Operational Data Privacy Statement</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
            Privacy Policy
          </h1>
          <p className="text-xs font-mono text-slate-400">
            Effective Date: {lastUpdated} &bull; Document Version: 2.2-prototype
          </p>

          <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 text-xs text-sky-200 leading-relaxed">
            <strong>Demonstration &amp; Prototype Notice:</strong> RecoverFlow AI is an independent project by Shaik Mahammad Shariff created for architectural benchmarking and technical evaluation. It is not an incorporated commercial service and has not been reviewed by legal counsel.
          </div>

          <p className="text-sm leading-relaxed text-slate-300">
            This Privacy Policy details the data handling practices of RecoverFlow AI, an independent project by Shaik Mahammad Shariff. This document transparently explains the exact categories of synthetic and test data processed through this demonstration software, our technical safeguards, our bounded AI governance principles, and how inquiries may be directed.
          </p>
        </div>

        {/* Core Principles Grid */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
              <Lock size={15} />
              <span>Zero Float Arithmetic</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Financial calculations are executed in integer minor units (paise/cents) to eliminate precision loss and data discrepancy.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-violet-400 text-xs font-semibold">
              <Eye size={15} />
              <span>Bounded AI Advisory</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Diagnostic failure categorization and reminder drafting. Prompts are sent to the Google Gemini API, whose own terms govern data handling. Do not enter personal data.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold">
              <Database size={15} />
              <span>Cryptographic Auditing</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Decisions and dual-custody operator sign-offs are hashed into an immutable SHA-256 Merkle chain for verifiable compliance.
            </p>
          </div>
        </div>

        {/* Section 1 */}
        <section className="space-y-4 border-t border-slate-800/80 pt-8">
          <h2 className="text-xl font-semibold text-white">1. Information We Process</h2>
          <p className="text-sm leading-relaxed text-slate-300">
            RecoverFlow AI operates as a technical demonstration and research prototype. We do not collect or store live customer payment cards, bank account numbers, or real consumer banking credentials. The software processes:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-xs leading-relaxed text-slate-400">
            <li>
              <strong className="text-slate-200">Synthetic Benchmark Datasets:</strong> Pre-generated synthetic cohorts of payment failure events (e.g., synthetic checkout identifiers, simulated error codes, and minor unit amounts in paise) used to evaluate scoring algorithms and expected value rankings.
            </li>
            <li>
              <strong className="text-slate-200">Test Gateway Telemetry:</strong> In interactive verification, test-mode payment events received via Razorpay test mode (<code className="font-mono text-emerald-300">rzp_test_*</code>) webhooks. No real money or live transactions are ever processed.
            </li>
            <li>
              <strong className="text-slate-200">AI Advisory Telemetry:</strong> Transient error summaries and recovery reminder prompts evaluated through Google Gemini API endpoints (<code className="font-mono text-emerald-300">gemini-2.5-flash</code>). Prompts are sent to the Google Gemini API, whose own terms govern data handling. Do not enter personal data.
            </li>
            <li>
              <strong className="text-slate-200">Evaluation Session State:</strong> Local authenticated session cookies and navigation caches used exclusively to authenticate operators exploring the demonstration console.
            </li>
          </ul>
        </section>

        {/* Section 2 */}
        <section className="space-y-4 border-t border-slate-800/80 pt-8">
          <h2 className="text-xl font-semibold text-white">2. Cookies and Local Storage</h2>
          <p className="text-sm leading-relaxed text-slate-300">
            We adhere strictly to privacy-by-design. We do not use third-party advertising cookies, retargeting pixels, or behavioral cross-site trackers.
          </p>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2 font-mono">
              Inventory of Stored Elements
            </h3>
            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800/60 pb-2">
                <span className="font-mono text-emerald-400 font-medium">recoverflow_session</span>
                <span>Type: HttpOnly, Secure, SameSite=Lax Cookie</span>
                <span className="text-slate-400">Purpose: Authenticated session state (8-hour duration)</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-1">
                <span className="font-mono text-slate-300 font-medium">rf_workspace_cache</span>
                <span>Type: SessionStorage (In-Memory)</span>
                <span className="text-slate-400">Purpose: Active merchant console navigation state</span>
              </div>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-slate-400">
            Because our cookies are strictly necessary to deliver the authenticated session requested by the operator exploring the demo, no decorative or intrusive cookie consent banners are displayed.
          </p>
        </section>

        {/* Section 3 */}
        <section className="space-y-4 border-t border-slate-800/80 pt-8">
          <h2 className="text-xl font-semibold text-white">3. Artificial Intelligence Advisory Guardrails</h2>
          <p className="text-sm leading-relaxed text-slate-300">
            RecoverFlow AI uses Google Gemini 2.5 Flash models in a strictly bounded, advisory-only capacity:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-xs leading-relaxed text-slate-400">
            <li>
              <strong className="text-slate-200">Third-Party AI Terms:</strong> Prompts are sent to the Google Gemini API, whose own terms govern data handling. Do not enter personal data.
            </li>
            <li>
              <strong className="text-slate-200">Deterministic Supremacy:</strong> Machine learning models never execute financial transfers or grant discounts unilaterally. Every discount ceiling, quiet-hours suppression window, and high-value recovery is enforced by deterministic code gates and dual human authorization.
            </li>
          </ul>
        </section>

        {/* Section 4 */}
        <section className="space-y-4 border-t border-slate-800/80 pt-8">
          <h2 className="text-xl font-semibold text-white">4. Data Retention and Erasure</h2>
          <p className="text-sm leading-relaxed text-slate-300">
            Because RecoverFlow AI is a non-commercial demonstration prototype:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-xs leading-relaxed text-slate-400">
            <li>
              <strong className="text-slate-200">Session and Ephemeral Records:</strong> In-memory test sessions and simulated ledger entries are ephemeral and can be reset or purged at any time during test cycles.
            </li>
            <li>
              <strong className="text-slate-200">Simulated Opt-Out &amp; Suppression:</strong> The prototype supports demonstration customer suppression via (<code className="font-mono text-emerald-300">/api/recovery/suppress</code>), showing how customer outreach halt logic functions.
            </li>
            <li>
              <strong className="text-slate-200">Data Deletion Inquiries:</strong> Any inquiries regarding sample data or prototype state may be directed to the project operator.
            </li>
          </ul>
        </section>

        {/* Section 5 */}
        <section className="space-y-4 border-t border-slate-800/80 pt-8">
          <h2 className="text-xl font-semibold text-white">5. Technology Infrastructure &amp; Services</h2>
          <p className="text-sm leading-relaxed text-slate-300">
            The RecoverFlow AI demonstration utilizes the following developer and cloud environments:
          </p>
          <div className="grid gap-3 sm:grid-cols-2 text-xs text-slate-400">
            <div className="rounded-lg border border-slate-800 p-3 bg-slate-900/30">
              <span className="font-semibold text-slate-200 block mb-1">Hosting &amp; Compute</span>
              Vercel Inc. (Next.js Application Hosting)
            </div>
            <div className="rounded-lg border border-slate-800 p-3 bg-slate-900/30">
              <span className="font-semibold text-slate-200 block mb-1">Payment Gateway Simulation</span>
              Razorpay Software Pvt Ltd (Test Mode Sandbox: <code className="font-mono text-emerald-300">rzp_test_*</code>)
            </div>
            <div className="rounded-lg border border-slate-800 p-3 bg-slate-900/30">
              <span className="font-semibold text-slate-200 block mb-1">Advisory Intelligence</span>
              Google Cloud Gemini API (<code className="font-mono text-emerald-300">gemini-2.5-flash</code> stateless inference)
            </div>
            <div className="rounded-lg border border-slate-800 p-3 bg-slate-900/30">
              <span className="font-semibold text-slate-200 block mb-1">Local &amp; Edge Storage</span>
              In-memory idempotency caches and ephemeral evaluation databases
            </div>
          </div>
        </section>

        {/* Section 6 */}
        <section className="space-y-4 border-t border-slate-800/80 pt-8">
          <h2 className="text-xl font-semibold text-white">6. Contact and Inquiries</h2>
          <p className="text-sm leading-relaxed text-slate-300">
            For questions, feedback, or data inquiries regarding this demonstration project, please contact the project operator:
          </p>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-xs font-mono space-y-1 text-slate-300">
            <div className="font-sans font-semibold text-white">Shaik Mahammad Shariff</div>
            <div className="text-slate-400 font-sans text-xs">Operator &bull; RecoverFlow AI (Independent Project)</div>
            <div>Email: <a href="mailto:sk.md.shariff143@gmail.com" className="text-emerald-400 hover:underline">sk.md.shariff143@gmail.com</a></div>
            <div className="text-slate-400 font-sans text-[11px] pt-1">
              Jurisdiction: Andhra Pradesh, India
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 px-6 py-8 text-center text-xs text-slate-400">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4">
          <span>&copy; {new Date().getFullYear()} RecoverFlow AI. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <Link href="/" className="hover:text-slate-300">Home</Link>
            <Link href="/terms" className="hover:text-slate-300">Terms of Service</Link>
            <Link href="/demo" className="hover:text-slate-300">Benchmark Lab</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
