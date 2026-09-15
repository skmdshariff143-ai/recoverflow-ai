# Contributing to RecoverFlow AI

Thank you for your interest in contributing to **RecoverFlow AI**! We hold our codebase to the highest standards of software engineering, determinism, and application security.

---

## 1. Core Architectural Invariant

> **AI may advise, classify, normalize, summarize, or draft communication, but AI must NEVER directly execute money movement, mutate ledger balances, or authorize transactions without deterministic policy gates.**

Every PR touching agent logic or recovery execution must preserve this boundary.

---

## 2. Commit Message Standards (Conventional Commits)

We enforce the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` A new feature or capability
- `fix:` A bug fix or guardrail patch
- `perf:` Performance or bundle optimization
- `docs:` Documentation updates
- `test:` Adding or updating unit/integration/e2e tests
- `refactor:` Code refactoring without behavioral changes

---

## 3. Pull Request Lifecycle & Local Verification

Before submitting a PR, ensure all checks pass locally:

```bash
# 1. Type check
npm run type-check

# 2. Lint check
npm run lint

# 3. Vitest test suites (100% pass rate)
npx vitest run

# 4. Offline agent evaluation harness
npm run eval:agents

# 5. Production Next.js build
npm run build
```

---

## 4. Code Style & Standards

- **TypeScript**: Strict mode enabled. No `any` types where a discriminated union or interface can be written.
- **Security**: Pre-LLM input sanitization via `scanPromptSecurity`. Zero token leaks.
- **Idempotency**: All webhook and outbox handlers must use SHA-256 deterministic idempotency keys.
- **Testing**: Every new feature requires corresponding unit and integration tests under `tests/unit/` or `tests/integration/`.
