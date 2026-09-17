# RecoverFlow AI — Deterministic Recovery Engine & Policy Governance

## 1. State Machine Definition
- `DETECTED`: Payment failure or checkout abandonment event ingested.
- `DIAGNOSED`: Failure category classified (e.g. `gateway_degradation`, `insufficient_funds`, `auth_failure`).
- `ELIGIBILITY_CHECKED`: Policy rules evaluated against customer status, attempt count, and quiet hours.
- `APPROVAL_REQUIRED`: Paused for human dual-custody review if expected recovery > ₹10,000.
- `SCHEDULED`: Optimal contact window determined (respecting TRAI/RBI 22:00–08:00 quiet hours).
- `EXECUTING`: Dispatched via authorized channel adapter (WhatsApp / Email / Payment Link).
- `OUTCOME_OBSERVED`: Payment reconciliation detected via webhook or polling.
- `RECOVERED`: Transaction completed and verified; hash chain audit event recorded.
- `RETRY_SCHEDULED`: Rescheduled with exponential backoff if attempt count < 3.
- `STOPPED`: Suppressed due to customer opt-out, permanent closure, or max attempts reached.
