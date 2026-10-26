# RecoverFlow AI — Enterprise Architecture Specification

## 1. System Overview
RecoverFlow AI is structured as a high-performance modular monorepo:
- `apps/web`: Next.js 16.3.5 App Router UI, SRE observability endpoints, and API route handlers.
- `packages/core`: Deterministic FinTech domain engine, state machines, integer math, Prisma data layer, and HMAC auth.
- `packages/agents`: Bounded Gemini multi-agent advisory layer, prompt injection scrubbers, and Zod schemas.
- `packages/jobs`: BullMQ background worker queue, outbox dispatchers, and notification channels.
- `packages/pixel`: Micro-beacon edge intent telemetry SDK (<2.8KB Brotli).
- `packages/shopify-app`: Shopify OAuth, webhook verification, and Admin GraphQL mutation adapters.

## 2. Ingestion & Recovery Data Flow
```
Storefront / Commerce Platform
  │ (Webhook / Edge Pixel)
  ▼
Secure Ingestion Gateway
  │ (HMAC Verification & Idempotency Check)
  ▼
Commerce Event Normalization
  │ (Atomic Database Transaction)
  ▼
PostgreSQL (Domain State + Outbox Event)
  │ (Outbox Dispatcher)
  ▼
Redis / BullMQ Worker Queue
  │ (Job Execution)
  ▼
Recovery Orchestrator
  ├── Recovery Score (Calibrated Logistic ML)
  ├── Policy Engine (Deterministic Rules & Quiet Hours)
  └── Margin Guardian (Thompson Sampling Bandit)
  │
  ▼
Dual-Custody Approval Gate (If > ₹10,000)
  │
  ▼
Execution Adapters (Razorpay Test Mode / WhatsApp / Email)
  │
  ▼
Outcome Observer & Append-Only SHA-256 Hash Chain Ledger
```

## 3. High-Value Approval Gate Thresholds & Verification Model
The recovery pipeline enforces three distinct, non-overlapping approval thresholds across simulation and production:
1. **₹10,000 Policy Threshold**: Any invoice with amount $> ₹10,000$ (1,000,000 paise) is classified as `high_value` and enters `APPROVAL_REQUIRED` status. Autonomous dispatch is halted.
2. **₹5,000 EV Simulation Threshold**: In offline benchmark evaluations and stochastic simulation suites (`simulateAutoApproval: true`), high-value invoices with expected recovery value $\ge ₹5,000$ (500,000 paise) are conditionally auto-approved to measure policy frontier yield without human interaction. This is strictly forbidden and code-blocked in `SANDBOX` and `LIVE` runtime modes (`getRuntimeMode()`).
3. **Two-Reviewer Console Path (Dual Custody)**: In the production operator console, executing high-value enterprise invoice recovery requires dual-custody verification (two independent reviewers / maker-checker sign-off with mandatory audit rationales) before dispatch.
