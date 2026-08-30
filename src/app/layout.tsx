import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PayBack AI — Bounded, Explainable Recovery Orchestration",
  description:
    "Bounded, explainable recovery orchestration for failed payments. Track 3: AI Revenue Recovery — Razorpay AI Buildathon.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-50 text-gray-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}
