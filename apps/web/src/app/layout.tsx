import type { Metadata, Viewport } from 'next';
import './globals.css';

const siteUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://recoverflow-ai-kohl.vercel.app';

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'RecoverFlow AI — Revenue recovery, under control',
    template: '%s · RecoverFlow AI',
  },
  description: 'A transparent workspace for failed payments, recovery decisions, merchant policies, and accountable human review.',
  keywords: [
    'Revenue Recovery',
    'Payment Recovery',
    'Failed Checkout Recovery',
    'FinTech Operations',
    'Cart Abandonment',
    'Deterministic Guardrails',
    'Thompson Sampling',
    'Dual Custody Approval',
    'Merkle Audit Ledger',
  ],
  authors: [{ name: 'RecoverFlow AI Engineering' }],
  creator: 'RecoverFlow AI',
  publisher: 'RecoverFlow AI',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'RecoverFlow AI — Autonomous Revenue Recovery with Deterministic Control',
    description: 'A transparent workspace for failed payments, recovery decisions, merchant policies, and accountable human review.',
    url: siteUrl,
    siteName: 'RecoverFlow AI',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'RecoverFlow AI — Intelligent Recovery, Human Control',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RecoverFlow AI — Revenue Recovery, Under Control',
    description: 'A transparent workspace for failed payments, recovery decisions, merchant policies, and accountable human review.',
    images: ['/opengraph-image'],
    creator: '@recoverflow',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/manifest.webmanifest',
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
