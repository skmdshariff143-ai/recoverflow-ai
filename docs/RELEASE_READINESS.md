# Release readiness

Updated 18 September 2026. This document describes the current code and locally observed checks. It does not certify a production payment system.

## What changed

The repository combined a synthetic benchmark, provider experiments, and merchant operations in one dashboard. The new public site and authenticated console separate those concerns: `/demo` retains the evaluation lab, while merchant routes use server-authorized, tenant-scoped APIs and explicit data provenance.

| Area | Implemented behavior |
| --- | --- |
| Identity | Signed HttpOnly sessions, server-side revocation, mode binding, current durable membership checks, scrypt password verification, and an operator provisioning command. Durable login rate limiting uses Redis and fails closed. |
| Case management | Server-side search, filtering, sorting and pagination; exact case deep links; missing-case responses; role-controlled CSV export. |
| Reviews | Two distinct reviewers with required reasons, duplicate protection, and atomic PostgreSQL review/state/audit writes. Approval changes eligibility, never payment success. |
| Financial values | Integer minor units throughout the new console, string serialization, currency-aware formatting, separate currency totals, and escaped CSV cells. Estimates are labelled as estimates. |
| Observability | Recorded message history, masked customer/cart references, audit hash verification, and actual database/authentication/Redis readiness checks. |
| Policy | Validated, persisted brand voice and discount settings with server-side role enforcement. |
| Copilot | Read-only answers derived from workspace records with source links. This is deterministic analysis; it is not a connected language model. |
| Interaction | Responsive navigation, command palette, native dialogs, keyboard support, loading/error/empty states, focus styles and reduced-motion support. |
| Demo separation | Explicit simulated provenance, in-process sample identities/data, local QR generation, simulated subscription actions, and blocked direct provider operations. Real provider keys do not activate demo channel adapters. |
| Delivery | CI checks, schema migration, non-root Docker recipe, optional local durable Compose profile, deployment instructions and a focused console regression suite. |

## Verification

Verified locally against Next.js 16.3.5. Test outcomes are evidence for the exercised paths, not a guarantee of universal correctness.

| Check | Result |
| --- | --- |
| ESLint and TypeScript | Passed |
| Unit/application contracts | 465 passed across 79 files |
| Health/readiness contracts | 2 passed |
| Offline advisory-agent scenarios | 50 evaluated successfully |
| Synthetic artifact integrity | Passed |
| Prisma schema validation | Passed |
| Next.js production build | Passed |
| Production dependency audit | 0 known vulnerabilities reported by npm |
| Full Chromium browser regression | 73 passed against the production build, including all 7 merchant-console journeys |

- ESLint and TypeScript checks are part of `npm run verify:core`.
- Unit and application contracts cover authentication, origin checks, tenant boundaries, authorization, review conflicts, exact financial values, subscriptions, and stale idempotency commits.
- The offline advisory-agent harness evaluates 50 fixed scenarios; it does not measure live model quality.
- Artifact verification checks the committed synthetic benchmark manifests.
- Playwright covers the merchant console and retained benchmark workflows. The console includes automated WCAG A/AA checks and a 390 px mobile navigation/overflow check. Automated accessibility checks are not a complete manual accessibility audit.
- PostgreSQL review concurrency tests were added, but real PostgreSQL/Redis and durability suites have not been run on this workstation. Docker and local database service executables were unavailable. CI contains these service-backed jobs; their results must be observed before release.
- Docker configuration was reviewed, but the container image has not been built here.

Next.js and its ESLint configuration are pinned to 16.3.5. The previous version was affected by [the Windows server advisory](https://github.com/advisories/GHSA-p293-qw3h-jr36) and [the image optimization advisory](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4). Dependency scanning is a point-in-time check and should remain part of release maintenance.

## Scope and data limits

- Console summary and CSV export: the latest 500 cases. The case table independently searches and paginates the full merchant case set. Summary figures are not an all-time accounting ledger.
- Cart view: up to 200 records. Message history and displayed audit history: the latest 100 records each. Audit verification: the first 10,000 events.
- Demo data and sessions are shared by users of one demo server and reset when it restarts. Demo mode requires one web process.
- Recovery probabilities come from stored case values. The console does not invent confidence, causal lift, settlement, delivery, or recovery outcomes.
- Customer references are masked, but recorded message bodies may contain personal information. A retention/redaction policy is still required for real merchant data.
- The owner, admin, recovery manager, analyst, viewer and support roles have financial console access according to the permission matrix. The developer role lacks financial access and cannot load the current general-purpose console; a dedicated developer-only workspace remains to be built.
- Existing users with no password hash cannot use password sign-in. The provisioning command creates new identities and does not silently overwrite credentials.

## Remaining work before live provider activation

SANDBOX and LIVE support durable authenticated console configuration. They deliberately reject inherited provider/ingestion endpoints with HTTP 503. Setting the environment to LIVE does not activate recovery jobs, payment actions, or messaging.

1. Complete tenant-bound provider credential onboarding and rotation, signed webhook verification, replay handling, and provider-specific sandbox contracts for Shopify, Razorpay, WhatsApp, email and voice.
2. Connect case eligibility to dispatch through verified consent/suppression, retry and dead-letter procedures, execution idempotency, and provider outcome reconciliation. Validate real payment state transitions with provider sandbox accounts.
3. Run fresh-database migrations, PostgreSQL/Redis suites, worker restart/replay tests, and a full container smoke test against disposable infrastructure.
4. Add self-service invitations, credential recovery or SSO, merchant selection for multi-store organizations, dedicated developer access, and complete account lifecycle controls.
5. Bring durable subscriptions and payment promises into the new console. These currently remain explicitly isolated evaluation workflows.
6. Implement full export/ledger pagination, configuration-change audit transactions, data retention/redaction, backup/restore drills, monitoring and alerting.
7. Verify HTTPS ingress, production secret rotation, capacity, incident recovery and independent security/accessibility review with the intended deployment environment.

No live provider calls, external customer messages, deployment, GitHub push, or production data migration were performed during this upgrade. The local changes preserve the pre-existing UI work and documentation screenshots.
