# RecoverFlow AI — End-to-End Release Integrity Audit

> **Branch**: `fix/end-to-end-release-integrity`  
> **Starting Commit**: `938fb357f7c14403eb7a92163288080813a0785e`  
> **Audit Date**: 2026-08-30  
> **Track**: Razorpay AI Buildathon — Track 3: AI Revenue Recovery

---

## 1. Executive Forensic Audit Matrix

| # | Feature / Claim | Source File(s) | Runtime Path Status | UI Evidence | Test Evidence | Verdict | Remediation Plan |
|---|---|---|---|---|---|---|---|
| 1 | **Frozen Evaluation Artifacts in UI** | `src/hooks/useRecoveryBatch.ts`, `data/dev-payments-200.json` | Regenerates 200/80 items in memory with seeds instead of importing JSON files | UI computes on hook-generated state | Unit test passes independently | **PARTIAL** | Import checked-in `data/*.json` directly into data layer; display dataset SHA-256 and metadata. |
| 2 | **Adversarial Stress Fixture Terminology** | `MODEL.md`, `EvaluationLab.tsx` | Termed "Held-Out Adversarial", but generated internally | UI shows "Held-Out Adversarial (80)" | Tests verify 80 items | **UNVERIFIED / CLAIM OVERREACH** | Rename to "Frozen Internal Adversarial Stress Fixture". Explicitly disclose synthetic assumptions. |
| 3 | **Closed-Loop Multi-Cycle State Machine in UI** | `src/lib/engine/stateMachine.ts`, `useRecoveryBatch.ts` | Legacy batch runner used on dashboard instead of state machine orchestrator | Dashboard renders batch output | State machine unit tests pass | **PARTIAL** | Wire `useRecoveryBatch` to drive state machine transitions (`DETECTED` $\to$ `DIAGNOSED` $\to$ `SCHEDULED` $\to$ `EXECUTING` $\to$ `OUTCOME_OBSERVED`). |
| 4 | **Interactive Live Recovery Runner** | New workspace needed | Not rendered as an interactive stepped runner | UI has static tabs | E2E tests tabs | **UNVERIFIED** | Build Live Recovery Runner workspace with Step / Play / Pause / Replay controls. |
| 5 | **Real Reviewer Approval Action Gate** | `PaymentDrilldownModal.tsx` | Local state set only; does not mutate workflow or ledger | Modal shows feedback banner | No ledger persistence | **FALSE (Cosmetic)** | Connect modal actions to `applyReviewerDecision`, mutate session workflow state, update hash chain ledger with mandatory notes. |
| 6 | **High-Value Auto-Approval Disablement** | `rankAndAllocate.ts`, `useRecoveryBatch.ts` | `autoApproveHighValueWithHighEV: true` bypassed human gate | High-value marked auto-approved | Tests test auto-approval | **DEFECT** | Set default `autoApproveHighValueWithHighEV: false`. Require explicit human approval for $\ge ₹1,00,000$ / high-value invoices. |
| 7 | **Razorpay Test-Mode Adapter & Server Boundary** | `src/lib/adapters/recoveryAdapter.ts` | Class exists but no dedicated server route or status polling | No execution dispatcher | Adapter tests pass | **PARTIAL** | Add server-only `/api/recovery/execute` and `/api/recovery/status` with Zod validation, idempotency, and test-mode status mapping. |
| 8 | **Unified SHA-256 Audit Ledger** | `src/lib/engine/hashChainLedger.ts` | Ledger built from `batchResult.executed_items` instead of unified lifecycle events | Ledger tab shows items | Ledger tests pass | **PARTIAL** | Unify all operational events (detection, scoring, safety, approval, execution, outcome, AI advice) into canonical hash chain. |
| 9 | **AI Safety & Clean Fallback Boundary** | `src/lib/ai/geminiClient.ts` | System prompt passed in body; regex JSON parsing; fabricated URL in fallback | Modal drafts messages | Mock tests pass | **PARTIAL** | Use proper `systemInstruction`, structured schema, real fallback without fabricated URLs, wire `/api/ai/diagnose`. |
| 10 | **Fair Metrics Semantics (Gross vs Net)** | `counterfactualEvaluation.ts`, `MetricsOverview.tsx` | `incrementalRecoveredPaise` labeled net yield; Brier score restricted to budget | UI cards display rates | Benchmark tests pass | **DEFECT** | Fix `netIncrementalRecoveryPaise = recoverflowNet - baselineNet`; separate unsuccessful from preventable; report full-cohort Brier score. |
| 11 | **Verification Pipeline Termination & Artifact Verification** | `scripts/verify-artifacts.ts`, `package.json` | Vitest may hang on unclosed async handles; `verify:artifacts` lacks schema & diff check | CI / CLI execution | Needs execution | **DEFECT** | Fix async handle lifecycle in tests; upgrade `verify-artifacts.ts` to validate Zod schemas, counts, hashes, and git diff. |

---

## 2. Commit & Milestone Traceability
- **Stage 0**: Baseline audit & gap identification (`docs/RELEASE_INTEGRITY_AUDIT.md`)
- **Stage 1**: Vitest lifecycle fix, test reproducibility, removal of stale product identity
- **Stage 2**: Schema verification, deterministic hashes, git diff clean verification
- **Stage 3**: Non-circular training & evaluation lineage documentation
- **Stage 4**: Direct JSON artifact loading in UI and Evaluation Lab
- **Stage 5**: Closed-loop state machine as single primary workflow & Live Runner
- **Stage 6**: Real reviewer actions mutating state & hash chain
- **Stage 7**: Server-side recovery execution API with Razorpay test-mode integration
- **Stage 8**: Gemini AI system instruction hardening & diagnostic integration
- **Stage 9**: Canonical multi-event SHA-256 audit ledger
- **Stage 10**: Metric fairness, net incremental calculations, multi-seed reporting
- **Stage 11**: Product workspaces completion (Command Center, Live Runner, Promise-to-Pay, Help/Judge Guide)
- **Stage 12**: Responsive (5 viewports), Accessibility, and API error testing
- **Stage 13**: Complete documentation reconciliation
- **Stage 14**: Verification pass, Vercel preview deployment, and live preview verification
