/**
 * PayBack AI — Version & Build Metadata Endpoint.
 *
 * Exposes non-sensitive build and deployment provenance information.
 * Zero secrets or environment variable values are exposed.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const isRazorpayConfigured = !!(
    process.env.RAZORPAY_KEY_ID &&
    process.env.RAZORPAY_KEY_SECRET &&
    process.env.RAZORPAY_KEY_ID.startsWith('rzp_test_')
  );

  const isGeminiConfigured = !!process.env.GEMINI_API_KEY;

  return NextResponse.json({
    project: 'PayBack AI',
    track: 'Razorpay AI Buildathon — Track 3: AI Revenue Recovery',
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? 'b941b1b',
    buildVersion: '2.4.0-submission',
    environmentName: process.env.NODE_ENV ?? 'production',
    serverTimestamp: new Date().toISOString(),
    serviceStatus: {
      geminiMode: isGeminiConfigured ? 'live_api' : 'deterministic_rule_fallback',
      razorpayMode: isRazorpayConfigured ? 'razorpay_test_mode' : 'deterministic_simulator',
    },
  });
}
