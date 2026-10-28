import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Operating terms, acceptable use, operational boundaries, and disclaimer of warranties for the RecoverFlow AI merchant recovery platform.',
  alternates: {
    canonical: '/terms',
  },
};

export default function TermsPage() {
  const lastUpdated = 'October 21, 2026';

  return (
    <div className="min-h-screen bg-[#080b10] text-slate-100 selection:bg-emerald-500/30 selection:text-emerald-200">
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
          Draft Agreement &bull; Subject to Legal Review
        </span>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-14 space-y-12">
        {/* Document Header */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-emerald-400">
            <FileText size={16} />
            <span>Merchant Service Agreement</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
            Terms of Service
          </h1>
          <p className="text-xs font-mono text-slate-400">
            Last Modified: {lastUpdated} &bull; Document Reference: TOS-2026-v2.0
          </p>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
            <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={18} />
            <div className="text-xs text-amber-200 leading-relaxed">
              <strong>Owner &amp; Legal Review Notice:</strong> These terms are drafted to accurately reflect RecoverFlow AI&rsquo;s current technical architecture, dual-custody review mechanisms, and deterministic boundaries. They must be formally reviewed and approved by platform ownership and legal counsel before final enterprise contract execution.
            </div>
          </div>
        </div>

        {/* Section 1 */}
        <section className="space-y-4 border-t border-slate-800/80 pt-8">
          <h2 className="text-xl font-semibold text-white">1. Scope and Nature of Service</h2>
          <p className="text-sm leading-relaxed text-slate-300">
            RecoverFlow AI provides an enterprise software platform for monitoring failed e-commerce checkouts, diagnosing transaction failure categories, ranking recovery opportunities via Expected Value optimization, and orchestrating recovery communications.
          </p>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-2 text-xs text-slate-300">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <CheckCircle2 size={16} />
              <span>Operational Realities &amp; No Warranty of Payment Clearance</span>
            </div>
            <p className="leading-relaxed text-slate-400">
              RecoverFlow AI assists merchants in recovering abandoned checkouts and transient payment failures. We do not guarantee payment authorization, banking network uptime, or customer settlement. The actual clearance of funds remains entirely subject to customer consent, issuing bank approval, and payment gateway network protocols.
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
              <strong className="text-slate-200">Merchant Discretion:</strong> The merchant operator is solely responsible for configuring discount ceilings, minimum margin thresholds, quiet-hours contact windows, and approval rules.
            </li>
            <li>
              <strong className="text-slate-200">High-Value Sign-off:</strong> High-value transactions or exception cases requiring dual-custody approvals must be verified by designated merchant operators before messages or discount coupons are dispatched.
            </li>
            <li>
              <strong className="text-slate-200">Advisory Boundaries:</strong> Artificial intelligence models (such as Gemini 2.5 Flash) provide advisory diagnostic context only. The merchant acknowledges that automated agents cannot unilaterally override deterministic safety rules.
            </li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="space-y-4 border-t border-slate-800/80 pt-8">
          <h2 className="text-xl font-semibold text-white">3. Acceptable Use and Merchant Compliance</h2>
          <p className="text-sm leading-relaxed text-slate-300">
            Merchants using RecoverFlow AI represent and warrant that:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-xs leading-relaxed text-slate-400">
            <li>They possess all necessary consumer consents under applicable laws (including TCPA, CAN-SPAM, GDPR, and TRAI/DND guidelines) to send transactional recovery notices via SMS, WhatsApp, and Email.</li>
            <li>They will not configure automated communication during statutory quiet hours (default: 21:00 to 09:00 local time).</li>
            <li>They will respect all consumer opt-out requests immediately upon receipt.</li>
            <li>They will safeguard all operator passwords, session keys, and webhook signing secrets.</li>
          </ul>
        </section>

        {/* Section 4 */}
        <section className="space-y-4 border-t border-slate-800/80 pt-8">
          <h2 className="text-xl font-semibold text-white">4. Intellectual Property</h2>
          <p className="text-sm leading-relaxed text-slate-300">
            All rights, title, and interest in and to the RecoverFlow AI platform—including the deterministic Thompson Sampling ranking algorithms, scoring waterfall architecture, user interfaces, and cryptographic ledger verification modules—remain the exclusive property of RecoverFlow AI and its licensors.
          </p>
        </section>

        {/* Section 5 */}
        <section className="space-y-4 border-t border-slate-800/80 pt-8">
          <h2 className="text-xl font-semibold text-white">5. Limitation of Liability and Disclaimer</h2>
          <p className="text-sm leading-relaxed text-slate-300 uppercase font-mono text-[11px] tracking-wide text-slate-400">
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:
          </p>
          <p className="text-xs leading-relaxed text-slate-400">
            THE SOFTWARE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE,&rdquo; WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN NO EVENT SHALL RECOVERFLOW AI BE LIABLE FOR ANY LOST PROFITS, LOST REVENUE, LOSS OF DATA, OR CONSEQUENTIAL DAMAGES ARISING OUT OF PAYMENT GATEWAY DOWNTIME, THIRD-PARTY TELECOM DELAYS, OR HUMAN OPERATOR ERRORS.
          </p>
        </section>

        {/* Section 6 */}
        <section className="space-y-4 border-t border-slate-800/80 pt-8">
          <h2 className="text-xl font-semibold text-white">6. Governing Law and Dispute Resolution</h2>
          <p className="text-sm leading-relaxed text-slate-300">
            These Terms shall be governed by and construed in accordance with the laws applicable to the commercial jurisdiction of the platform owner, without regard to conflict of law principles. Any dispute arising under these Terms shall be resolved through binding arbitration or the competent courts of the merchant&rsquo;s registered territory.
          </p>
        </section>

        {/* Section 7 */}
        <section className="space-y-4 border-t border-slate-800/80 pt-8">
          <h2 className="text-xl font-semibold text-white">7. Inquiries and Legal Review</h2>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-xs font-mono space-y-1 text-slate-300">
            <div>RecoverFlow AI Legal &amp; Governance</div>
            <div>Email: <a href="mailto:legal@recoverflow.ai" className="text-emerald-400 hover:underline">legal@recoverflow.ai</a></div>
            <div className="text-slate-400 font-sans text-[11px] pt-1">
              For enterprise master service agreements (MSA) or custom service level agreements (SLA), please contact your account representative.
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
