import type { Metadata } from 'next';
import Link from 'next/link';
import BenchmarkLab from '@/components/BenchmarkLab';

export const metadata: Metadata = {
  title: 'Benchmark Lab & Synthetic Evaluation',
  description: 'Inspect calibrated scoring models, 80 adversarial counterfactuals, Thompson Sampling policies, and cryptographic Merkle ledger walks.',
  alternates: {
    canonical: '/demo',
  },
};

export default function DemoPage() {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-400/20 bg-violet-950 px-5 py-3 text-xs text-violet-200">
        <span>BENCHMARK LAB &bull; Synthetic evaluation and simulated outcomes. No live merchant execution.</span>
        <Link href="/login" className="font-semibold underline underline-offset-4">Open merchant workspace &rarr;</Link>
      </div>
      <BenchmarkLab />
    </div>
  );
}
