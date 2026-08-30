# RecoverFlow AI — Panel Technical Q&A Guide

> **Submission Document**: Razorpay AI Buildathon · Track 3: AI Revenue Recovery  
> **Repository**: [https://github.com/skmdshariff143-ai/recoverflow-ai](https://github.com/skmdshariff143-ai/recoverflow-ai)  
> **Live Production URL**: [https://recoverflow-ai-kohl.vercel.app](https://recoverflow-ai-kohl.vercel.app)

---

## 🎯 Key Evaluator Questions & Technical Answers

### Q1: How do you prevent circular evaluation in your simulated results?
**A**: We generate frozen ground-truth potential outcome matrices for each payment using independent causal transition rules (`outcomeEnvironment.ts`). The scoring model's predicted probability is never consulted when deciding whether an invoice settles in simulation.

### Q2: Why is integer arithmetic critical in revenue recovery?
**A**: JavaScript floating-point representation (`0.1 + 0.2 !== 0.3`) causes precision drift in high-volume billing. All RecoverFlow calculations are denominated in integer paise ($1\text{ INR} = 100\text{ Paise}$) with basis points Expected Value math ($\text{EV} = \text{round}(\text{amountPaise} \times \text{bps} / 10000)$).

### Q3: What prevents the LLM from executing unauthorized financial operations?
**A**: Gemini models have zero execution privileges. They are strictly isolated in an advisory layer (`geminiClient.ts`) used only for unstructured error normalization and message drafting. All outputs are strictly validated by Zod schemas and require human operator review.

### Q4: Why did you remove the public webhook receiver instead of keeping it?
**A**: Exposing a public inbound webhook receiver in serverless preview environments creates unauthenticated attack surface and silent failure risks if merchant webhook secrets are unconfigured. RecoverFlow AI shifts to bounded outbound status polling (`GET /api/recovery/status/:id`) and typed internal telemetry actors (`outcome_observer`, `gateway_webhook`), ensuring verifiable settlement without inbound public endpoint vulnerabilities.

### Q5: How do you prevent duplicate settlements on retried interventions?
**A**: `outcomeObserverManager` enforces event idempotency and intervention-level deduplication: once a settlement is recorded for a given `(paymentId, interventionId)` tuple, subsequent observation events are rejected as duplicate, preventing double-counting.

### Q6: How does your human-in-the-loop gate handle enterprise high-value payments?
**A**: Invoices above ₹10,000 are automatically routed to `APPROVAL_REQUIRED` before gateway execution. An operator must enter a mandatory note and click "Approve Recovery". This decision is recorded on the cryptographic SHA-256 ledger with reviewer ID and timestamp.
