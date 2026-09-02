# PayBack AI — Curated 5-Minute Pitch & Judge Demonstration Script

> **Track 3**: AI Revenue Recovery · Razorpay AI Buildathon  
> **Live Web Application**: [https://recoverflow-ai-kohl.vercel.app](https://recoverflow-ai-kohl.vercel.app)  
> **Repository**: [https://github.com/skmdshariff143-ai/recoverflow-ai](https://github.com/skmdshariff143-ai/recoverflow-ai)  
> **Demo Reset Shortcut**: Press `Shift + R` anytime to restore a clean slate instantly.

---

## 🎯 Pitch North Star (The 15-Second Opening Hook)

> *"Every year, Indian subscription businesses lose crores to failed payments. Most dunning tools are **blind bots** that spam customers and retry dead bank accounts, incurring gateway penalties and customer churn. **PayBack AI is the first revenue recovery engine that proves its calibration on independent frozen outcomes before a single rupee moves** — prioritizing recovery by Expected Value, halting unsafe attempts deterministically, and securing every decision in a SHA-256 cryptographic audit ledger."*

---

## 🧭 The 5-Stop Curated Demonstration Path (Exactly 5 Minutes)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  5-STOP CURATED PITCH PATH                                                             │
│  [1] Live Tamper Demo       ──▶  [2] KPI & Trust Score   ──▶  [3] Explainability       │
│      (Try to Break It)               & Razorpay Badge             Drill-Down           │
│                                                                       │                │
│                                                                       ▼                │
│  [5] Blind-Bot Replay       ◀──  [4] Persona / Policy                                  │
│      Arena Scorecard                 Builder Dynamic Yield                             │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 🛑 STOP 1: Live Cryptographic Tamper Demo ("Try to Break It") (0:00 – 1:00)
- **Where**: Navigate to **Audit Ledger** tab $\to$ Live Tamper Demo Panel.
- **What to Point Out**:
  1. Frame the opening: *"Before I show you any dashboards or recovery metrics, try to break the system yourself."*
  2. Click **"Tamper & Verify"** on any record (or select a record and change decision/audit reason).
  3. Watch the live cryptographic verification engine recompute hashes: the target block instantly turns red, the SHA-256 hash chain invalidates, and an invariant violation alert is raised.
  4. Click **"Reset Demo"**: Cryptographic integrity turns green instantly from genesis hash `00000000...`.
- **What to Say**:  
  *"In automated payment recovery, hallucinated logs and audit evasion are fatal risks. PayBack AI cryptographically chains every single recovery decision into an immutable SHA-256 ledger. If anyone modifies a past decision, the mathematical chain breaks instantly."*

---

### 🛑 STOP 2: Command Center KPIs, Trust Score & Connected Webhook Badge (1:00 – 2:00)
- **Where**: Main Command Center header & top KPI row.
- **What to Point Out**:
  1. **Top Financial KPIs**: Show Total Revenue at Risk (`₹6,87,695`), Gross Recovered (`₹1,46,900`), and **Net Recovery** after operational fees (`₹1,36,900`).
  2. **Explainability & Safety Trust Score Gauge (89/100)**: Highlight the composite breakdown across 4 rigorous dimensions (Brier Calibration `0.1637`, 7/7 passing safety invariants, 100% hash-chained ledger coverage, and 0 opt-out violations).
  3. **Connected Razorpay Badge**: Show the Data Source toggle with **"Connected: Razorpay Test Mode"** listening at `POST /api/webhooks/razorpay` with HMAC SHA-256 signature verification.
- **What to Say**:  
  *"Notice our Trust Score and Net Recovery metric. We don't just show gross numbers—we deduct real per-channel intervention costs (₹1.25 for SMS, ₹2.50 for gateway retries) to show true net ROI."*

---

### 🛑 STOP 3: Explainable Payment Drill-Down & Decision Waterfall (2:00 – 3:00)
- **Where**: Ranked Priority Queue Table $\to$ click row `pay_00001` (or press `Enter` on any row).
- **What to Point Out**:
  1. **Deterministic 6-Factor Waterfall**: Step through base category recovery rate, customer on-time history (+12%), tenure boost (+5%), recency decay, and promise-to-pay penalty.
  2. **Expected Value Equation**: $\text{EV} = \text{Amount} \times \text{Prob} = ₹4,999 \times 74.8\% = ₹3,739.25$.
  3. **Authority-Isolated Gemini 3.6 Flash Copilot**: Live error normalization and empathetic dunning message draft with strict zero-write execution privileges.
  4. **Multi-Cycle Stepper**: 8-stage visual progression from ingestion through quiet-hours check to verified settlement.
- **What to Say**:  
  *"Every priority rank is mathematically explainable down to the paisa. AI normalizes unstructured error logs into plain English, but AI never has authority to execute money or change amounts."*

---

### 🛑 STOP 4: Risk-Appetite Persona & Policy Builder Live Adjustment (3:00 – 4:00)
- **Where**: Navigate to **Evaluation Lab** tab $\to$ top Persona Picker cards.
- **What to Point Out**:
  1. Switch between the 3 merchant personas:
     - **Cautious SaaS**: 2 attempt cap, strictly ₹25,000 approval threshold, protects recurring subscription goodwill.
     - **High-Volume D2C**: 65-slot budget, 3 attempt cap, ₹50,000 threshold, rapid multi-channel recovery for high cart volume.
     - **Enterprise B2B**: 35-slot budget, ₹1,00,000 threshold, conservative human-in-the-loop sign-off on enterprise invoices.
  2. Observe live updates to policy parameters, recovered yields, and net financial totals across the benchmark.
- **What to Say**:  
  *"Every merchant has different risk tolerances. With our Persona Picker, a CFO can toggle between Cautious SaaS and High-Volume D2C with compliant guardrails enforced in real time."*

---

### 🛑 STOP 5: Blind-Bot vs PayBack AI Replay Arena & Self-Verifiable Walk (4:00 – 5:00)
- **Where**: Click the **"🎮 Launch Replay Arena"** button in header or Evaluation Lab.
- **What to Point Out**:
  1. Click **"Run Head-to-Head Simulation"** (or **"⚡ Skip to Final Scorecard"**).
  2. Watch the Naive Fixed-Retry Bot commit real-world blunders: retrying permanently closed accounts, violating customer opt-outs, and harassing users during midnight quiet hours.
  3. Inspect the final scorecard: PayBack AI delivers **+₹3,93,159 (+470%) net revenue lift** under identical 40-slot budget with **0 safety violations**.
  4. Point to the **"Verify This Yourself"** hash walker at the bottom of the Audit Ledger for independent proof.
- **What to Say**:  
  *"This head-to-head arena captures the entire thesis: blind retry bots waste merchant budget on unrecoverable dead-ends. PayBack AI captures 470% more net revenue by moving money safely."*

---

## ⚡ Live Production Timing Verification (Automated QA Passed)

| Stop | Component / Focus | Rehearsal Duration | Timing Risk Assessment |
|:---|:---|:---:|:---|
| **Stop 1** | Live Tamper Demo & Genesis-to-Latest Hash Walk | ~2.8s UI response | Safe (paced speech ~55s) |
| **Stop 2** | Command Center KPIs, Trust Score & Webhook Badge | ~0.6s UI response | Fast (paced speech ~50s) |
| **Stop 3** | Payment Drill-Down, Bounded AI Copilot & Live Execution | ~2.1s UI response | Safe (paced speech ~65s) |
| **Stop 4** | Evaluation Lab Simulation & Persona Picker | ~0.7s UI response | Fast (paced speech ~45s) |
| **Stop 5** | Replay Arena Head-to-Head Scorecard | ~0.4s UI response | Paced (paced speech ~40s) |
| **Total** | Full 5-Stop Live Pitch Journey | ~7.1s total system latency | **Total Speech Target: 4m 30s (30s buffer)** |

---

## 🛡️ Anticipated Judge Questions & Crisp Defensibility Answers

### Q1: Why is Fixed Retry a fair baseline for your +470% revenue lift claim?
> **Answer**: *"Fixed 3-attempt retry is the standard dunning heuristic across 90% of Indian subscription gateways, so holding budget capacity strictly equal (40 slots) proves our lift comes entirely from intelligent prioritization and timing rather than brute-force volume."*

### Q2: Why is the integration in test-mode rather than a live merchant account?
> **Answer**: *"Real Razorpay merchant credentials require live RBI KYC and real bank debiting which cannot be executed safely during a hackathon demo, but our integration uses Razorpay's authentic test-mode Payment Links API with real HMAC-SHA256 signature verification over real webhooks."*

### Q3: Why is the AI layer bounded, and does it ever touch money?
> **Answer**: *"The Gemini AI layer is strictly sandboxed for read-only error log translation and message drafting—all financial routing, recovery execution, amount capping, and dual-custody enforcement are executed by deterministic TypeScript code that can never hallucinate."*

---

## 🗄️ "Explore After the Pitch" Features (Optional Deep-Dives)

The following secondary features are intentionally deferred to post-pitch Q&A:
- **Judge-Triggered Live Mobile Failure (`/trigger`)**: Scan QR code to inject test failures live from any smartphone.
- **Natural Language "Ask the Ledger" (Cmd+K $\to$ Natural Query)**: AI assistant grounded strictly in verified audit records.
- **Cost-of-Inaction Live Counter**: Real-time ticking decay counter on the Command Center.
- **Printable Judge Cheat Sheet & QR Code (`Shift+?` / Header QR Icon)**: Mobile-optimized reference card.
- **Self-Playing Guided Tour ("Guide Me")**: 12-step auto-playing product walkthrough.
- **Audio Feedback Cues (Sound FX)**: Web Audio synthesized soundscapes on the Live Recovery Runner.
- **One-Command Demo Reset (`Shift+R`)**: Instant demo state restoration without full page reload.

