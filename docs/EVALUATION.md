# PayBack AI — Evaluation Methodology & Frozen Potential Outcomes

> **Submission Document**: Razorpay AI Buildathon · Track 3: AI Revenue Recovery

---

## 1. The Anti-Circular Evaluation Standard

A common flaw in ML prototypes is circular evaluation, where the same probability used to score an invoice is directly sampled to generate the simulated outcome. This produces artificial 100% calibration.

**PayBack AI enforces strict non-circular evaluation**:
1. **Independent Causal Transition Environment**: Ground truth outcomes are generated independently via `buildFrozenOutcomeEnvironment()`.
2. **Frozen Matrices**: Fixed arrays of potential outcomes for every payment, intervention type (`retry`, `reminder`, `both`), and attempt cycle (1, 2, 3).
3. **Equal-Capacity Fair Benchmarking**: All equal-budget comparison policies are constrained to the exact same 40 intervention slots.
