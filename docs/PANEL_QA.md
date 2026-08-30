# RecoverFlow AI — Panel Technical Q&A Guide

> **Submission Document**: Razorpay AI Buildathon · Track 3: AI Revenue Recovery

---

## Key Evaluator Questions & Answers

### Q1: How do you prevent circular evaluation in your simulated results?
**A**: We generate frozen potential outcome matrices for each payment using independent causal transition rules (`outcomeEnvironment.ts`). The scoring model's predicted probability is never consulted when deciding whether an invoice settles in simulation.

### Q2: Why is integer arithmetic critical in revenue recovery?
**A**: JavaScript floating-point representation (`0.1 + 0.2 !== 0.3`) causes precision drift in high-volume billing. All RecoverFlow calculations are denominated in integer paise ($1\text{ INR} = 100\text{ Paise}$) with basis points expected value math.

### Q3: What prevents the LLM from executing unauthorized financial operations?
**A**: Gemini models have zero execution privileges. They are isolated in an advisory layer (`geminiClient.ts`) used only for unstructured error normalization and message drafting. All outputs are strictly validated by Zod schemas and required human operator review.
