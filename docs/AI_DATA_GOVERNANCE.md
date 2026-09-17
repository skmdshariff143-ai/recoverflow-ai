# RecoverFlow AI — AI Data Governance & Privacy Architecture

## 1. Data Classification Matrix
- **Public**: Benchmark scores, anonymized failure taxonomy, documentation.
- **Internal**: Model weights, recovery policies, queue statistics.
- **Customer PII**: Phone numbers, emails, customer names (Masked before AI prompt interpolation).
- **Secrets**: Webhook signing keys, API credentials (Server-only, never sent to LLMs).

## 2. AI Isolation & Privacy Boundary
Only non-sensitive, masked failure metadata (failure category, anonymized amount, cart item categories) are passed to LLM advisory prompts. Raw PII, credit card details, and private keys are strictly blocked at the prompt generation boundary.
