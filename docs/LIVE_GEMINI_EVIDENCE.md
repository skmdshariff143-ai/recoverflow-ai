# RecoverFlow AI — Gemini AI Provenance & Integration Evidence

> **Document Status**: Live integration verification pending preview execution capture.  
> **Source Implementation**: `src/lib/ai/geminiClient.ts`, `src/app/api/ai/diagnose/route.ts`, `src/app/api/ai/draft-message/route.ts`  
> **Repository**: [https://github.com/skmdshariff143-ai/recoverflow-ai](https://github.com/skmdshariff143-ai/recoverflow-ai)

---

## Current Status

Live integration not yet verified on this branch. Source implementation and mocked tests are available. Verified captures will be recorded via live HTTP execution against the deployed preview environment during release validation.

### Source Validation Invariants:
1. **Advisory Role**: Gemini models have zero financial arithmetic, expected value, attempt limit, or state transition authority.
2. **Deterministic Fallback**: If `GEMINI_API_KEY` is absent, unreachable, or returns invalid responses, the system gracefully falls back to deterministic rule classification with explicit provenance disclosure.
3. **Zod Validation**: All LLM outputs are validated against strict Zod schemas before being returned.
