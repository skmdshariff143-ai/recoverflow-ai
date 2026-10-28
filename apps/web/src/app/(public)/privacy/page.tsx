import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Shield, Lock, Eye, Database } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Detailed privacy disclosures regarding merchant data handling, payment failure telemetry, AI advisory boundaries, and cryptographic audit records.',
  alternates: {
    canonical: '/privacy',
  },
};

export default function PrivacyPolicyPage() {
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
        <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-full">
          Transparency & Data Governance
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
            Effective Date: {lastUpdated} &bull; Document Version: 2.1-production
          </p>
          <p className="text-sm leading-relaxed text-slate-300">
            RecoverFlow AI (&ldquo;RecoverFlow,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) provides an intelligent merchant operations console and recovery orchestration service. This Privacy Policy details the exact categories of data processed through our software, our technical safeguards, our bounded AI governance principles, and your privacy rights.
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
              Gemini 2.5 advisory models provide diagnostic input only. Customer PII is never submitted to train public foundation models.
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
          <h2 className="text-xl font-semibold text-white">1. Information We Collect and Process</h2>
          <p className="text-sm leading-relaxed text-slate-300">
            RecoverFlow AI functions primarily as a Data Processor on behalf of merchant subscribers (the Data Controllers). In providing recovery orchestration, we process:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-xs leading-relaxed text-slate-400">
            <li>
              <strong className="text-slate-200">Merchant Operator Credentials:</strong> Work email address, cryptographically hashed passwords (scrypt/PBKDF2), role assignment (Admin, Operator, Auditor, Compliance Officer), and tenant workspace identifiers.
            </li>
            <li>
              <strong className="text-slate-200">Payment Failure Telemetry:</strong> Transaction identifiers, failure error codes, gateway timestamps, payment method category (e.g., card, UPI, bank mandate), and transaction amounts in minor currency units (e.g., paise).
            </li>
            <li>
              <strong className="text-slate-200">Customer Communication Metadata:</strong> Customer phone number (for WhatsApp/SMS recovery links) or email address, masked cart tokens, and customer-directed suppression flags.
            </li>
            <li>
              <strong className="text-slate-200">Audit & Decision Trail:</strong> Operator decision logs, dual-custody signatures, Thompson Sampling policy allocations, and timestamps stored in our immutable append-only ledger.
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
            Because our cookies are strictly necessary to deliver the authenticated service requested by the operator, no decorative or intrusive cookie consent banners are displayed.
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
              <strong className="text-slate-200">No Model Training:</strong> Telemetry and customer communication excerpts sent to advisory inference APIs are processed statelessly and are never retained by our AI providers to train foundation models.
            </li>
            <li>
              <strong className="text-slate-200">Deterministic Supremacy:</strong> Machine learning models never execute financial transfers or grant discounts unilaterally. Every discount ceiling, quiet-hours suppression window, and high-value recovery is enforced by deterministic code gates and dual human authorization.
            </li>
          </ul>
        </section>

        {/* Section 4 */}
        <section className="space-y-4 border-t border-slate-800/80 pt-8">
          <h2 className="text-xl font-semibold text-white">4. Data Retention, Suppression &amp; Deletion</h2>
          <p className="text-sm leading-relaxed text-slate-300">
            We retain operational case data in accordance with statutory accounting standards and merchant policies:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-xs leading-relaxed text-slate-400">
            <li>
              <strong className="text-slate-200">Customer Opt-Out &amp; Suppression:</strong> Customers who opt out via communications or webhook signals are immediately registered in the suppression table (<code className="font-mono text-emerald-300">/api/recovery/suppress</code>), halting any future outreach.
            </li>
            <li>
              <strong className="text-slate-200">Audit Ledger Retention:</strong> Cryptographic verification records are preserved for up to 7 years to meet statutory auditing requirements for commercial transactions.
            </li>
            <li>
              <strong className="text-slate-200">Right of Erasure (GDPR / DPDP Act):</strong> Merchants can trigger customer data redaction requests, replacing contact identifiers with SHA-256 pseudonymized hashes while preserving ledger integrity.
            </li>
          </ul>
        </section>

        {/* Section 5 */}
        <section className="space-y-4 border-t border-slate-800/80 pt-8">
          <h2 className="text-xl font-semibold text-white">5. Sub-processors and Infrastructure</h2>
          <p className="text-sm leading-relaxed text-slate-300">
            RecoverFlow AI utilizes industry-recognized cloud infrastructure and integration gateways:
          </p>
          <div className="grid gap-3 sm:grid-cols-2 text-xs text-slate-400">
            <div className="rounded-lg border border-slate-800 p-3 bg-slate-900/30">
              <span className="font-semibold text-slate-200 block mb-1">Hosting &amp; Compute</span>
              Vercel Inc. &amp; Managed PostgreSQL (AWS / GCP ISO-27001 certified regions)
            </div>
            <div className="rounded-lg border border-slate-800 p-3 bg-slate-900/30">
              <span className="font-semibold text-slate-200 block mb-1">Payment Gateways</span>
              Razorpay Software Pvt Ltd &amp; Stripe Inc. (PCI-DSS Level 1 compliant)
            </div>
            <div className="rounded-lg border border-slate-800 p-3 bg-slate-900/30">
              <span className="font-semibold text-slate-200 block mb-1">Outbound Communication</span>
              Meta Cloud API (WhatsApp) &amp; Resend / Twilio (TLS 1.3 encrypted)
            </div>
            <div className="rounded-lg border border-slate-800 p-3 bg-slate-900/30">
              <span className="font-semibold text-slate-200 block mb-1">Advisory Inference</span>
              Google Cloud Vertex AI / Gemini API (Enterprise privacy tier)
            </div>
          </div>
        </section>

        {/* Section 6 */}
        <section className="space-y-4 border-t border-slate-800/80 pt-8">
          <h2 className="text-xl font-semibold text-white">6. Contact and Privacy Rights</h2>
          <p className="text-sm leading-relaxed text-slate-300">
            To exercise your rights of access, correction, suppression, or deletion, or to submit questions regarding our data practices, contact:
          </p>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-xs font-mono space-y-1 text-slate-300">
            <div>RecoverFlow AI Data Governance Team</div>
            <div>Email: <a href="mailto:privacy@recoverflow.ai" className="text-emerald-400 hover:underline">privacy@recoverflow.ai</a></div>
            <div className="text-slate-400 font-sans text-[11px] pt-1">
              For merchant-specific inquiries, please contact your designated platform workspace administrator.
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
