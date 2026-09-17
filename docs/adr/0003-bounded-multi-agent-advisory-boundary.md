# ADR 0003: Bounded Advisory AI Isolation Boundary

## Status
Accepted

## Context
Large Language Models (LLMs) provide advanced reasoning, semantic understanding, and natural language generation, but are inherently non-deterministic and susceptible to prompt injection.

## Decision
1. **Strict Advisory Boundary**: AI models (Gemini 1.5 Flash / Pro) are restricted to qualitative classification, root-cause diagnosis, conversational drafting, and strategy recommendations.
2. **Zod Runtime Schema Validation**: All LLM outputs must strictly conform to versioned Zod schemas. Malformed or unparseable JSON immediately triggers deterministic fallback heuristics.
3. **Prompt Injection Sanitization**: All untrusted inputs (customer chat messages, product descriptions, webhook error strings) are sanitized to prevent jailbreaks or instruction override.
4. **Zero Financial Authority**: The AI layer cannot authorize discounts, execute payments, or mutate audit history.

## Consequences
- Complete containment of LLM hallucination and prompt injection risks.
- Continuous operation even during external AI provider outages via fallback decision trees.
