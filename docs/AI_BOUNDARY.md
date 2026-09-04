# PayBack AI — Strict AI vs Non-AI Responsibility Boundary

> **Submission Document**: Razorpay AI Buildathon · Track 3: AI Revenue Recovery  
> **Live Web Application**: [https://recoverflow-ai-kohl.vercel.app](https://recoverflow-ai-kohl.vercel.app)  
> **Repository**: [https://github.com/skmdshariff143-ai/recoverflow-ai](https://github.com/skmdshariff143-ai/recoverflow-ai)

---

## 1. Architectural Overview & Code-Enforced Isolation

Google Gemini 3.6 Flash operates strictly as an **advisory-only copilot** with **zero execution rights, zero state-mutation privileges, and zero money-movement authority**. All financial arithmetic, safety rule filters, budget allocations, multi-cycle state machine transitions, and cryptographic audit hashing are executed deterministically by pure TypeScript modules in [`src/lib/engine/`](../src/lib/engine/).

```mermaid
flowchart TD
    classDef advisoryNode fill:#1e1b4b,stroke:#818cf8,stroke-width:2px,color:#fff;
    classDef barrierNode fill:#450a0a,stroke:#ef4444,stroke-width:3px,color:#fff;
    classDef deterministicNode fill:#064e3b,stroke:#10b981,stroke-width:2px,color:#fff;

    subgraph AI_LAYER["🤖 AI ADVISORY LAYER · GEMINI 3.6"]
        direction LR
        A1["Error normalization<br/>Log text → category"]:::advisoryNode
        A2["Reminder drafting<br/>SMS / email proposal"]:::advisoryNode
        A3["Case summarization<br/>Timeline for reviewer"]:::advisoryNode
    end

    BARRIER["🔒 CODE-ENFORCED ISOLATION BARRIER — src/lib/ai/<br/><b>Zero execution &nbsp;•&nbsp; Zero state mutation &nbsp;•&nbsp; Zero money movement</b>"]:::barrierNode

    subgraph CORE_LAYER["⚖️ DETERMINISTIC GOVERNANCE & FINANCIAL ENGINE"]
        direction TB
        C1["EV ranking engine<br/>Integer-paise arithmetic"]:::deterministicNode
        C2["Safety rule filter<br/>Opt-out hard-stop invariants"]:::deterministicNode
        C3["Budget allocation<br/>Top-N slots, rest deferred"]:::deterministicNode
        C4["State machine<br/>Detected → diagnosed → executed"]:::deterministicNode
        C5["Audit ledger<br/>SHA-256 tamper-evident chain"]:::deterministicNode
        C1 --> C2 --> C3 --> C4 --> C5
    end

    A1 & A2 & A3 -. "advisory proposals only" .-> BARRIER
    BARRIER --> |"enforced boundary"| C1
```

---

## 2. Responsibility Boundary Matrix

| Capability | Engine Mechanism | Responsible Layer | Code Location | AI Involvement |
|---|---|---|---|---|
| **Probability & EV Math** | Closed-form logistic logit & integer paise math | Deterministic Financial Core | `src/lib/engine/financial.ts` | **NONE** |
| **Eligibility & Opt-Outs** | Hard boolean predicate check | Deterministic Safety Filter | `src/lib/engine/safetyFilter.ts` | **NONE** |
| **Budget & Capacity Ranking** | EV sorting and capacity capping | Deterministic Prioritization | `src/lib/engine/rankAndAllocate.ts` | **NONE** |
| **State Machine Transitions** | Strict finite state transition matrix | Deterministic State Engine | `src/lib/engine/stateMachine.ts` | **NONE** |
| **Transaction Execution** | Adapter interface + idempotency store | Execution Boundary | `src/lib/adapters/` | **NONE** |
| **Error Log Categorization** | LLM classification with heuristic fallback | Bounded Gemini Copilot | `src/lib/ai/geminiClient.ts` | **ADVISORY ONLY** |
| **Message Drafting** | Policy-constrained template drafting | Bounded Gemini Copilot | `src/lib/ai/geminiClient.ts` | **ADVISORY ONLY** |
| **Audit Ledger Hashing** | SHA-256 cryptographic chain | Cryptographic Ledger Engine | `src/lib/engine/hashChainLedger.ts` | **NONE** |

