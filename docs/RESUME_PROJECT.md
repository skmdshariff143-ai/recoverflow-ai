# RecoverFlow AI (PayBack AI) — Resume & Portfolio Guide

> **Portfolio Specification for Technical Recruiters, Engineering Managers, and Interviewers**  
> *Tailored resume bullets, technical keyword inventory, and structured elevator pitches.*

---

## 📄 Bullet Points for Resumes & CVs

### Option A: AI / ML Engineer Focus
- Architected **RecoverFlow AI**, an AI-assisted payment recovery engine enforcing code-level decoupling where LLM advisory inference (Gemini) is isolated from deterministic financial execution.
- Trained a calibrated Logistic Regression model (v1.1) with L2 regularization, achieving a strictly proper **Brier score of 0.1637** and **2.98% Expected Calibration Error (ECE)** across 5 probability bins.
- Prevented data leakage across recurring invoice cohorts by implementing customer-disjoint deterministic dataset partitioning (`splitDatasetByCustomer`) and population drift monitoring.
- Defended LLM diagnostic endpoints against adversarial prompt injection via structural XML encapsulation, control character sanitization, and structured fallback parsing.

### Option B: Backend / Distributed Systems / FinTech Engineer Focus
- Designed a deterministic payment recovery state machine with atomic idempotency locks (`reserveOrGet`), preventing duplicate charges and verified under a 100-worker concurrent load test suite.
- Enforced zero floating-point rounding drift across high-volume billing pipelines using branded nominal TypeScript types (`Paise`, `BasisPoints`) and integer-paise math ($1\text{ INR} = 100\text{ Paise}$).
- Built an append-only, tamper-evident audit ledger using SHA-256 hash chaining from genesis ($H_i = \text{SHA256}(H_{i-1} \parallel i \parallel \text{Payload}_i)$) with cryptographically signed block checkpoints.
- Integrated official Razorpay test-mode payment link APIs with key prefix assertion guards (`rzp_test_*`), proactive status polling, and gateway error PII scrubbing.

### Option C: Full-Stack / Software Engineering Intern Focus
- Built a high-performance payment orchestration dashboard with Next.js 16 (App Router), React 19, and Tailwind CSS, featuring an Explainable Decision Drawer with real-time score waterfalls.
- Implemented comprehensive quality gates comprising **277 automated unit and property-based tests across 44 suites** with **0 TypeScript errors** and **0 ESLint warnings**.
- Designed a counterfactual evaluation lab benchmarking 7 recovery policies against immutable frozen potential outcomes, demonstrating a +470% net recovery lift over fixed retry schedules.
- Formulated an automated regression test suite covering quiet-hours timezone blackout scheduling, human operator approval workflows, and gateway circuit breakers.

---

## 🏷️ Technical Keyword & Skill Matrix

| Category | Specific Technologies & Concepts |
|:---|:---|
| **Languages & Runtimes** | TypeScript 5 (Strict Mode), Node.js (v20+), Next.js 16 (Turbopack, App Router), React 19 |
| **Machine Learning & Stats** | Logistic Regression, Probabilistic Calibration, Brier Score, Expected Calibration Error (ECE), Maximum Calibration Error (MCE), Binary Cross-Entropy / Log Loss, Reliability Diagrams, Feature Engineering, L2 Regularization, Customer-Disjoint Splitting, Model Drift Detection |
| **FinTech & Systems** | Integer-Paise Arithmetic, Basis Points, Nominal Branded Types, Transactional Idempotency, Concurrency Control, Finite State Machines, Quiet-Hours Windowing, Exponential Backoff, Double-Debit Prevention |
| **Security & Cryptography** | SHA-256 Hash Chaining, Cryptographic Checkpoints, HMAC Signatures, Prompt Injection Defense, PII Sanitization, Regex Field Scrubbing, Circuit Breakers, Defense in Depth |
| **Testing & Tooling** | Vitest, Fast-Check (Property Testing), ESLint 9, Next.js Build Pipeline, Git Architecture |

---

## 🎙️ Elevator Pitches

### 30-Second Recruiter Pitch
> *"I built RecoverFlow AI, an AI-assisted payment recovery platform for subscription SaaS. The core innovation is architectural: while most AI tools either blindly retry failed payments or let LLMs directly manipulate transactions, RecoverFlow AI strictly decouples the two. Google Gemini is used solely as an advisory copilot to categorize unstructured gateway error logs and draft customer messages, while a pure TypeScript deterministic engine governs financial math in integer paise, enforces atomic idempotency, and manages state transitions on an append-only SHA-256 cryptographic audit ledger. The system is backed by 277 automated tests with zero TypeScript or lint errors."*

---

### 60-Second Hiring Manager Pitch
> *"In B2B subscription billing, failed payments represent huge revenue loss, but traditional automated dunning either spams churned accounts with fixed retry schedules or introduces compliance liabilities when AI is given direct financial autonomy. 
>
> I architected RecoverFlow AI around a strict principle: **AI advises, deterministic business logic decides.** 
> 
> On the ML side, I trained a calibrated logistic regression model that predicts recovery probability with an empirical Brier score of 0.1637 and an Expected Calibration Error of 2.98%, prioritizing invoices by Expected Value ($\text{EV} = \text{Amount} \times P$). We strictly prevent data leakage using customer-disjoint dataset splitting.
>
> On the systems side, all monetary math is computed in integer paise using branded nominal types to eliminate floating-point drift. We enforce atomic idempotency to prevent double-charging during race conditions, a configurable quiet-hours scheduler, human approval gates for invoices over ₹10,000, and a tamper-evident SHA-256 hash-chain audit ledger with signed checkpoints.
>
> The codebase contains 44 test suites passing 277 tests, builds cleanly on Next.js 16 Turbopack, and is completely documented with threat models and architecture specifications."*
