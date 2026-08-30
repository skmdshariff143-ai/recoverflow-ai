# RecoverFlow AI — Submission Package

> **Track**: Razorpay AI Buildathon — Track 3: AI Revenue Recovery  
> **Repository**: [https://github.com/skmdshariff143-ai/recoverflow-ai](https://github.com/skmdshariff143-ai/recoverflow-ai)  
> **Live Demo**: [https://recoverflow-ai-kohl.vercel.app](https://recoverflow-ai-kohl.vercel.app)

---

## 1. Executive Summary

**RecoverFlow AI** is a bounded, explainable revenue recovery orchestration platform designed for high-volume merchants. Rather than executing blind, scheduled retries across all failures, RecoverFlow AI ingests failed payment records, computes deterministic recovery probabilities and expected value in integer paise, enforces hard safety stopping invariants, coordinates closed-loop multi-cycle recovery with quiet-hours protection, and maintains a tamper-evident SHA-256 cryptographic audit ledger.

---

## 2. Evidence & Verification Checklist

- [x] **Product Identity & Claim Integrity**: Standardized name RecoverFlow AI, honest metric labels ("Simulated Recovered", "Observed in reported evaluation"), visible Data Provenance selector.
- [x] **Financial Correctness**: Strict integer-paise representation ($1\text{ INR} = 100\text{ Paise}$), basis points EV math, negative/float rejection, overflow protection, currency segregation.
- [x] **Honest Non-Circular Evaluation**: Evaluated against frozen independent potential outcome matrices. Zero self-fulfilling prediction loops.
- [x] **Benchmarked Against Control Policies**: Tested on 200 Development Records and 80 Held-Out Adversarial Cases against Fixed Retry Control, Retry-All Control, and High-Confidence Only.
- [x] **Closed-Loop Multi-Cycle State Machine**: Deterministic state machine (`DETECTED` $\to$ `DIAGNOSED` $\to$ `SCHEDULED` $\to$ `EXECUTING` $\to$ `OUTCOME_OBSERVED` $\to$ `RECOVERED` / `STOPPED`) with channel switching and quiet-hours scheduling.
- [x] **Execution Adapter Boundary**: Deterministic Simulator (offline reproducible) and Razorpay Test-Mode Adapter (server-side with graceful fallback).
- [x] **Bounded Gemini 2.5 AI Copilot**: Grounded assistant for unstructured error log normalization and compliant communication drafting.
- [x] **Tamper-Evident SHA-256 Hash Chain Ledger**: Cryptographic verification of all audit events with real-time mutation detection.
- [x] **Quality Gates**: 128 unit tests passing across 18 suites, 11 Playwright E2E browser tests passing across 5 viewports, 0 ESLint warnings, 0 TypeScript errors, clean Next.js 16 production build.

---

## 3. Benchmark Verification Results

| Evaluation Metric | RecoverFlow AI (EV Prioritization) | Fixed Retry Control (First 40 Eligible) | Incremental Impact (Δ) |
| :--- | :---: | :---: | :---: |
| **Cohort Size** | 200 Invoices (₹33,94,800 at risk) | 200 Invoices (₹33,94,800 at risk) | — |
| **Interventions Budgeted** | **40 slots** | 40 slots | 0 (Equal capacity) |
| **Invoices Recovered** | **27 / 40 (67.5%)** | 10 / 40 (25.0%) | **+17 invoices (+170%)** |
| **Simulated Recovered Revenue** | **₹4,76,823.00** | ₹83,664.00 | **+₹3,93,159.00 (+470%)** |
| **Estimated Intervention Cost** | **₹486.00** | ₹480.00 | +₹6.00 |
| **Net Simulated Recovery** | **₹4,76,337.00** | ₹83,184.00 | **+₹3,93,153.00 (+473%)** |
| **Unsafe Actions (Opt-Out / Closed)** | **0 (0 violations observed)** | 0 | 0 |
| **Opt-Out Violations** | **0 (0 violations observed)** | 0 | 0 |
| **Independent Brier Score** | **0.1637** | — | Calibrated probability accuracy |

---

## 4. Five-Minute Pitch & Demonstration Script

1. **0:00 – 0:35 (Problem)**: Open Dashboard. Explain how blind retries burn fees on closed accounts and annoy reliable customers during bank downtime.
2. **0:35 – 1:50 (Closed-Loop Demo)**: Click Rank #1 invoice. Walk through the 6-factor waterfall, quiet-hours calculation, and simulated outcome clearance.
3. **1:50 – 2:45 (Safety Invariants)**: Filter by "Stopped". Show immediate non-negotiable halting of customer opt-outs, max attempt caps, and closed accounts.
4. **2:45 – 3:35 (Evaluation Lab)**: Switch to Evaluation Lab tab. Demonstrate the +470% net revenue recovery over Fixed Retry Control on identical frozen outcomes.
5. **3:35 – 5:00 (Integrity & Governance)**: Switch to Audit Ledger tab. Show the SHA-256 hash-chain verification badge and explain why AI is advisory-only.
