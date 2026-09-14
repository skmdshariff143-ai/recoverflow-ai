# RecoverFlow AI (PayBack AI) — Technical Interview Preparation Guide

> **25 Rigorous Technical Interview Questions & Answers**  
> *Directly grounded in the RecoverFlow AI codebase, architecture, and engineering trade-offs.*

---

## 🏛️ System Architecture & Financial Safety

### Q1: Why did you separate AI advisory functions from deterministic execution?
**Answer**: In financial engineering, non-deterministic systems introduce intolerable risks: hallucinations of payment amounts, illegal state transitions, and compliance violations. By isolating Google Gemini in `src/lib/ai/` with zero write access to transaction stores, state machines, or gateway adapters, we guarantee that the LLM can never authorize a refund, trigger a payment retry, or mutate ledger balances. The deterministic core in `src/lib/engine/` is pure TypeScript and 100% unit-testable.

### Q2: How does RecoverFlow AI handle monetary calculations without precision drift?
**Answer**: Standard JavaScript numbers are IEEE-754 double-precision floats, which lead to rounding errors (e.g., $0.1 + 0.2 = 0.30000000000000004$). In `financial.ts`, all financial amounts are typed as nominal branded `Paise` (integers, where $1\text{ INR} = 100\text{ Paise}$) and probabilities are scaled to integer `BasisPoints` ($[0, 10000]$). The expected value formula $\text{EV} = \text{round}\left(\frac{\text{amountPaise} \times \text{bps}}{10000}\right)$ operates entirely in integer arithmetic. Property-based tests assert non-negativity, integer safety, and identity laws.

### Q3: What happens when an invoice is for a very large amount?
**Answer**: We implement a human-in-the-loop approval gate (`approvalGate.ts`). Any invoice exceeding ₹10,000 is automatically halted at `APPROVAL_REQUIRED`. The state machine rejects any direct transition to `SCHEDULED` or `EXECUTING` until an authorized human operator provides explicit approval with an audit note, which is then committed to the cryptographic ledger.

### Q4: How does the recovery state machine prevent illegal transitions?
**Answer**: In `stateMachine.ts`, we define an explicit directed graph of valid state transitions (e.g., `DETECTED` $\to$ `DIAGNOSED` $\to$ `SCHEDULED` $\to$ `EXECUTING` $\to$ `OUTCOME_OBSERVED` $\to$ `RECOVERED`). If an event attempts an illegal transition—such as jumping from `DETECTED` directly to `RECOVERED`—the engine throws an `InvalidTransitionError` (HTTP 409).

### Q5: How do you enforce customer quiet-hours contact policies?
**Answer**: In `quietHours.ts`, every customer has an assigned or default quiet-hours window (e.g. 22:00 to 08:00) and an IANA timezone string (e.g., "Asia/Kolkata"). Before scheduling any reminder, the scheduler checks if the target timestamp falls within the customer's blackout window. If so, it defers dispatch to the next eligible window at 08:01 local time.

---

## 🔒 Idempotency, Concurrency & Security

### Q6: How does your idempotency store prevent duplicate payments under concurrent requests?
**Answer**: In `idempotencyStore.ts`, we implement a transactional `reserveOrGet` pattern. When a recovery request arrives, the store checks if the key exists. If not, it atomically reserves the key in state `PENDING`. If a second concurrent thread arrives with the same key, it detects the in-flight lock and returns `status: 'conflict'` (HTTP 409). Once the first request completes, the execution receipt is saved, and subsequent replayed requests receive the cached receipt idempotently.

### Q7: What happens if an attacker replays an idempotency key with an altered payload?
**Answer**: The store computes a SHA-256 hash of the JSON payload upon receipt (`hashPayload()`). When a request presents an existing key, the store verifies that `existing.requestHash === currentHash`. If the payloads differ, it rejects the request with an `IdempotencyConflictError`, preventing receipt substitution attacks.

### Q8: How did you verify your idempotency implementation under high concurrency?
**Answer**: In `idempotencyConcurrency.test.ts`, we wrote an automated test simulating 100 parallel workers concurrently attempting execution on the exact same idempotency key. The test asserts that exactly 1 worker acquires execution rights while the other 99 are safely blocked or receive conflict statuses, with zero double-execution.

