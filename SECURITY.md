# RecoverFlow AI — Security Architecture & Threat Model

This document outlines the security architecture, authorization design, operational invariants, and known limitations of RecoverFlow AI.

---

## 1. Threat Model & Trust Boundaries

| Threat Category | Primary Risk | Mitigation |
| :--- | :--- | :--- |
| **Spoofing** | Forged webhooks from Shopify, Razorpay, or WhatsApp | Strict HMAC-SHA256 signature verification over raw request buffers using constant-time comparison (`crypto.timingSafeEqual`). Fails closed on unset secrets. |
| **Tampering** | Session token forgery or payload manipulation | Cryptographically signed HMAC-SHA256 session tokens with minimum 32-character entropy validation (`validateAuthSecret`). |
| **Repudiation** | Modification of audit events or recovery decisions | Append-only SHA-256 hash chain ledger for case events and policy decisions. |
| **Information Disclosure** | Internal stack traces or database errors leaked to callers | Universal error sanitization via `internalErrorResponse` (logs full error server-side, returns generic JSON message without `err.message`). |
| **Elevation of Privilege** | Cross-tenant data mutation or unauthorized manual interventions | Universal tenant scoping checks (`session.activeMerchantId`), role-based permission gates (`hasPermission`), and operator session requirements for live chat interventions. |
| **Denial of Service** | Webhook flooding, brute force login, or API abuse | Tiered rate limiting (`enforceRateLimit`) per client IP, fail-closed memory pressure thresholds, and outbox idempotency deduplication. |

---

## 2. Authentication Architecture

The system employs two distinct authorization layers:

### A. Console Guards (`requireSession`, `readSession`)
- **Target**: Internal operator console under `/app/api/console/*` and server-rendered console views.
- **Transport**: `HttpOnly`, `SameSite=Lax`, `Secure` (in HTTPS) cookies.
- **CSRF Protection**: `assertSameOrigin` enforces that all state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) originate strictly from the verified application origin (`APP_URL` or external Host header).
- **Session Verification**: Tokens are parsed and checked against `db.getSession(tokenHash)`. In durable modes (`SANDBOX` and `LIVE`), user organization membership and active merchant assignments are actively validated on every request.

### B. Route Authorization (`authorizeRequest`)
- **Target**: Public, integration, and recovery pipeline endpoints under `/app/api/*`.
- **Transport**: Authorization header (`Bearer <token>`) or session cookie.
- **Role Permissions**: Granular permissions (e.g. `policy:view`, `policy:modify`, `recovery:execute`, `support:intervene`, `integration:manage`) enforced via `ROLE_PERMISSIONS`.
- **Fail-Closed Principle**: If credentials are present but malformed, expired, or tampered, `authorizeRequest` returns `HTTP 401` immediately and **never** falls back to a demo persona.

---

## 3. Anonymous Demo Flag Semantics

- **Variable**: `RECOVERFLOW_ALLOW_ANON_DEMO`
- **Behavior**:
  - Anonymous bypass is active **ONLY** when `RECOVERFLOW_ALLOW_ANON_DEMO === 'true'` **AND** `getRuntimeMode()` is `'DEMO'` or `'TEST'`.
  - In `'SANDBOX'` and `'LIVE'`, `isAnonymousDemoEnabled()` unconditionally returns `false`, ensuring that production or staging instances never permit unauthenticated access.
  - Side-effecting operations (such as creating live Razorpay subscriptions or dispatching manual concierge messages) explicitly require a real authenticated session (`allowAnonymousDemo: false`) even when the demo flag is active.

---

## 4. Webhook Verification & Tenant Boundaries

- **Shopify**: Signed with `X-Shopify-Hmac-Sha256`. Verified using `crypto.timingSafeEqual` over the raw, unparsed request body.
- **Razorpay**: Signed with `X-Razorpay-Signature`. Verified via HMAC-SHA256 over raw body.
- **WhatsApp**: Verified with `X-Hub-Signature-256` and app secret. If `WHATSAPP_APP_SECRET` or `WHATSAPP_VERIFY_TOKEN` is unset in the environment, endpoints fail closed with 503 / 403.
- **Tenant Isolation**:
  - In `DEMO` and `TEST` modes, webhooks without an explicit shop domain or phone mapping fall back to the demo store for evaluation purposes.
  - In `SANDBOX` and `LIVE` modes, incoming payloads from unknown shop domains or telephone numbers return `HTTP 200` with `{ received: true, ignored: true }` (to satisfy retry policies) without performing any writes, dispatching any messages, or modifying GDPR records.

---

## 5. Idempotency & Concurrency

- **Idempotency Key Enforcement**: Ingestion and execution endpoints enforce unique composite idempotency keys (`idempotencyKey + merchantId`) with time-to-live expiration.
- **Atomic Execution Locks**: Recovery execution acquires an in-memory lock on the target payment or cart identifier during evaluation and dispatch to prevent concurrent double-spend or duplicate customer messaging.

---

## 6. Known Limitations

In the interest of full transparency and honesty, the following architectural trade-offs exist:

1. **Unanchored Hash Chain**:
   The internal audit log utilizes an SHA-256 Merkle-style hash chain linking previous event hashes to the current record. However, the chain is not anchored to a public blockchain or signed with an external hardware security module (HSM) private key. An attacker possessing direct database write access could recalculate and replace the entire chain.
2. **In-Memory Rate Limiting & Locks (Single-Process Fallback)**:
   When running without Redis (`REDIS_URL` unconfigured), rate limiting counters and execution locks reside in-process. In a horizontally scaled cluster, distributed synchronization requires Redis.
3. **Application-Level Tenant Scoping**:
   Multi-tenancy isolation is enforced at the application data layer (`assertTenantScoping` and Prisma query predicates). Database-level Row-Level Security (RLS) is not currently implemented in PostgreSQL.
