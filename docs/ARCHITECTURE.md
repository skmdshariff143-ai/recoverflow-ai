# RecoverFlow AI — Enterprise Architecture Specification

## 1. System Overview
RecoverFlow AI is structured as a high-performance modular monorepo:
- `apps/web`: Next.js 16.3.2 App Router UI, SRE observability endpoints, and API route handlers.
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
