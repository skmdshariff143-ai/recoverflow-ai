# RecoverFlow AI — Metrics & Financial KPI Formulations

> **Submission Document**: Razorpay AI Buildathon · Track 3: AI Revenue Recovery

---

## 1. Key Performance Indicators

### A. Expected Value ($\text{EV}_{\text{paise}}$)
$$\text{EV}_{\text{paise}} = \text{round}\left(\frac{\text{amount}_{\text{paise}} \times \text{bps}}{10000}\right)$$

### B. Statistical Brier Score Calibration
$$\text{BS} = \frac{1}{N} \sum_{i=1}^{N} (p_i - o_i)^2$$
Where:
- $p_i \in [0, 1]$ is the predicted recovery probability.
- $o_i \in \{0, 1\}$ is the observed empirical outcome.

### C. Net Simulated Recovery
$$\text{Net Yield} = \text{Recovered Revenue} - \sum \text{Intervention Costs}$$
Where costs are defined in integer paise:
- Gateway Retry API: ₹12.00 (1,200 paise)
- Customer Reminder SMS/Email: ₹5.00 (500 paise)
- Combined Multi-Channel: ₹17.00 (1,700 paise)

---

## 2. 7-Policy Evaluation Summary

| Policy | Intervention Capacity | Expected Value Prioritization | Safety Compliance |
|---|---|---|---|
| **RecoverFlow AI** | 40 slots | Yes (EV Ranked) | 100% (0 violations) |
| **Highest Amount First** | 40 slots | Partial (Amount only) | 100% |
| **Highest Probability First** | 40 slots | Partial (Probability only) | 100% |
| **Fixed Retry Control** | 40 slots | No (FIFO) | 100% |
| **Random Eligible Selection** | 40 slots | No (Pseudo-Random) | 100% |
| **Retry-All (Uncapped)** | Unbounded | No (All eligible) | 100% |
| **No-Action Baseline** | 0 slots | None | 100% |
