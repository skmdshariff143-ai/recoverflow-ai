# RecoverFlow AI — System Architecture & Data Flow

> **Submission Document**: Razorpay AI Buildathon · Track 3: AI Revenue Recovery  
> **Repository**: [https://github.com/skmdshariff143-ai/recoverflow-ai](https://github.com/skmdshariff143-ai/recoverflow-ai)

---

## 1. Architectural Overview

RecoverFlow AI is structured into decoupled, single-responsibility layers:

```
                      ┌────────────────────────────────────────┐
                      │    Failed Payment Event Ingestion      │
                      └───────────────────┬────────────────────┘
                                          │
                                          ▼
                      ┌────────────────────────────────────────┐
                      │    Deterministic Scoring Engine (M2)   │
                      │    - Logistic Regression (v1.1.0)      │
                      │    - 6-Factor Feature Extraction       │
                      │    - Integer-Paise EV Calculation      │
                      └───────────────────┬────────────────────┘
                                          │
                                          ▼
                      ┌────────────────────────────────────────┐
                      │    Safety Rule & Eligibility Filter    │
                      │    - Customer Opt-out Check            │
                      │    - Permanent Account Filter          │
                      │    - 3-Attempt Maximum Hard Cap        │
                      └───────────────────┬────────────────────┘
                                          │
                                          ▼
                      ┌────────────────────────────────────────┐
                      │    High-Value Human Approval Gate      │
                      │    - Invoices > ₹10,000 stopped        │
                      │    - Operator ID & Notes Mandatory     │
                      └───────────────────┬────────────────────┘
                                          │
                                          ▼
                      ┌────────────────────────────────────────┐
                      │    Closed-Loop State Machine           │
                      │    - Quiet-Hours Scheduling            │
                      │    - Multi-Cycle Attempt Progression   │
                      └───────────────────┬────────────────────┘
                                          │
                        ┌─────────────────┴─────────────────┐
                        ▼                                   ▼
        ┌───────────────────────────────┐   ┌───────────────────────────────┐
        │  Deterministic Simulator      │   │  Razorpay Test-Mode Adapter   │
        │  - In-Memory State Binding    │   │  - Payment Links API          │
        │  - Reproducible Benchmarking  │   │  - Proactive Status Polling   │
        └───────────────┬───────────────┘   └───────────────┬───────────────┘
                        │                                   │
                        └─────────────────┬─────────────────┘
                                          │
                                          ▼
                      ┌────────────────────────────────────────┐
                      │  Cryptographic SHA-256 Audit Ledger    │
                      │  - Append-Only Hash Chain              │
                      │  - Tamper & Deletion Detection         │
                      └────────────────────────────────────────┘
```

---

## 2. Core Invariants

1. **Financial Integrity**: Minor units (integer paise) strictly enforced across all arithmetic.
2. **Evaluative Decoupling**: Ground-truth potential outcomes are frozen independently of model scores.
3. **Execution Safety**: Bounded within official Razorpay test mode; live keys (`rzp_live_*`) are blocked at runtime.
4. **Advisory AI**: Gemini language models provide zero financial or state-machine decisions.
