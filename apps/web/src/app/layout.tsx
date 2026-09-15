import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RecoverFlow AI — Enterprise Cart & Checkout Recovery Platform',
  description: 'Autonomous AI cart and checkout recovery engine for Shopify and WooCommerce with WhatsApp Cloud API and Resend email fallback.',
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
