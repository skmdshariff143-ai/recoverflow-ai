# RecoverFlow AI — Production Engineering Roadmap

> **Standard**: Production FinTech Orchestration Architecture  
> **Prioritization**: P0 (Production Data & Security Core), P1 (Durable Orchestration & Observability), P2 (Enterprise UX & Polish)  

---

## 🎯 Prioritization Framework

```
┌─────────────────────────────────────────────────────────────────────────┐
│ P0: CRITICAL PATH (Data Integrity, Security, Auth, Multi-Tenancy)       │
├─────────────────────────────────────────────────────────────────────────┤
│ • Normalized PostgreSQL schema with 21 core entities                    │
│ • Universal tenant scoping (Organization / Merchant / User / RBAC)      │
│ • Secure session-based authentication & route protection                │
│ • Authoritative Razorpay Webhook Gateway + HMAC + Idempotency Store     │
│ • Canonical Benchmark Manifest (data/benchmarks/benchmark-manifest.json)│
│ • Strict Integer Paise & Bounded Advisory AI Invariants                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ P1: DURABLE WORKFLOWS, AI GOVERNANCE & OBSERVABILITY                   │
├─────────────────────────────────────────────────────────────────────────┤
│ • Transactional Outbox Pattern & Durable State Transitions              │
│ • Bounded Gemini Client with Zod validation, timeouts & fallback        │
│ • Append-Only Cryptographic Audit Ledger persisted to PostgreSQL        │
│ • Promise-to-Pay lifecycle state machine & dynamic policy influence     │
│ • Health & Readiness probes (/api/health, /api/ready)                   │
│ • Structured JSON correlation logging (requestId, durationMs, status)   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ P2: ENTERPRISE CONSOLE UX, ONBOARDING & PORTFOLIO PACKAGING            │
├─────────────────────────────────────────────────────────────────────────┤
│ • Enterprise App Shell (12 workspace navigation, merchant switcher)     │
│ • Dual-Mode (DEMO vs LIVE) toggle with zero credential requirement      │
│ • First-Time Organization & Merchant Onboarding Wizard                  │
│ • Comprehensive Security Threat Model (docs/THREAT_MODEL.md)            │
│ • Unified Documentation (README.md, ARCHITECTURE.md, RUNBOOK.md)        │
│ • 100% Green CI Matrix with Automated Benchmark & Schema Verification   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📅 Detailed Execution Milestones

### Phase 1: P0 Foundations (Data Layer & Multi-Tenancy)
- [x] **Schema Design**: Create full normalized Prisma schema with 21 entities:
  - `Organization`, `Merchant`, `User`, `Membership`, `RecoveryPolicy`
  - `Customer`, `Payment`, `PaymentFailure`, `RecoveryCase`, `RecoveryAttempt`
  - `RecoveryDecision`, `RecoveryOutcome`, `PromiseToPay`, `ApprovalRequest`
  - `WebhookEvent`, `Integration`, `AuditEvent`, `ModelPrediction`, `ModelVersion`
  - `Notification`, `IdempotencyKey`
- [x] **Repository Layer**: Implement repository/service pattern separating domain logic from database drivers.
- [x] **RBAC Engine**: Implement server-side role-based access control (`OWNER`, `ADMIN`, `RECOVERY_MANAGER`, `ANALYST`, `VIEWER`).
- [x] **Canonical Benchmark Manifest**: Create `data/benchmarks/benchmark-manifest.json` to drive all benchmark metrics deterministically.

### Phase 2: P1 Orchestration & Integration
- [x] **Unified Webhook Gateway**: Harden `/api/webhooks/razorpay` with HMAC verification, deduplication, and atomic outbox writes.
- [x] **Durable State Machine**: Enforce validated state transitions (`DETECTED` → `DIAGNOSED` → `ELIGIBILITY_CHECKED` → `SCHEDULED` → `EXECUTING` → `OUTCOME_OBSERVED`).
- [x] **AI Advisory Hardening**: Zod-bounded Gemini outputs with automatic deterministic fallback.
- [x] **Observability Endpoints**: Standardize `/api/health` and `/api/ready` with structured JSON response standards.

### Phase 3: P2 Polish & Documentation
- [x] **Brand Consolidation**: Align on **RecoverFlow AI** across all docs, headers, and metadata.
- [x] **Comprehensive Docs Suite**: Create `docs/THREAT_MODEL.md`, `docs/DATABASE.md`, `docs/AI_GOVERNANCE.md`, `docs/OPERATIONS_RUNBOOK.md`, `docs/RAZORPAY_INTEGRATION.md`.
- [x] **Full CI/CD Verification**: Run lint, type-check, vitest (442+ tests), playwright (65+ tests), and live Vercel rehearsal.
