# RecoverFlow AI (PayBack AI) — The Engineering Story

> **An Architectural Journey in Bounded AI, Financial Safety, and Production Hardening**  
> *How a flawed hackathon prototype was systematically engineered into a reliable, verifiable FinTech platform.*

---

## 📖 Prologue: The Allure and Trap of "Autonomous AI Agents"

In mid-2024, the prevailing industry trend was to wrap a large language model in a loop, grant it access to external API tools, and call it an "autonomous AI financial agent." 

When we initially surveyed the problem of SaaS payment recovery, that approach seemed tempting: let an LLM inspect failed payment logs, decide how much to retry, send custom reminders to customers, and execute gateway calls.

However, within our first week of stress-testing, the fatal flaws of autonomous LLM architectures in FinTech became glaringly obvious:
1. **Hallucinatory Arithmetic**: LLMs cannot be trusted to perform exact integer accounting or expected value multiplication. Floating-point numbers drifted, and amounts fluctuated between retries.
2. **State Mutation Hazards**: When given tool-calling execution access, models would occasionally retry permanently closed accounts, ignore quiet-hours policies, or bypass customer opt-outs.
3. **Circular Evaluation**: Prototype demos claimed "90% recovery rates" by using the exact same LLM prompt to simulate customer repayment that had prioritized the payment in the first place.

We halted development and established a core architectural principle that defined every line of code written thereafter:

> **AI may advise, classify, normalize, summarize, or draft communication, but AI must NEVER directly control financial execution, state transitions, idempotency, or ledger integrity.**

Here is the 10-step journey of how RecoverFlow AI was built, broken, rebuilt, and hardened.

---

## 🛠️ The 10-Step Engineering Narrative

### Step 1: The Core Boundary & Decoupling `src/lib/ai/` from `src/lib/engine/`
We began by splitting the codebase into two strictly separated domains:
- `src/lib/ai/`: Contains LLM client code (Google Gemini). Its sole responsibilities are unstructured log normalization and drafting customer reminder copy. It has **zero imports** from payment adapters, state machines, or database stores.
- `src/lib/engine/`: Pure, framework-agnostic TypeScript containing scoring logic, safety gates, budget allocation, and cryptographic hashing. It runs identically in Node.js, edge workers, and browsers with zero LLM dependencies.

### Step 2: Eliminating Floating-Point Drift with Branded Integer-Paise Math
In high-volume billing, JavaScript's IEEE-754 numbers produce floating-point artifacts like `0.1 + 0.2 = 0.30000000000000004`. Over thousands of daily retries, minor fractions accumulate into reconciling discrepancies on bank balance sheets.  
We introduced branded nominal types `Paise` ($1\text{ INR} = 100\text{ Paise}$) and `BasisPoints` ($[0, 10000]$). In `financial.ts`, Expected Value is calculated strictly as:
$$\text{EV} = \text{Math.round}\left(\frac{\text{amountPaise} \times \text{probabilityBps}}{10000}\right)$$
We wrote property-based tests verifying non-negativity, integer safety, and identity laws across millions of pseudo-random inputs.

### Step 3: Hard Safety Gates & High-Value Approval Workflows
Before an invoice is scored or allocated a single slot of recovery budget, it passes through `safetyFilter.ts`. If an account has `opt_out: true`, is closed, or has exceeded 3 attempts, the engine executes an immediate `STOPPED` transition.  
Furthermore, for high-value invoices (> ₹10,000), we added `approvalGate.ts`. Rather than allowing automated dunning to alienate a key enterprise client, the system halts the payment in `APPROVAL_REQUIRED` until a human operator enters an approval note.

### Step 4: The Payment Link Accounting Invariant (What Broke #1)
In our early test-mode adapter, generating a payment link returned `status: 'recovered'`. This caused dashboard KPI cards to display gross recovered revenue the moment an SMS link was created—even if the customer never clicked it.  
We instituted a strict accounting rule: creating a payment link records `settledAmountPaise: 0` and `status: 'test_link_created'`. Recovered revenue is credited *only* when the gateway API confirms settlement.

