# RecoverFlow AI — Bounded AI Governance & Machine Learning Specification

> **Standard**: Strict Separation of Concerns · Advisory-Only LLM · Bounded Zod Contracts  
> **Primary Advisory Model**: Google Gemini 2.0 Flash (`gemini-2.0-flash`)  
> **Scoring Engine**: L2-Regularized Logistic Scorer (Deterministic TypeScript)  

---

## 1. The Core Architectural Invariant

```
┌────────────────────────────────────────────────────────────────────────┐
│                        THE SACRED AI BOUNDARY                          │
├────────────────────────────────────────────────────────────────────────┤
│  AI may advise, classify, summarize, draft, and explain.               │
│  AI must NEVER execute payments, mutate state, or bypass safety rules. │
└────────────────────────────────────────────────────────────────────────┘
```

### Permitted AI Responsibilities:
1. Extract semantic context from unstructured gateway error strings.
2. Draft polite, brand-aligned customer WhatsApp / Email recovery notifications.
3. Provide human operators with plain-English contrastive explanations.
4. Summarize failure root causes for executive CFO reporting.

### Strictly Forbidden AI Actions:
1. ❌ Altering recovery probability scores or expected value calculations.
2. ❌ Disagreeing with or overriding 7/7 zero-tolerance safety filters.
3. ❌ Directly triggering payment gateway debit requests.
4. ❌ Modifying account balances or invoice amounts.
5. ❌ Authorizing high-value payments (> ₹10,000) without human signoff.

---

## 2. Structured Output Schemas & Deterministic Fallbacks

All LLM invocations pass through strict Zod schema validation:
- If Gemini API times out (> 2500ms), returns malformed JSON, or fails schema validation, the system automatically falls back to **Deterministic Domain Heuristics**.
- Zero runtime crashes or unhandled exceptions are allowed to bubble up from the AI layer.
