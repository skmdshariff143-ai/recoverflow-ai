# Phase 1: Root Codebase Triage Report

---

## 1. Root App Stabilization Summary

- Updated root `package.json` scripts to delegate `dev`, `build`, and `start` to workspace `@recoverflow/web`.
- Root `npm run build` and `npm run dev` compile the live Next.js 16 / Turbopack web application.
- Root `verify` and CI verification gates pass cleanly with zero regressions.

---

## 2. Root Components Triage Matrix (`src/components/`)

| Component Name | Classification | One-Line Rationale |
| :--- | :---: | :--- |
| **`AuditTrailExplorer.tsx`** | `MIGRATE` | Visualizes cryptographic SHA-256 hash-chain verification & tamper detection (vital for zero-trust compliance). |
| **`AutonomousControlRoom.tsx`** | `MIGRATE` | Real-time operations panel with loop runner, queue rate pacer, latency SLA gauges, and emergency circuit-breaker kill switch. |
| **`BlindBotReplayModal.tsx`** | `MIGRATE` | Counterfactual replay engine visually comparing MAB policy vs. naive dunning bot (+218% lift proof). |
| **`CalibrationVisualizer.tsx`** | `MIGRATE` | Reliability diagram & Expected Calibration Error (ECE) visualizer demonstrating Platt scaling & isotonic regression. |
| **`CaseRecoveryJourney.tsx`** | `REDUNDANT` | Step-by-step cart journey superseded by `apps/web/src/components/LiveChatMonitor.tsx` and `FunnelReplayModal.tsx`. |
| **`CommandPalette.tsx`** | `REDUNDANT` | Superseded by `apps/web/src/components/CommandPaletteModal.tsx` which includes Web Audio mechanical cues and shortcut bindings. |
| **`CostOfInactionCounter.tsx`** | `MIGRATE` | Live ticker of unrecovered revenue leaking per second without automated recovery (compelling CFO-level conversion UI). |
| **`EvaluationLab.tsx`** | `MIGRATE` | Interactive policy benchmark comparison suite comparing heuristic baseline, logistic regression, and multi-armed bandit. |
| **`ExplainDecisionModal.tsx`** | `MIGRATE` | Contrastive explainability ("Why X and not Y?") modal displaying logistic feature weights and top driver indicators. |
| **`FirstTimeVisitorSpotlight.tsx`** | `REDUNDANT` | First-time user spotlight onboarding widget superseded by `GuideMeTourModal.tsx` and `JudgeModeModal.tsx`. |
| **`GuideMeTourModal.tsx`** | `MIGRATE` | Interactive 5-step guided tour modal for reviewers and prospective customers. |
| **`Header.tsx`** | `REDUNDANT` | Root navbar superseded by `apps/web/src/app/page.tsx` top navigation bar. |
| **`HeroLoopVisualization.tsx`** | `MIGRATE` | Visual loop animation showing ingestion → scoring → intervention → outcome observation. |
| **`JudgeCheatSheetModal.tsx`** | `MIGRATE` | Evaluator reference modal mapping technical tracks directly to verification rubrics. |
| **`JudgeModeModal.tsx`** | `MIGRATE` | 10-step evaluator walkthrough modal with interactive checklist and deep-link step transitions. |
| **`LiveRecoveryRunner.tsx`** | `REDUNDANT` | Legacy payment batch runner superseded by `apps/web/src/components/LiveRecoveryStream.tsx`. |
| **`MerchantPolicyBuilder.tsx`** | `REDUNDANT` | Superseded by `apps/web/src/components/BrandToneCalibrationStudio.tsx` (brand voice, urgency, discount ceilings). |
| **`MerchantPortfolioComparison.tsx`** | `MIGRATE` | Multi-merchant benchmarking panel comparing SaaS vs D2C vs Luxury recovery curves. |
| **`MethodologyGuide.tsx`** | `MIGRATE` | Comprehensive interactive technical documentation tab detailing mathematical formulations, MAB RL equations, and SLAs. |
| **`MetricsOverview.tsx`** | `REDUNDANT` | High-level KPI metric cards superseded by `apps/web/src/components/ConversionAnalytics.tsx`. |
| **`PaymentDrilldownModal.tsx`** | `MIGRATE` | Diagnostic modal inspecting raw payment gateway error codes (3DS timeout, currency mismatch, bank throttle). |
| **`PromiseToPayTracker.tsx`** | `MIGRATE` | Customer commitment & deferred payment schedule tracker with active countdown timer. |
| **`QRCodeSVG.tsx`** | `MIGRATE` | Zero-dependency inline SVG renderer for dynamic India UPI (`upi://pay`) and Brazil Pix QR codes. |
| **`RankedQueueTable.tsx`** | `REDUNDANT` | Table of failed payments superseded by `apps/web/src/components/CartsExplorer.tsx`. |
| **`RazorpaySubscriptionsDashboard.tsx`** | `MIGRATE` | Live Razorpay subscription sync monitor with real-time webhook status and auto-dunning health. |
| **`RecoveryIntelligence.tsx`** | `REDUNDANT` | AI reasoning insights tab superseded by `apps/web/src/components/LiveChatMonitor.tsx` and `ConversionAnalytics.tsx`. |
| **`RegulatoryFootprintBadge.tsx`** | `MIGRATE` | Compliance badge displaying active RBI, DPDP, and GDPR data sovereignty safeguards. |
| **`SkeletonLoader.tsx`** | `MIGRATE` | Reusable shimmer skeleton loading component for high-polish async loading states. |
| **`StickySummaryBar.tsx`** | `DROP` | Legacy bottom floating bar tightly coupled only to the discarded `RankedQueueTable`. |
| **`TrustScoreWidget.tsx`** | `MIGRATE` | Dynamic safety trust score dial indicating margin guardrail compliance and zero-hallucination health. |