### Step 5: Stateless Checksummed Receipts in Ephemeral Serverless (What Broke #7)
When deploying our Next.js application to Vercel, we encountered a critical distributed systems bug: `POST /api/recovery/execute` returned a successful simulated receipt stored in local container memory (`Map`), but subsequent queries to `GET /api/recovery/status/:id` hit a different serverless instance and returned `404 Transaction Not Found`.  
We solved this without external database dependencies by inventing **stateless checksummed transaction references**:
`sim_txn_<paymentId>_c<attemptCycle>_<intervention>_<amountPaise>_<outcomeCode>_<checksum12>`  
Any serverless container can cryptographically verify the SHA-256 HMAC checksum, extract the parameters, and deterministically reconstruct the exact transaction outcome statelessly.

### Step 6: Eliminating Public Webhook Attack Surface
Traditional recovery dunning relies on inbound webhooks from payment gateways. However, in serverless environments, improperly configured webhook secrets or public endpoint exposure create denial-of-service and spoofing vectors.  
We permanently disabled public webhook receivers (`POST /api/recovery/webhook` returns HTTP 404) and shifted to **proactive outbound status polling** (`GET /api/recovery/status/:id`) orchestrated by an internal `OutcomeObserverManager`.

### Step 7: Atomic Idempotency & The 100-Worker Concurrency Test
Network retries often send identical requests simultaneously. Without atomic locking, two parallel workers can create duplicate payment links or charge a card twice.  
We built `idempotencyStore.ts` with atomic reservation (`reserveOrGet`). If a duplicate request arrives while the first is pending, it returns `status: 'conflict'` (HTTP 409). We verified this by authoring `idempotencyConcurrency.test.ts`, running 100 parallel asynchronous workers against a single key to prove that exactly one executes.

### Step 8: Machine Learning Calibration & Brier Score Validation
Rather than relying on arbitrary heuristic weights, we developed a calibrated Logistic Regression model (v1.1) in pure TypeScript (`trainModel.ts`).  
To prove that our model's probabilities represent reality, we computed empirical Brier scores ($0.1637$) and Expected Calibration Error ($2.98\%$) across 5 probability bins. We audited the dataset split using `splitDatasetByCustomer()` to ensure zero customer ID leakage between training and evaluation cohorts.

### Step 9: Prompt Injection Defense & Provider Error Sanitization
To harden our advisory Gemini integration, we authored `promptInjection.test.ts` to simulate adversarial inputs where gateway logs attempted instruction overrides. We encapsulated all untrusted inputs within `<untrusted_gateway_error>` XML tags and instructed the system prompt to treat content as inert data.  
Simultaneously, `sanitizeProviderError.ts` was deployed to scrub authorization headers, bearer tokens, card numbers, and emails from gateway error responses before logging.

### Step 10: The Append-Only Cryptographic Audit Ledger & Checkpoints
Enterprise compliance demands that audit logs cannot be silently rewritten by an administrator or rogue process.  
In `hashChainLedger.ts`, we implemented an append-only SHA-256 cryptographic chain starting from genesis `00000000...`. Each block hash binds the previous block hash, sequence index, and JSON event payload. In the dashboard, operators can click **Verify Ledger Integrity** to recompute the entire chain in the browser. Finally, we added HMAC-signed periodic checkpoints to defend against whole-chain regeneration attacks.

---

## 🎯 Retrospective & Key Engineering Takeaways

1. **Deterministic logic must govern money**: Machine learning and generative AI are incredible tools for pattern extraction and communication, but financial math, state transitions, and idempotency must remain strictly deterministic.
2. **Defensive architecture beats prompt engineering**: Prompt instructions can be bypassed; code-enforced module isolation cannot. By denying the AI layer execution credentials, the system is secure by design.
3. **Honesty over hype**: Real production engineering is defined by clear limitations, rigorous testing, and transparent post-mortems—not exaggerated marketing buzzwords.
