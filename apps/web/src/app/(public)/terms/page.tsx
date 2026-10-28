import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Operating terms, acceptable use, operational boundaries, and disclaimer of warranties for the RecoverFlow AI demonstration prototype.',
  alternates: {
    canonical: '/terms',
  },
};

export default function TermsPage() {
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
        <span className="text-[10px] uppercase font-mono tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-full">
          Prototype Demonstration &bull; Non-Commercial
        </span>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-14 space-y-12">
        {/* Document Header */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-emerald-400">
            <FileText size={16} />
            <span>Merchant Service Agreement (Prototype Terms)</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
            Terms of Service
          </h1>
          <p className="text-xs font-mono text-slate-400">
            Last Modified: {lastUpdated} &bull; Document Reference: TOS-2026-prototype
          </p>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
            <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={18} />
            <div className="text-xs text-amber-200 leading-relaxed">
              <strong>Demonstration &amp; Prototype Notice:</strong> RecoverFlow AI is an independent project by Shaik Mahammad Shariff developed solely for technical demonstration and research benchmarking. It is not an incorporated commercial service and has not been reviewed by legal counsel. Use of this demonstration environment is strictly at the user&rsquo;s own discretion.
            </div>
          </div>
        </div>

        {/* Section 1 */}
        <section className="space-y-4 border-t border-slate-800/80 pt-8">
          <h2 className="text-xl font-semibold text-white">1. Scope and Nature of Service</h2>
          <p className="text-sm leading-relaxed text-slate-300">
            RecoverFlow AI is an independent project by Shaik Mahammad Shariff providing an evaluation platform for monitoring simulated checkout drop-offs, diagnosing transaction failure categories, ranking recovery opportunities via Expected Value optimization, and demonstrating recovery workflows.
          </p>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-2 text-xs text-slate-300">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <CheckCircle2 size={16} />
              <span>Operational Realities &amp; No Warranty of Payment Clearance</span>
            </div>
            <p className="leading-relaxed text-slate-400">
              RecoverFlow AI assists in evaluating recovery patterns on synthetic cohorts and test-mode payment events. We do not guarantee payment authorization, banking network uptime, or customer settlement. The actual clearance of funds remains entirely subject to customer consent, issuing bank approval, and payment gateway network protocols.
            </p>
          </div>
        </section>

        {/* Section 2 */}
        <section className="space-y-4 border-t border-slate-800/80 pt-8">
          <h2 className="text-xl font-semibold text-white">2. Dual-Custody and Human Operator Responsibility</h2>
          <p className="text-sm leading-relaxed text-slate-300">
            RecoverFlow AI enforces deterministic margin guardrails and human-in-the-loop governance:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-xs leading-relaxed text-slate-400">
            <li>
              <strong className="text-slate-200">Operator Discretion:</strong> The evaluating operator or merchant is solely responsible for configuring discount ceilings, minimum margin thresholds, quiet-hours contact windows, and approval rules.
            </li>
            <li>
              <strong className="text-slate-200">High-Value Sign-off:</strong> High-value transactions or exception cases requiring dual-custody approvals must be verified by designated operators before messages or discount coupons are dispatched in live or sandbox runtime modes.
            </li>
            <li>
              <strong className="text-slate-200">Advisory Boundaries:</strong> Artificial intelligence models (such as Google Gemini 2.5 Flash) provide advisory diagnostic context only. Prompts are sent to the Google Gemini API, whose own terms govern data handling. Do not enter personal data. Automated agents cannot unilaterally override deterministic safety rules.
            </li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="space-y-4 border-t border-slate-800/80 pt-8">
          <h2 className="text-xl font-semibold text-white">3. Acceptable Use and Prototype Conduct</h2>
          <p className="text-sm leading-relaxed text-slate-300">
            Users exploring or testing the RecoverFlow AI demonstration represent and warrant that:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-xs leading-relaxed text-slate-400">
            <li>They will not submit live credit card numbers, genuine consumer banking credentials, or production personal health or identity information into this demonstration environment.</li>
            <li>Any interactive webhook verification will use Razorpay test mode sandbox credentials (<code className="font-mono text-emerald-300">rzp_test_*</code>).</li>
            <li>They will not use the recovery or messaging dispatch tools to transmit unsolicited communications (spam) or contact recipients during statutory quiet hours.</li>
            <li>They will safeguard all evaluation session passwords and test environment tokens.</li>
          </ul>
        </section>

        {/* Section 4 */}
        <section className="space-y-4 border-t border-slate-800/80 pt-8">
          <h2 className="text-xl font-semibold text-white">4. Open-Source License and Intellectual Property</h2>
          <p className="text-sm leading-relaxed text-slate-300">
            RecoverFlow AI is open-source software licensed under the <a href="https://github.com/skmdshariff143-ai/recoverflow-ai/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">Apache License, Version 2.0</a>. Use, reproduction, and distribution of the software, including its deterministic ranking algorithms, scoring waterfall architecture, user interfaces, and verification modules, are governed by the terms of the Apache 2.0 license. For the complete terms and conditions, refer to the repository <a href="https://github.com/skmdshariff143-ai/recoverflow-ai/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="font-mono text-emerald-400 hover:underline">LICENSE</a> file.
          </p>
        </section>

        {/* Section 5 */}
        <section className="space-y-4 border-t border-slate-800/80 pt-8">
          <h2 className="text-xl font-semibold text-white">5. Limitation of Liability and Disclaimer</h2>
          <p className="text-sm leading-relaxed text-slate-300 uppercase font-mono text-[11px] tracking-wide text-slate-400">
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:
          </p>
          <p className="text-xs leading-relaxed text-slate-400">
            THE SOFTWARE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE,&rdquo; WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN NO EVENT SHALL THE OPERATOR, CONTRIBUTORS, OR AFFILIATES BE LIABLE FOR ANY LOST PROFITS, LOST REVENUE, LOSS OF DATA, OR CONSEQUENTIAL DAMAGES ARISING OUT OF PAYMENT GATEWAY DOWNTIME, THIRD-PARTY TELECOM DELAYS, OR HUMAN OPERATOR ERRORS.
          </p>
        </section>

        {/* Section 6 */}
        <section className="space-y-4 border-t border-slate-800/80 pt-8">
          <h2 className="text-xl font-semibold text-white">6. Governing Law and Jurisdiction</h2>
          <p className="text-sm leading-relaxed text-slate-300">
            These Terms and this prototype project shall be governed by and construed in accordance with the laws of Andhra Pradesh, India, without regard to conflict of law principles. Any dispute arising out of or in connection with this project shall be subject to the exclusive jurisdiction of the competent courts of Andhra Pradesh, India.
          </p>
        </section>

        {/* Section 7 */}
        <section className="space-y-4 border-t border-slate-800/80 pt-8">
          <h2 className="text-xl font-semibold text-white">7. Inquiries and Contact</h2>
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
            <Link href="/privacy" className="hover:text-slate-300">Privacy Policy</Link>
            <Link href="/demo" className="hover:text-slate-300">Benchmark Lab</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
