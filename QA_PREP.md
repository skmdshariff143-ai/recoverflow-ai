# PayBack AI — Judge Q&A & Defensibility Cheat Sheet

> **Live Production URL**: [https://recoverflow-ai-kohl.vercel.app](https://recoverflow-ai-kohl.vercel.app)  
> **Repository**: [https://github.com/skmdshariff143-ai/recoverflow-ai](https://github.com/skmdshariff143-ai/recoverflow-ai)  

---

## 🎯 The 3 Core Defensibility Answers (Memorize These)

### 1. Why Fixed Retry is a fair baseline for your +470% revenue lift claim
> **Crisp 1-Sentence Answer**:  
> *"Fixed 3-attempt retry is the standard dunning heuristic across 90% of Indian subscription gateways, so holding budget capacity strictly equal (40 slots) proves our lift comes entirely from intelligent prioritization and timing rather than brute-force volume."*

- **Deep-Dive Backup**:
  - Most merchants blindly retry failed payments at Fixed intervals ($T+1\text{d}, T+3\text{d}, T+7\text{d}$) regardless of error reason.
  - In our Counterfactual Evaluation Lab, both policies are given the exact same 40-slot attempt budget over the exact same frozen ground-truth potential outcomes matrix.
  - Fixed Retry burns attempt slots on hard stops (e.g. `ACCOUNT_CLOSED`, `SUSPECTED_FRAUD`), recovering only ₹83,741.
  - PayBack AI allocates all 40 slots to recoverable, high-EV payments, capturing ₹4,76,900 gross (₹4,46,900 net).

---

### 2. Why test-mode-only rather than a live merchant account
> **Crisp 1-Sentence Answer**:  
> *"Real Razorpay merchant credentials require live RBI KYC and real bank debiting which cannot be executed safely during a hackathon demo, but our integration uses Razorpay's authentic test-mode Payment Links API with real HMAC-SHA256 signature verification over real webhooks."*

- **Deep-Dive Backup**:
  - Every webhook received at `POST /api/webhooks/razorpay` is cryptographically validated using `crypto.createHmac('sha256', secret)`.
  - The live mobile trigger page (`/trigger` or via QR code) dispatches authentic test payloads into the ingestion pipeline in under 2 seconds.
  - When live dispatch is clicked, PayBack AI calls Razorpay's Payment Links API, captures the real test-mode payment link URL, and records the signed transaction hash.

---

### 3. Why the AI layer is bounded and never touches money
> **Crisp 1-Sentence Answer**:  
> *"The Gemini AI layer is strictly sandboxed for read-only error log translation and message drafting—all financial routing, recovery execution, amount capping, and dual-custody enforcement are executed by deterministic TypeScript code that can never hallucinate."*

- **Deep-Dive Backup**:
  - Deterministic safety invariants (max 3 attempts, 4-hour cooldown, ₹50,000 dual-custody threshold, 9 PM – 9 AM quiet hours) are enforced by hard-coded TypeScript rules.
  - Gemini 3.6 Flash Copilot is invoked exclusively with zero-write permissions to:
    1. Translate cryptic gateway error codes into human-readable merchant diagnostics.
    2. Draft context-aware, tone-calibrated WhatsApp/SMS dunning templates.
  - Gemini output is constrained to structured JSON schemas; even if Gemini outputs invalid data, the system falls back to deterministic rule tables instantly.

---

## 🧭 Additional Anticipated Judge Inquiries

### Q: "How do you avoid overfitting to your benchmark dataset?"
- **Answer**: *"We maintain a separate held-out 80-record Adversarial Stress Cohort featuring rare gateway outages, UPI PIN fatigue clusters, and chargeback anomalies that the scoring model never saw during calibration. Our Brier Score remains solid at 0.1637."*

### Q: "How does your SHA-256 Ledger protect against internal tampering?"
- **Answer**: *"Every recovery action produces an audit record where $H_i = \text{SHA256}(H_{i-1} \parallel i \parallel \text{JSON}(\text{payload}))$. If any past decision, amount, or timestamp is altered in the database, the hash cascade breaks every subsequent block from that point forward—which judges can test live with the 'Tamper & Verify' button."*

### Q: "What prevents PayBack AI from spamming customers during recovery?"
- **Answer**: *"We enforce deterministic RBI/TRAI quiet hours (9:00 PM to 9:00 AM IST) where no notifications can dispatch, mandatory channel rotation to prevent SMS fatigue, and an immediate permanent halt if the customer opts out or disputes the transaction."*
