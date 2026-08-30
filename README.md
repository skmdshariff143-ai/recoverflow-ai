# PayBack AI

**Predictive Revenue Recovery & Prioritization Engine** — Razorpay AI Buildathon, Track 3: AI Revenue Recovery.

Given a batch of failed/at-risk payments, predict each payment's probability of recovery and expected recovered value, rank the full queue by expected value, allocate a limited recovery budget to the highest-value items first, execute the chosen intervention in test mode, then measure actual recovery against prediction to prove the scoring is calibrated — not guesswork.

---

## What's Implemented

### ✅ Milestone 1 — Scaffold + Synthetic Data Generator

- **Project scaffold**: Next.js 16 + TypeScript, structured with `src/lib/engine` (framework-agnostic business logic), `src/lib/ai` (optional LLM layer, isolated), `src/components`, `src/hooks`.
- **Tooling**: ESLint, Vitest (unit), Playwright (e2e), GitHub Actions CI.
- **Synthetic data generator** (`src/lib/engine/generateData.ts`):
  - Produces ≥100 failed-payment records with full customer payment history.
  - Evenly distributed across 10 failure categories.
  - Deterministic seeding + randomized mode.
  - Customer histories correlated to failure category (reliable payers get infrastructure failures, risky payers get broken promises).
  - Pre-generated fixture: `data/synthetic-payments.json`.
- **15 unit tests**: record count, distribution, field validation, uniqueness, determinism, opt-out, quiet-hours, customer history structure + correlation, high-value tiers, gateway errors.

### ✅ Milestone 2 — Deterministic Scoring Engine

- **Scoring Engine** (`src/lib/engine/scoreRecovery.ts`):
  - Category-anchored proportional scoring formula with named constants (no magic numbers).
  - Calculates `recovery_probability` (0–1), `expected_value` (`probability × amount`).
  - 6-factor structured explanations sorted by contribution magnitude for human-review drill-down.
  - Category base rates anchor recovery ceiling (e.g., `bank_downtime`: 0.78 vs `permanent_account_closure`: 0.02).
- **37 total unit tests** across data generation and scoring engine.
- **Empirical Batch Results (100 synthetic payments)**:
  - Infrastructure failures (`gateway_degradation`, `bank_downtime`): ~75% avg recovery probability.
  - Deduplication & transient failures (`duplicate_attempt`, `auth_failure`, `expired_card`): ~45–68% avg.
  - High-friction / behavioral issues (`insufficient_funds`, `invalid_mandate`): ~26–33% avg.
  - Hard stops & high-risk (`broken_promise_to_pay`, `customer_cancellation`, `permanent_account_closure`): 1.6–8.8% avg.

### ✅ Milestone 3 — Ranking, Budget Allocation & Safety Rules

- **Safety-Rule Filter** (`src/lib/engine/safetyFilter.ts`):
  - Hard cap at 3 recovery attempts (`max_attempts_exceeded`).
  - Zero retries for permanent account closure or hard cancellations (`non_recoverable_category`).
  - Zero contact for opted-out customers (`customer_opted_out`).
  - Ineligible items are never deleted; they flow through as audited `stopped` records.
- **High-Value Approval Gate** (`src/lib/engine/approvalGate.ts`):
  - High-value invoices gated behind merchant approval (`pending_approval`).
- **Quiet-Hours Scheduler** (`src/lib/engine/quietHours.ts`):
  - Timezone-aware contact scheduler ensuring zero customer disturbance during local quiet hours.
- **Queue Ranking & Budget Allocation** (`src/lib/engine/rankAndAllocate.ts`):
  - Actionable items ranked strictly descending by `expected_value`.
  - Limited contact budget (default: 40 slots) allocated to top-ranked items (`budgeted`), remainder safely `deferred`.
- **62 total unit tests** across safety rules, quiet hours, approval gating, ranking, and budget allocation.

### ○ Milestone 4 — Test-Mode Execution + Calibration (next)
### ○ Milestone 5 — Dashboard, Drill-down, Audit Explorer
### ○ Milestone 6 — Polish, README, Screenshots

---

## Pipeline Architecture

```
Payment events
  → Feature extraction (category, history, value tier, recency, attempts)
  → Recovery-probability score + expected value per payment
  → Rank queue by expected value; allocate limited budget to top-N
  → For each budgeted item: select intervention → execute in test mode
  → Compare predicted vs actual recovery (calibration check)
  → Every step writes to immutable audit trail
```

## Safety Rules

Enforced in code, proven by automated tests (Milestone 3):

1. **Hard cap**: Max 3 recovery attempts per payment.
2. **Never retry** permanent failures (account closure, hard cancellation).
3. **Never contact** opted-out customers.
4. **Respect quiet hours** before scheduling contact.
5. **Mask sensitive data** everywhere — last 4 digits only.
6. **Human approval** required for high-value invoices above threshold.
7. **Stop on success** — immediately cease retries.
8. **Stop on dispute/cancellation** — immediately cease retries.
9. **Immutable audit trail** — every decision logged.

## Failure Categories

| # | Category | Description |
|---|----------|-------------|
| 1 | `insufficient_funds` | Account balance too low |
| 2 | `bank_downtime` | Issuing bank unreachable |
| 3 | `auth_failure` | 3DS/OTP authentication failed |
| 4 | `expired_card` | Card validity period lapsed |
| 5 | `invalid_mandate` | e-NACH mandate revoked/expired |
| 6 | `duplicate_attempt` | Idempotency key collision |
| 7 | `customer_cancellation` | Customer-initiated cancellation |
| 8 | `gateway_degradation` | Temporary gateway performance issue |
| 9 | `permanent_account_closure` | Account permanently closed |
| 10 | `broken_promise_to_pay` | Missed promised payment date |

## Getting Started

```bash
npm install                    # install dependencies
npm run generate:data          # generate data/synthetic-payments.json
npm test                       # run unit tests
npm run lint                   # lint
npm run type-check             # type-check
npm run build && npm run test:e2e  # build + E2E
npm run dev                    # start dev server
```

## Tech Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Recharts · Zod · Vitest · Playwright · GitHub Actions

---

*Built for the Razorpay AI Buildathon — Track 3: AI Revenue Recovery.*
