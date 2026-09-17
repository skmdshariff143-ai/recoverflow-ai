# ADR 0002: Deterministic Financial State Machine and Integer Arithmetic

## Status
Accepted

## Context
Payment recovery involves financially binding actions (retrying charges, dispatching discount links, altering customer account statuses). Floating-point arithmetic introduces IEEE 754 precision drift, and non-deterministic execution could lead to unauthorized financial transactions.

## Decision
1. **Integer Minor Units (Paise)**: All monetary values are represented strictly as 64-bit integer paise (₹1 = 100 paise). Probabilities are represented in integer basis points (10,000 bps = 100%).
2. **Deterministic State Transitions**: State transitions (`DETECTED` $\to$ `DIAGNOSED` $\to$ `ELIGIBILITY_CHECKED` $\to$ `APPROVAL_REQUIRED` $\to$ `SCHEDULED` $\to$ `EXECUTING` $\to$ `RECOVERED`) are executed exclusively by pure TypeScript domain logic.
3. **Hardcoded Zero-Tolerance Safety Invariants**:
   - Customer opt-outs immediately suppress all outbound messaging.
   - TRAI/RBI quiet hours (22:00 to 08:00 local merchant time) block communications.
   - Attempt caps enforce a maximum of 3 contacts per failed transaction.
   - Dual-custody review is mandatory for amounts exceeding ₹10,000.

## Consequences
- Eliminates floating-point calculation discrepancies in financial reconciliation.
- Guarantees that AI models can never directly trigger payments or bypass merchant policy.