---

## 3. Root Logic & Engine Triage Matrix (`src/lib/`, `src/hooks/`, `src/types/`)

### A. Hooks (`src/hooks/`)
| Hook Name | Classification | One-Line Rationale |
| :--- | :---: | :--- |
| **`useRecoveryBatch.ts`** | `MIGRATE` | Contains state management for batch evaluation, hash-chain ledger events, and live simulation runner. |

### B. Types (`src/types/`)
| File | Classification | One-Line Rationale |
| :--- | :---: | :--- |
| **`payment.ts`** | `MIGRATE` | Defines raw payment failure categories, gateway response codes, and localized payment rail types. |
| **`pipeline.ts`** | `MIGRATE` | Defines batch intervention plans, ledger audit records, and evaluator tab navigation state. |
| **`schemas.ts`** | `MIGRATE` | Zod runtime validation schemas for payment events, recovery configurations, and webhooks. |
| **`errors.ts`** | `MIGRATE` | Domain error hierarchy (`ValidationError`, `SafetyViolationError`, `AdapterError`). |
| **`index.ts`** | `MIGRATE` | Barrel export for payment engine data types. |

### C. Library & Engine Modules (`src/lib/`)
| Directory / Module | Classification | One-Line Rationale |
| :--- | :---: | :--- |
| **`adapters/razorpaySubscriptionSync.ts`** | `MIGRATE` | Live Razorpay API client fetching plans and auto-syncing recurring subscriptions. |
| **`adapters/razorpayWebhook.ts`** | `MIGRATE` | Razorpay HMAC-SHA256 signature verifier and webhook event handler. |
| **`adapters/recoveryAdapter.ts`** | `MIGRATE` | Execution adapter abstraction for retrying payments and dispatching gateway links. |
| **`ai/geminiClient.ts`** | `REDUNDANT` | Legacy dunning copy generator superseded by `@recoverflow/agents` (`orchestrator.ts`, `concierge-agent.ts`). |
| **`data/benchmarkLoader.ts`** | `MIGRATE` | Loads the 200-record frozen benchmark and heldout adversarial datasets for verification. |
| **`data/judgeSafetyFixture.ts`** | `MIGRATE` | Deterministic safety evaluation fixture testing prompt injection resilience and margin limits. |
| **`engine/hashChainLedger.ts`** | `MIGRATE` | Cryptographic SHA-256 tamper-evident hash-chain ledger implementation with audit verification. |
| **`engine/calibration.ts`** | `MIGRATE` | Platt scaling & Expected Calibration Error (ECE) computation for ML probability estimates. |
| **`engine/contrastiveExplanation.ts`** | `MIGRATE` | Feature importance and contrastive decision explainer ("Why X instead of Y"). |
| **`engine/costOfInaction.ts`** | `MIGRATE` | Mathematical models for cumulative revenue leakage over time. |
| **`engine/counterfactualEvaluation.ts`** | `MIGRATE` | Off-policy evaluation comparing algorithmic policies against historical baselines. |
| **`engine/financial.ts`** | `MIGRATE` | Strict zero-drift integer paise arithmetic for net margin and recovery accounting. |
| **`engine/approvalGate.ts`** | `MIGRATE` | Dual-custody approval thresholds for high-value interventions (> ₹10,000 / $500). |
| **`engine/askLedger.ts`** | `MIGRATE` | Natural-language query interface over the cryptographic audit trail ledger. |
| **`engine/auditTrail.ts`** | `MIGRATE` | Structured audit event serializer and transition logger. |
| **`engine/modelMonitoring.ts`** | `MIGRATE` | Population Stability Index (PSI) and data drift monitoring. |
| **`engine/quietHours.ts`** | `MIGRATE` | Timezone-aware quiet hours calculator preventing customer contact during night windows. |
| **`engine/scoreRecovery.ts` & `trainModel.ts`** | `MIGRATE` | Logistic regression training and inference engine for recovery probability scoring. |
| **`engine/stateMachine.ts`** | `MIGRATE` | Formal state transition machine validating recovery lifecycle states. |
| **`engine/trustScore.ts`** | `MIGRATE` | Multi-factor trust score calculator measuring policy compliance and safety. |
| **`engine/utilityModel.ts`** | `MIGRATE` | Multi-objective expected value optimization balancing margin vs recovery probability. |
| **`engine/executeIntervention.ts`** | `REDUNDANT` | Superseded by `@recoverflow/jobs` recovery worker and channel dispatchers. |
| **`engine/generateData.ts`** | `REDUNDANT` | Legacy failed-payment generator (benchmark fixtures already frozen in `data/`). |
| **`engine/merchantProfiles.ts`** | `REDUNDANT` | Superseded by `@recoverflow/core` Merchant models and DB store. |
| **`engine/notificationPreview.ts`** | `REDUNDANT` | Superseded by `@recoverflow/agents` copy generation. |
| **`engine/policyConfig.ts`** | `REDUNDANT` | Superseded by `@recoverflow/agents` MAB bandit policies. |
| **`engine/rankAndAllocate.ts`** | `REDUNDANT` | Superseded by `@recoverflow/agents` Thompson Sampling multi-armed bandit. |
| **`engine/safetyFilter.ts`** | `REDUNDANT` | Superseded by `@recoverflow/agents` `guardrail.ts` and `circuit-breaker.ts`. |
| **`server/idempotencyStore.ts` & `atomicIdempotencyStore.ts`** | `REDUNDANT` | Superseded by `@recoverflow/core` `idempotency.ts`. |
| **`server/liveWebhookStore.ts` & `subscriptionStore.ts`** | `REDUNDANT` | In-memory store superseded by `@recoverflow/core` `db.ts`. |
| **`utils/audioCues.ts`** | `REDUNDANT` | Superseded by `apps/web/src/utils/soundEffects.ts`. |
| **`utils/fuzzyMatch.ts`** | `MIGRATE` | Levenshtein distance and fuzzy matcher for error codes and coupon strings. |
| **`utils/sanitizeProviderError.ts`** | `MIGRATE` | Gateway error code normalization and customer-facing error sanitizer. |
| **`utils/clock.ts` & `logger.ts`** | `MIGRATE` | Monotonic clock timing helper and structured JSON audit logger. |
