import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Layers3, ShieldCheck, Workflow, ScanLine, Sparkles, Fingerprint, Code2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'RecoverFlow AI — Revenue Recovery, Under Control',
  description: 'Turn recovery into a thoughtful operation. Prioritize opportunities, understand each decision, and protect customer relationships behind your revenue.',
  alternates: {
    canonical: '/',
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#080b10] text-slate-100">
      <header className="mx-auto flex h-24 max-w-7xl items-center justify-between gap-4 px-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3 text-base font-semibold tracking-tight">
          <span className="rounded-xl bg-emerald-400 p-2 text-slate-950">
            <Workflow size={21} />
          </span>
          RecoverFlow<span className="-ml-2 text-emerald-400">AI</span>
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-8 text-xs text-slate-400 md:flex">
          <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
          <a href="#built-for-control" className="hover:text-white transition-colors">Built for control</a>
          <Link href="/demo" className="hover:text-white transition-colors">Benchmark lab</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="rf-button-secondary">
            <span>Open workspace</span>
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </header>

      <main>
        <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 pb-20 pt-12 lg:grid-cols-[1fr_1.05fr] lg:px-10 lg:pb-28 lg:pt-24">
          <div className="pointer-events-none absolute -right-64 -top-20 h-[650px] w-[650px] rounded-full bg-emerald-400/[.035] blur-[100px]" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 px-3 py-1.5 text-[10px] tracking-wide text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              INTELLIGENT RECOVERY. HUMAN CONTROL.
            </span>
            <h1 className="mt-7 text-[clamp(2.75rem,4.5vw,4.6rem)] font-semibold leading-[1.08] tracking-[-.05em]">
              Failed payments.<br />A better<br /><span className="text-emerald-300">way forward.</span>
            </h1>
            <p className="mt-7 max-w-lg text-base leading-7 text-slate-400">
              Turn recovery into a thoughtful operation. Prioritize opportunities, understand each decision, and protect the customer relationships behind your revenue.
            </p>

            {/* Approved Primary CTA Hierarchy for Buildathon Evaluators */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/demo?tour=1"
                className="rf-button bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-semibold px-6 py-3.5 shadow-[0_0_30px_rgba(52,211,153,0.3)] flex items-center gap-2 transition"
              >
                <span>Guide Me (Interactive Tour)</span>
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/demo?judge=1"
                className="rf-button-secondary px-5 py-3.5 flex items-center gap-2 transition"
              >
                <Sparkles size={15} className="text-violet-400" />
                <span>Judge Evaluation Mode</span>
              </Link>
              <Link
                href="/demo?tamper=1"
                className="rf-button-secondary px-5 py-3.5 flex items-center gap-2 transition"
              >
                <ShieldCheck size={15} className="text-emerald-400" />
                <span>Try to Break It (Tamper Sandbox)</span>
              </Link>
            </div>

            <p className="mt-5 flex items-center gap-2 text-[11px] text-slate-400">
              <Check size={13} className="text-emerald-400" />
              Instant evaluation access<span className="mx-1 text-slate-700">/</span>Zero external API credentials required
            </p>
          </div>

          <div aria-label="Illustrative recovery workflow preview" className="relative rounded-2xl border border-slate-700/70 bg-[#0c1422] shadow-[0_30px_100px_#0008]">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div className="flex gap-1.5">{[1, 2, 3].map((n) => <span key={n} className="h-2 w-2 rounded-full bg-slate-700" />)}</div>
              <span className="text-[9px] tracking-widest text-slate-400">WORKSPACE PREVIEW · ILLUSTRATIVE</span>
              <Workflow size={15} className="text-emerald-400" />
            </div>
            <div className="p-5 sm:p-7">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300">Recovery, with clarity.</span>
                <span className="rounded border border-violet-400/20 bg-violet-400/10 px-2 py-1 text-[8px] font-semibold tracking-wider text-violet-300">DEMO</span>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3">
                {[['DETECTED', '01'], ['REVIEWED', '02'], ['VERIFIED', '03']].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                    <p className="text-[8px] tracking-widest text-slate-400">{label}</p>
                    <p className="mt-3 font-mono text-3xl font-light text-emerald-300">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 space-y-3">
                {[
                  { icon: ScanLine, title: 'Understand the failure', sub: 'A clear case, with a traceable decision', tag: 'DETECTED' },
                  { icon: ShieldCheck, title: 'Apply your boundaries', sub: 'Policy checks and independent review', tag: 'REVIEW' },
                  { icon: Fingerprint, title: 'Verify the outcome', sub: 'Record evidence before counting recovery', tag: 'OBSERVE' }
                ].map((step, i) => (
                  <div key={step.title}>
                    <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                      <div className="rounded-lg bg-emerald-400/10 p-2 text-emerald-300">
                        <step.icon size={17} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-200">{step.title}</p>
                        <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{step.sub}</p>
                      </div>
                      <span className="hidden font-mono text-[8px] text-slate-400 sm:inline">{step.tag}</span>
                    </div>
                    {i < 2 && <ArrowDown className="mx-auto mt-3 text-slate-400" size={13} />}
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center gap-2 border-t border-slate-800 pt-4 text-[10px] text-slate-400">
                <ShieldCheck size={13} className="text-emerald-400" />
                AI can advise. Your policies decide.
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-y border-slate-800/70 bg-slate-900/20">
          <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="text-[10px] font-semibold tracking-[.2em] text-emerald-400">FROM SIGNAL TO OUTCOME</p>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight">Less guesswork.<br />More accountable recovery.</h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-slate-400">A shared workspace for operators, analysts, and the people responsible for every customer interaction.</p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {[
                { n: '01', icon: Layers3, title: 'Bring the work into focus', text: 'Find cases, inspect amounts in their original currency, and make sense of recorded recovery activity.' },
                { n: '02', icon: Sparkles, title: 'Decide with context', text: 'See model estimates alongside actual outcomes. Get answers from recorded data, with visible provenance.' },
                { n: '03', icon: ShieldCheck, title: 'Keep your team in control', text: 'Require independent reviews, record reasons, and inspect the audit trail behind each decision.' }
              ].map((feature) => (
                <article key={feature.n} className="border-t border-slate-700 pt-6">
                  <div className="flex items-center justify-between">
                    <feature.icon size={23} className="text-emerald-300" />
                    <span className="font-mono text-xs text-slate-400">/{feature.n}</span>
                  </div>
                  <h3 className="mt-7 text-lg font-medium">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{feature.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="built-for-control" className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-2 lg:px-10">
          <div>
            <p className="text-[10px] font-semibold tracking-[.2em] text-emerald-400">TRUST IS IN THE DETAILS</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">Built to show its work.</h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-slate-400">
              A compelling demo should be honest about what is simulated. A real workspace should be explicit about what is connected. RecoverFlow separates the two.
            </p>
            <a href="https://github.com/skmdshariff143-ai/recoverflow-ai" className="mt-7 inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors">
              <Code2 size={17} />
              Explore the source
              <ArrowUpRight size={14} />
            </a>
          </div>
          <div className="space-y-0 divide-y divide-slate-800">
            {[
              ['Clear operating modes', 'Demo records stay in the demo environment. Sandbox and live installations require durable storage and real operator credentials.'],
              ['Exact financial records', 'Integer minor units preserve amounts. Currency-specific summaries avoid misleading combined totals.'],
              ['Evidence before claims', 'Review authorization, provider execution, and verified recovery are separate events.']
            ].map(([title, description]) => (
              <div key={title} className="py-5 first:pt-0">
                <h3 className="flex items-center gap-3 text-sm font-medium">
                  <Check size={15} className="text-emerald-400" />
                  {title}
                </h3>
                <p className="ml-7 mt-2 text-xs leading-6 text-slate-400">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-6 mb-16 rounded-2xl border border-emerald-400/15 bg-emerald-400/[.04] px-6 py-12 text-center lg:mx-auto lg:max-w-6xl">
          <p className="text-[10px] tracking-[.2em] text-emerald-400">YOUR NEXT RECOVERY STARTS WITH CLARITY</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">Take a look inside.</h2>
          <p className="mt-3 text-sm text-slate-400">Explore sample merchant operations, then inspect the engine in the benchmark lab.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/demo?tour=1" className="rf-button px-6">
              <span>Start Interactive Tour</span>
              <ArrowRight size={16} />
            </Link>
            <Link href="/login" className="rf-button-secondary px-6">
              <span>Open workspace</span>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 px-6 py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 text-[11px] text-slate-400">
          <div>
            <span>© {new Date().getFullYear()} RecoverFlow AI</span>
            <span className="mx-2 text-slate-700">·</span>
            <span>Transparent decisions. Thoughtful recovery.</span>
          </div>
          <nav aria-label="Footer navigation" className="flex flex-wrap items-center gap-6">
            <Link href="/privacy" className="hover:text-slate-200 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-slate-200 transition-colors">Terms of Service</Link>
            <Link href="/demo" className="hover:text-slate-200 transition-colors">Benchmark Lab</Link>
            <Link href="/login" className="hover:text-slate-200 transition-colors">Workspace</Link>
            <a href="https://github.com/skmdshariff143-ai/recoverflow-ai" target="_blank" rel="noopener noreferrer" className="hover:text-slate-200 transition-colors">GitHub ↗</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
