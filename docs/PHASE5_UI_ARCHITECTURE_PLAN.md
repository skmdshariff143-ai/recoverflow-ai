# RecoverFlow AI — Phase 5 UI Architecture Plan
## Professional FinTech SaaS Product Experience & AI Operations Console

> **Version**: 1.0.0  
> **Date**: 2026-09-18  
> **Standard**: Stripe Precision + Razorpay Clarity + Linear Craftsmanship + Palantir Operational Intelligence

---

## 1. Architectural Strategy & Route Hierarchy

We will decompose the monolithic client switchboard in `apps/web/src/app/page.tsx` into a clean Next.js 16 App Router route group architecture:

```
apps/web/src/app/
├── (public)/
│   ├── page.tsx                      # Premium Landing Page & Demo Gateway
│   ├── login/page.tsx                # Professional Sign-In & Session Authentication
│   └── demo/page.tsx                 # Demo Presentation & Judge Evaluation Suite
│
└── (app)/
    ├── layout.tsx                    # Shared Enterprise App Shell (Sidebar + Top Bar)
    ├── overview/page.tsx             # Executive & Operator Command Center
    ├── recovery/
    │   ├── queue/page.tsx            # Operational Ranked Recovery Queue (Server-Paginated)
    │   ├── cases/page.tsx            # Recovery Cases Directory
    │   ├── cases/[caseId]/page.tsx   # Deep Operational Case Screen (Timeline, Economics, Decisions)
    │   ├── approvals/page.tsx        # Dual-Custody Approval Center
    │   └── promises/page.tsx         # Promise-to-Pay Tracker
    ├── customers/page.tsx            # PII-Masked Customer Recovery Profiles
    ├── commerce/
    │   ├── carts/page.tsx            # Abandoned Carts Explorer
    │   ├── payments/page.tsx         # Payment Transactions Ledger
    │   └── subscriptions/page.tsx    # Razorpay Subscriptions Portfolio
    ├── intelligence/
    │   ├── copilot/page.tsx          # Operator Intelligence Interface (Authorized Typed Tools)
    │   ├── experiments/page.tsx      # MAB Experimentation & Lift Tracking
    │   └── model-lab/page.tsx        # Calibration, Brier Scores & Model Diagnostics
    ├── analytics/page.tsx            # Multi-Dimensional Revenue Analytics & Funnels
    ├── communications/page.tsx       # Message Logs & Delivery Telemetry
    ├── audit/page.tsx                # Tamper-Evident SHA-256 Merkle Audit Ledger
    ├── integrations/page.tsx         # Provider Connections (Razorpay, Shopify, WhatsApp)
    ├── operations/page.tsx           # Infrastructure Console (Postgres, Redis, BullMQ, Outbox)
    ├── policies/page.tsx             # Versioned Merchant Recovery Policies
    ├── developers/page.tsx           # Webhook Specs, API Keys & Schemas
    ├── team/page.tsx                 # 7-Role RBAC Team Directory
    └── settings/page.tsx             # Organization & Security Settings
```

---

## 2. Server vs Client Component Boundary

| Component Type | Primary Responsibility | Examples |
| :--- | :--- | :--- |
| **Server Components** | Initial layout rendering, cookie/session authentication, initial DB prefetching, metadata injection, static shell | `(app)/layout.tsx`, `overview/page.tsx`, `cases/[caseId]/page.tsx`, `integrations/page.tsx` |
| **Client Components** | Interactive tables with sorting/filtering, modal dialogs, real-time streams, command palette, Copilot chat | `DataTable.tsx`, `CopilotChat.tsx`, `CommandPalette.tsx`, `ApprovalActions.tsx`, `LiveRecoveryRunner.tsx` |

---

## 3. Visual Tokens & Design System

1. **Color Palette & Accents**:
   - Backgrounds: Dark neutral slate (`bg-slate-950`, `bg-slate-900/60`, `border-slate-800/80`) with clean contrast.
   - Financial Metric Colors:
     - Recovered / Success: Emerald (`text-emerald-400`, `bg-emerald-500/10`, `border-emerald-500/20`)
     - Risk / Failed: Rose (`text-rose-400`, `bg-rose-500/10`, `border-rose-500/20`)
     - Warning / Attention: Amber (`text-amber-400`, `bg-amber-500/10`, `border-amber-500/20`)
     - AI Advisory Accent: Indigo/Violet (`text-violet-400`, `bg-violet-500/10`, `border-violet-500/20`)
     - Deterministic Policy Accent: Cyan/Blue (`text-cyan-400`, `bg-cyan-500/10`, `border-cyan-500/20`)
2. **Typography**:
   - Monetary values rendered with `tabular-nums` and integer minor unit formatters (`₹1,499.00`).
3. **Runtime Mode Indicators**:
   - `DEMO`: Violet badge with informational label.
   - `SANDBOX`: Amber badge with test mode indicator.
   - `LIVE`: Emerald production badge with real-infrastructure connection confirmation.

---

## 4. Phased Implementation Sequence

1. **Phase 5.1: Shared Design Primitives & App Shell**
   - Create `components/shared/` design tokens, `Money.tsx`, `StatusBadge.tsx`, `MetricCard.tsx`, `DataTable.tsx`, `CommandPalette.tsx`.
   - Create `(app)/layout.tsx`, `AppSidebar.tsx`, `AppHeader.tsx`.
2. **Phase 5.2: Public Landing, Login & Demo Presentation**
   - Create `(public)/page.tsx`, `(public)/login/page.tsx`, `(public)/demo/page.tsx` (encapsulating judge pitch, tamper demo, and benchmark suite).
3. **Phase 5.3: Core Operational Screens**
   - Implement `/overview`, `/recovery/queue`, `/recovery/cases/[caseId]`, `/recovery/approvals`, `/recovery/promises`.
4. **Phase 5.4: Commerce, Intelligence & Analytics**
   - Implement `/commerce/*` (carts, payments, subscriptions).
   - Implement `/intelligence/*` (copilot, experiments, model-lab).
   - Implement `/analytics` and `/communications`.
5. **Phase 5.5: Enterprise Governance & Infrastructure**
   - Implement `/audit` (Merkle hash verification), `/integrations`, `/operations`, `/policies`, `/developers`, `/team`, `/settings`.
6. **Phase 5.6: Full Verification & E2E Validation**
   - Create `tests/e2e/productJourney.spec.ts`.
   - Run full Playwright test suite (65+ tests), unit tests, lint, and build.
   - Update documentation and truth matrix.
