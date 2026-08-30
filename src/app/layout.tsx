import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PayBack AI — Predictive Revenue Recovery",
  description:
    "Predict recovery probability, prioritize by expected value, and prove calibration. Razorpay AI Buildathon Track 3.",
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
