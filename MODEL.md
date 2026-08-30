# RecoverFlow AI — Scoring Model, Calibration & Counterfactual Evaluation Architecture

> **Submission Document**: Razorpay AI Buildathon · Track 3: AI Revenue Recovery  
> **Repository**: [https://github.com/skmdshariff143-ai/recoverflow-ai](https://github.com/skmdshariff143-ai/recoverflow-ai)  
> **Live Application**: [https://recoverflow-ai-kohl.vercel.app](https://recoverflow-ai-kohl.vercel.app)

---

## 1. Overview & Core Hypothesis

Traditional payment recovery engines rely on **blind rule cascades** (e.g., "retry all failed payments after 4 hours, then again after 24 hours"). This causes three major issues for high-volume merchants:
1. **Wasted Retry Capacity**: Burn contact slots and gateway fees on inherently unrecoverable payments (e.g., closed bank accounts, hard cancellations).
2. **Customer Friction & Churn**: Bombarding good customers with aggressive reminders during temporary bank outages or during local quiet hours.
3. **Sub-optimal Value Capture**: Treating a ₹50,000 enterprise invoice with an 80% recovery probability identically to a ₹200 one-off purchase with a 10% recovery probability.

**RecoverFlow AI** replaces blind cascades with a **calibrated, explainable prioritization engine**:

$$\text{Expected Value (Paise)} = \text{round}\left(\frac{\text{Amount (Paise)} \times P(\text{Recovery})_{\text{bps}}}{10,000}\right)$$

Recovery resources (limited retry slots and contact bandwidth) are allocated strictly descending by **Expected Value**, maximizing recovered revenue per unit of operational cost while strictly adhering to compliance and safety constraints.

---

## 2. Integer-Paise Financial Math & Invariants

To prevent floating-point rounding errors and precision drift across financial aggregations:
- All monetary values are represented strictly as **integer paise** ($1\text{ INR} = 100\text{ Paise}$).
- Probabilities are normalized into integer **basis points** ($100\% = 10,000\text{ bps}$).
- Expected Value calculation:
  $$\text{EV}_{\text{paise}} = \text{Math.round}\left(\frac{\text{amount}_{\text{paise}} \times \text{prob}_{\text{bps}}}{10,000}\right)$$
- Negative amounts are rejected at runtime via `validatePaiseAmount`.
- Cross-currency aggregations are strictly prevented via `assertMatchingCurrency`.

---

## 3. Deterministic Scoring & Logistic Calibration

### A. Feature Extraction Vector
Each failed payment $\mathbf{x}$ is mapped into a normalized feature vector:
1. **Category Base Rate**: Prior empirical baseline $x_1 \in [0, 1]$
2. **On-Time Payment Fraction**: $x_2 \in [0, 1]$
3. **Broken Promise Penalty**: $x_3 = \min(1, \text{count} / 3)$
4. **Recency Days**: $x_4 = \min(1, \text{daysElapsed} / 30)$
5. **Tenure Fraction**: $x_5 = \min(1, \text{months} / 24)$
6. **Attempt Penalty**: $x_6 = \min(1, \text{attempts} / 3)$
7. **Laplace Past Recovery Ratio**: $x_7 = \frac{\text{successes} + 1}{\text{successes} + \text{failures} + 2}$

### B. L2-Regularized Logistic Regression
$$\text{logit}(z) = \beta_0 + \sum_{j=1}^7 \beta_j x_j$$
$$P(\text{Recovery}) = \sigma(z) = \frac{1}{1 + e^{-z}}$$

---

## 4. Independent Frozen Outcome Environment (Non-Circular Evaluation)

To eliminate the circular evaluation flaw where a model samples outcomes from its own predictions:
1. **Separation of Concerns**: The **Decision Model** produces predictions using only pre-intervention features.
2. **Outcome Generator**: A separately defined physical environment generates **frozen potential outcomes** $\mathbf{Y}(i, a)$ for each payment $i$, intervention $a \in \{\text{retry}, \text{reminder}, \text{both}\}$, and attempt $k \in \{1, 2, 3\}$.
3. **Information Barrier**: The outcome generator **never** reads predicted probability, expected value, queue rank, or model confidence.
4. **Counterfactual Policy Evaluation**: RecoverFlow AI and control policies (Fixed Retry, Retry-All, High-Confidence Only) are evaluated against **identical frozen matrices**.

---

## 5. Multi-Cycle Closed-Loop State Machine

```
  DETECTED ──► DIAGNOSED ──► ELIGIBILITY_CHECKED ──► SCHEDULED ──► EXECUTING ──► OUTCOME_OBSERVED
                                 │                                                     │
                                 ├──► [Ineligible] ──► STOPPED                         ├──► RECOVERED
                                 │                                                     ├──► RETRY_SCHEDULED (cycle < 3)
                                 └──► [High Value] ──► APPROVAL_REQUIRED               └──► STOPPED (cycle >= 3)
```

- **Safety Filters**: Automatic hard stops for customer opt-out, max attempt cap ($\le 3$), and non-recoverable root causes.
- **Quiet-Hours Protection**: Dispatches only outside the customer's quiet window (`22:00`–`08:00` in their timezone).
- **Cryptographic Audit Ledger**: Every state transition event is appended to a tamper-evident SHA-256 hash chain.
