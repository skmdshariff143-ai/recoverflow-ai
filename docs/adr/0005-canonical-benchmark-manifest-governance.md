# ADR 0005: Canonical Benchmark Manifest and Artifact Governance

## Status
Accepted

## Context
FinTech platforms require empirical benchmarking to prove recovery lift without data leakage or stale documentation claims. Manually maintained benchmark tables in READMEs inevitably drift from codebase reality.

## Decision
1. **Single Source of Truth**: All benchmark metrics are computed against frozen evaluation matrices (`data/frozen-outcomes-200.json`, `data/frozen-outcomes-heldout-80.json`) and compiled into `data/benchmarks/benchmark-manifest.json`.
2. **Automated CI Verification**: `scripts/verify-artifacts.ts` audits dataset SHA-256 hashes, model weights, and benchmark consistency during every CI run.
3. **Transparent Claim Classification**: All claims are categorized into `PROVEN BY CODE`, `PROVEN BY AUTOMATED BENCHMARK`, `SIMULATED`, `TEST-MODE OBSERVATION`, `DESIGN GOAL`, `EXTERNAL CLAIM`, or `PRODUCTION OBSERVATION`.

## Consequences
- Eliminates exaggerated marketing claims.
- Provides cryptographic repeatability for evaluators, CTOs, and benchmark auditors.
