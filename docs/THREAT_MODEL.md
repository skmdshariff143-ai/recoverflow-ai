# RecoverFlow AI — Security & Fintech Threat Model

> **Submission Document**: Razorpay AI Buildathon · Track 3: AI Revenue Recovery

---

## 1. Threat Vectors & Defenses

| Threat Vector | Potential Impact | Implemented Defense |
|---|---|---|
| **Accidental Live API Execution** | Real customer money debited | `RazorpayTestModeAdapter` throws fatal error if key starts with `rzp_live_*`. |
| **Prompt Injection in Gateway Logs** | LLM overrides safety limits or alters amounts | All financial values and state decisions bypass LLM; LLM input is sanitized. |
| **Idempotency Replay Attacks** | Duplicate retries or double payment link creation | Server-side in-memory SHA-256 idempotency cache with TTL and conflict detection (Prototype scope; production requires distributed Redis/PostgreSQL). |
| **Unauthorized Adapter Execution** | Invalid gateway identifier supplied | Strict `AdapterTypeSchema` Zod allowlist (`simulator`, `razorpay_test_mode`) rejecting all unapproved gateway strings. |
| **Audit Log Tampering** | Manipulating recovery history or deleting failures | SHA-256 hash-chaining across all records; `verifyLedgerIntegrity()` detects mutation. |
