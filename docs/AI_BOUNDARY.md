# PayBack AI — Strict AI vs Non-AI Responsibility Boundary

> **Submission Document**: Razorpay AI Buildathon · Track 3: AI Revenue Recovery

---

## 1. Responsibility Boundary Matrix

| Capability | Engine Mechanism | Responsible Layer | AI Involvement |
|---|---|---|---|
| **Probability & EV Math** | Closed-form logistic logit & integer paise math | Deterministic Financial Core | **NONE** |
| **Eligibility & Opt-Outs** | Hard boolean predicate check | Deterministic Safety Filter | **NONE** |
| **State Machine Transitions** | Strict finite state transition matrix | Deterministic State Engine | **NONE** |
| **Transaction Execution** | Adapter interface + idempotency store | Execution Boundary | **NONE** |
| **Error Log Categorization** | LLM classification with heuristic fallback | Bounded Gemini Copilot | **ADVISORY ONLY** |
| **Message Drafting** | Policy-constrained template drafting | Bounded Gemini Copilot | **ADVISORY ONLY** |
| **Audit Ledger Hashing** | SHA-256 cryptographic chain | Cryptographic Ledger Engine | **NONE** |