### Q9: How do you defend against prompt injection in gateway error logs?
**Answer**: Gateway error logs often contain arbitrary text from third-party banks or malicious actors. In `geminiClient.ts`, we sanitize all input by stripping control characters `< > { } \` and truncating to 500 chars. We encapsulate the log inside XML boundary tags `<untrusted_gateway_error>` with strict system instructions declaring the content as data only. Most importantly, even if an injection alters the model output, the LLM has zero authority to execute actions.

### Q10: How do you prevent sensitive credentials from leaking into provider error logs?
**Answer**: `sanitizeProviderError.ts` intercepts all external gateway error payloads and scrubs sensitive regex patterns, including bearer tokens (`Bearer [REDACTED_TOKEN]`), HTTP Basic auth headers, 13–16 digit credit card numbers, email addresses, and phone numbers before formatting safe summary strings.

### Q11: How do you prevent live real-money charges during development or testing?
**Answer**: In `recoveryAdapter.ts`, the `RazorpayTestModeAdapter` constructor inspects the configured API key. If the key starts with `rzp_live_*`, the adapter throws a fatal invariant exception: `"SECURITY VIOLATION: Live mode Razorpay keys (rzp_live_*) are strictly prohibited."` Only `rzp_test_*` credentials or offline deterministic simulators are permitted.

---

## 🤖 Machine Learning, Calibration & Data Integrity

### Q12: Why use a calibrated Logistic Regression model instead of a black-box deep learning model?
**Answer**: In financial recovery, model explainability and well-calibrated probabilities are critical. Merchants need to know *why* an invoice was prioritized, and Expected Value math ($\text{EV} = \text{Amount} \times P$) requires $P$ to represent a genuine frequentist probability, not an uncalibrated confidence score. Our logistic regression model v1.1 is fully transparent, exposes 7 weighted coefficients, and achieves a strictly proper Brier score of 0.1637.

### Q13: What is the Brier score, and what does 0.1637 mean in your system?
**Answer**: The Brier score is a strictly proper scoring rule that measures the mean squared difference between predicted probabilities and actual binary outcomes: $\text{BS} = \frac{1}{N}\sum(p_i - y_i)^2$. A score of $0$ indicates perfect calibration, while $0.25$ represents random coin tossing. Our empirical score of 0.1637 demonstrates that predicted probabilities strongly correspond to empirical recovery outcomes.

### Q14: How do you measure calibration across probability bins?
**Answer**: In `calibration.ts`, we partition predictions into 5 equal-width probability bins ($[0-0.2], [0.2-0.4], \dots$) and compute Expected Calibration Error (ECE) as the sample-weighted average gap between predicted mean and actual recovery rate: $\text{ECE} = \sum \frac{|B_m|}{N} |\text{acc}(B_m) - \text{conf}(B_m)|$. Our model achieves an ECE of 2.98% (0.0298) and a Maximum Calibration Error (MCE) of 0.0712.

### Q15: How did you prevent data leakage between training and test sets?
**Answer**: In subscription billing, a single customer may have multiple failed invoices over time. If random row-level splitting is used, invoices from the same customer appear in both train and test sets, artificially inflating accuracy. We implemented `splitDatasetByCustomer()` in `trainModel.ts`, which deterministically hashes `customer_id` so that all transactions for any given customer belong exclusively to train, validation, or test sets.

### Q16: How does the system detect and respond to model drift?
**Answer**: In `modelMonitoring.ts`, the `ModelDriftMonitor` tracks live prediction cohorts against baseline rates. If distribution shift exceeds tolerance (e.g. prediction shift $> 15\%$ or ECE $> 18\%$), the monitor raises alert levels (`WARNING`, `INVESTIGATE`, `FALLBACK_REQUIRED`). When flagged as `FALLBACK_REQUIRED`, the engine automatically reverts to the conservative, transparent 6-factor category heuristic.

### Q17: What is circular evaluation bias, and how does RecoverFlow AI eliminate it?
**Answer**: Many recovery platforms score invoices with a heuristic and then "evaluate" the algorithm on the exact same logic that created it. To eliminate this circularity, RecoverFlow AI generates independent ground-truth outcomes frozen in `data/frozen-outcomes-200.json`. These benchmark matrices are immutable and evaluated identically across all 7 candidate recovery policies in the Evaluation Lab.

---

## 🔐 Auditability, Cryptography & Ledger Integrity

### Q18: How does the SHA-256 hash-chain audit ledger work?
**Answer**: In `hashChainLedger.ts`, every state transition, operator approval, and execution event forms a block in an append-only chain. Genesis block begins with `00000000...`. Each block hash is computed as $H_i = \text{SHA256}(H_{i-1} \parallel i \parallel \text{JSON}(\text{Payload}_i))$. This guarantees that mutating, deleting, or reordering any past record alters all subsequent hashes.

### Q19: How does `verifyLedgerIntegrity()` pinpoint the exact record of tampering?
**Answer**: The verification function iterates through the entire ledger, recomputing each block hash from genesis. If it discovers a broken link or payload mismatch at index $i$, it immediately halts and returns `{ isValid: false, tamperedIndex: i, errorDetail: "Payload tampering detected at record..." }`. This was tested by creating deliberate mutations in unit tests.

### Q20: What are signed ledger checkpoints, and why are they necessary?
**Answer**: While a hash chain detects internal tampering, an attacker with write access could theoretically rewrite the entire chain from genesis. To prevent whole-chain regeneration attacks, `createLedgerCheckpoint()` periodically signs the head block hash and record count with an HMAC digest. `verifyLedgerCheckpoint()` validates that the current ledger head matches the cryptographically signed checkpoint.

---

## 🚀 Distributed Systems & Production Migration

### Q21: The current idempotency store is in-memory. How would you migrate it to production?
**Answer**: In a multi-instance serverless environment (e.g., Vercel / AWS Lambda), local memory is not shared. In production, we replace `InMemoryIdempotencyStore` with PostgreSQL using atomic inserts:  
`INSERT INTO idempotency_keys (key, request_hash, status, expires_at) VALUES ($1, $2, 'PENDING', NOW() + INTERVAL '1 hour') ON CONFLICT (key) DO NOTHING RETURNING *;`  
Alternatively, in Redis, we use atomic `SET key payload NX EX 3600`.

### Q22: Why did you eliminate public inbound webhooks in favor of proactive polling?
**Answer**: In early iterations, exposing a public webhook receiver (`POST /api/recovery/webhook`) introduced vulnerabilities when webhook secrets were unconfigured in serverless environments. We removed the public webhook endpoint and implemented proactive outbound status polling (`GET /api/recovery/status/:id`) with stateless HMAC-checksummed transaction references (`sim_txn_...`). This eliminated inbound attack surface while guaranteeing settlement verification.

### Q23: Why do payment-link creation events record ₹0 in recovered revenue?
**Answer**: A critical accounting principle: creating a payment link is an *intervention dispatch*, not an observed financial settlement. Conflating link dispatch with recovery inflates revenue figures on invoices customers never pay. Recovered revenue is credited strictly when the gateway confirms `status === 'paid'`.

### Q24: What is your error handling strategy across API boundaries?
**Answer**: We built a typed domain error hierarchy in `src/types/errors.ts` (`ValidationError`, `SafetyViolationError`, `InvalidTransitionError`, `IdempotencyConflictError`, `ProviderTimeoutError`, `FinancialIntegrityError`). The global `formatErrorResponse()` maps domain errors to standard HTTP status codes (400, 403, 409, 422, 502, 504) while sanitizing unexpected internal exceptions to prevent leaking server stack traces.

### Q25: How does RecoverFlow AI compare to traditional rules-based dunning software like Chargebee or Stripe Smart Retries?
**Answer**: Traditional dunning uses fixed retry rules (e.g., retry on Day 1, 3, 7) or opaque ML models that lack safety invariants and explainability. RecoverFlow AI provides:
1. **Mathematical explainability**: Clear 7-factor score waterfalls for every decision.
2. **Deterministic safety gates**: Invariant stops for opt-outs and closures that AI cannot override.
3. **Integer-paise EV optimization**: Prioritizing scarce merchant recovery bandwidth on invoices with the highest expected yield.
4. **Cryptographic tamper-evidence**: Verifiable audit proof for enterprise compliance.
