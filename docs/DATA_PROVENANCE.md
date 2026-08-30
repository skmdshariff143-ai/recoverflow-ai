# RecoverFlow AI — Data Provenance & Lineage Specification

> **Track**: Razorpay AI Buildathon — Track 3: AI Revenue Recovery  
> **Document**: Data Lineage, Assumptions, and Non-Circular Evaluation Architecture

---

## 1. Dataset Taxonomy & Separation

RecoverFlow AI strictly separates its datasets into three disjoint cohorts to prevent data leakage and self-fulfilling evaluation loops:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             RECOVERFLOW AI DATASETS                              │
├────────────────────────────┬────────────────────────────┬────────────────────────┤
│ 1. Synthetic Training Set  │ 2. Development Benchmark   │ 3. Frozen Internal     │
│                            │    Cohort                  │    Adversarial Stress  │
├────────────────────────────┼────────────────────────────┼────────────────────────┤
│ • File: Generated (seed 42)│ • File: dev-payments-200   │ • File: heldout-       │
│ • Records: 500 payments    │ • Records: 200 payments    │   adversarial-80       │
│ • Role: Learn L2 logistic  │ • Role: Policy benchmarking│ • Records: 80 payments │
│   regression weights       │   & calibration validation │ • Role: Edge case &    │
│ • Labels: Simulated        │ • Outcomes: frozen-        │   adversarial testing  │
│   synthetic training       │   outcomes-200.json        │ • Outcomes: frozen-    │
│   cohort                   │ • Hash: Checked in & SHA256│   outcomes-heldout-80  │
└────────────────────────────┴────────────────────────────┴────────────────────────┘
```

---

## 2. Declared Synthetic Simulation Assumptions

All underlying transition baseline rates are **declared synthetic simulation assumptions** based on payment gateway benchmarks:

1. **Transient Infrastructure Outages** (`bank_downtime`, `gateway_degradation`): High base physical recovery likelihood ($70\%\text{--}80\%$) via automated gateway retries.
2. **Customer Friction & Expired Credentials** (`expired_card`, `invalid_mandate`): High recovery sensitivity to customer reminders ($45\%\text{--}70\%$) prompting card updates; near-zero recovery via blind retries.
3. **Hard Account Ineligibility** (`permanent_account_closure`, `opt_out`, `customer_cancellation`): **Strict $0\%$ physical recovery rate** across all channels and attempt numbers.
4. **Attempt Fatigue Decay**: Each subsequent retry experiences physical decay ($1.0 \to 0.75 \to 0.50$).

---

## 3. Information Barrier & Anti-Leakage Proof

- The **Outcome Generator** (`outcomeEnvironment.ts`) accepts only `payment: FailedPayment` and an independent `seed: number`.
- The **Scoring Engine** (`scoreRecovery.ts`, `trainModel.ts`) has zero access to future potential outcome matrices.
- The **Evaluation Engine** (`counterfactualEvaluation.ts`) evaluates all policies (RecoverFlow AI, Fixed Retry Control, Retry-All, High-Confidence Only) against **identical frozen matrices**.
