import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PayBack AI — Bounded, Explainable Recovery Orchestration for Failed Payments',
  description: 'Autonomous recovery engine with deterministic calibration, knapsack allocation, and cryptographic audit ledger.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#09090b] text-zinc-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
