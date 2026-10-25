# Changelog

All notable changes to RecoverFlow AI are documented in this file.

## [Unreleased] - 2026-10-25

### Security Hardening & Zero-State Honesty Release

#### Added
- **Route Authorization Engine (`authorizeRequest`)**: Granular RBAC permission checks across all API routes, validating bearer tokens or cookies against the durable session store.
- **Fail-Closed Webhook Verification**: Constant-time signature verification (`crypto.timingSafeEqual`) on Shopify and Razorpay raw request buffers. Added fail-closed 503 rejection on WhatsApp endpoints when app secrets are unconfigured.
- **Tenant Isolation Boundaries**: Webhooks received from unknown shop domains or telephone numbers in `SANDBOX` and `LIVE` modes return HTTP 200 `{ received: true, ignored: true }` without executing writes, sends, or GDPR erasures.
- **Zero-State Metrics & Honest Attribution**: Replaced synthetic padding (`Math.max`, fallback conversions, fabricated GMV) with honest computations derived from real records. Insufficient data returns `null` and renders an explicit "No data yet" state in the UI. Causal lift and gross margin models document assumptions transparently (`REPORT_ATTRIBUTION_CONFIG`).
- **Fail-Closed Subscription Handling**: Upstream Razorpay API failures return HTTP 502 instead of silent local fallbacks. The local simulated path is explicitly restricted to `DEMO`/`TEST` and tagged `simulated: true`.
- **Operator Console Decoupling**: Live chat intervention now authenticates via standard operator session cookies. The `x-admin-token` header is restricted to machine callers with constant-time verification.
- **High-Entropy Secret Enforcement**: Minimum 32-character secret length enforced in durable runtime modes (`SANDBOX`, `LIVE`) with immediate startup failure if unconfigured.
- **Documentation**: Added comprehensive `SECURITY.md` covering threat modeling, authorization flow, anonymous demo semantics, and architectural limitations.

#### Changed
- Universal error response sanitization (`internalErrorResponse`) prevents database error strings and stack traces from leaking to client responses.
- In-memory rate limiting tuned with per-route window quotas and bypass isolation.
