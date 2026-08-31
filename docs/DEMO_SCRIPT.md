# PayBack AI — 5-Minute Evaluator Demonstration Script

> **Submission Document**: Razorpay AI Buildathon · Track 3: AI Revenue Recovery  
> **Repository**: [https://github.com/skmdshariff143-ai/recoverflow-ai](https://github.com/skmdshariff143-ai/recoverflow-ai)  
> **Live Production URL**: [https://recoverflow-ai-kohl.vercel.app](https://recoverflow-ai-kohl.vercel.app)

---

## 🎙️ The 20-Second Human Cold-Open

> *"Picture a merchant losing ₹50,000 every month not because customers refused to pay, but because their recovery tool was a blind bot that retried a permanently closed bank account three times, incurred gateway penalties, and pestered their most loyal enterprise customer during scheduled bank maintenance. PayBack AI is the only platform built on a mathematical guarantee: we prove our recovery calibration on independent ground-truth outcomes before a single rupee moves."*

---

## ⏱️ Exact 300-Second Demonstration Walkthrough

### Segment 1: The Control Center & Bounded Financial Math (0:20 – 1:00)
- **Target Page**: Dashboard Workspace (`https://recoverflow-ai-kohl.vercel.app`)
- **What to Show**: Top KPI Cards (`Total Revenue at Risk`, `Simulated Recovered`, `Safety Halted`).
- **What to Say**:  
  *"Here in the Control Center, PayBack AI ingests failed payment records and enforces hard safety invariants before allocating a single slot of recovery budget. All financial calculations use integer paise—zero floating-point drift. Across this 100-record batch, ₹1,46,900 is recovered across 18 high-confidence invoices while 26 permanent failures and opt-outs are immediately halted."*
- **Visible Expected Result**: Top KPI panel displays ₹6,87,695 at risk, ₹1,46,900 recovered across 18 settled invoices, and 26 safety stops.
- **Backup Fallback**: If network is slow, local development server (`npm run dev`) mirrors identical deterministic values.

---

### Segment 2: EV-Ranked Queue & Explainable Decision Drawer (1:00 – 2:30)
- **Target Page**: Dashboard Priority Queue
- **What to Click**: Click on row `pay_00001` to open the **Explainable Decision Drilldown Drawer**.
- **What to Say**:  
  *"Every ranking is explainable. In the table, visual gradient bars show relative Expected Value ($\text{EV} = \text{Amount} \times \text{Prob}$) at a glance. In the drawer, you see the 8-stage Recovery Journey and the 6-factor deterministic waterfall showing exact score contributions (category base rate, on-time history, tenure, broken promises). For messy gateway logs, our bounded Gemini 3.6 Flash copilot normalizes errors and drafts empathetic recovery notifications with zero write access to payment state or execution triggers."*
- **Visible Expected Result**: 8-stage stepper renders stage statuses, 6-factor waterfall shows feature contributions, and Gemini Copilot card renders diagnosis and drafted notification.

---

### Segment 3: Live Execution Dispatch & Proactive Outcome Observation (2:30 – 3:30)
- **Target Page**: Inside the Decision Drawer
- **What to Click**: Click **Dispatch Live Execution** and **Run Outcome Check**.
- **What to Say**:  
  *"We enforce a strict accounting invariant: creating a test payment link records ₹0.00 recovered money until valid settlement is verified. Our proactive Outcome Observer polls the gateway status API (`GET /api/recovery/status/:id`) using stateless HMAC receipts, guaranteeing settlement verification without exposing vulnerable public webhook endpoints."*
- **Visible Expected Result**: Execution receipt shows `sim_txn_pay_00001_c1`, status `test_link_created` with ₹0 recovered, followed by verified settlement observation.

---

### Segment 4: Counterfactual Policy Simulator & Financial Waterfall (3:30 – 4:30)
- **Target Page**: **Evaluation Lab** Tab
- **What to Click**: Click **Evaluation Lab** tab; view the 7-Policy comparison table and the Reconciled Financial Waterfall.
- **What to Say**:  
  *"This is our primary differentiator. To eliminate self-fulfilling evaluation loops, we evaluate 7 distinct policies against identical frozen potential outcomes. Under the exact same 40-slot budget, PayBack AI achieves +₹3,93,159 (+470%) net recovery lift over a Fixed Retry baseline with a strictly proper Brier score of 0.1637. The financial waterfall reconciles 100% of revenue at risk to settled, stopped, and remaining exposure."*
- **Visible Expected Result**: 7-policy comparison matrix displays side-by-side yields, Brier scores, and error inspector breakdown.

---

### Segment 5: SHA-256 Cryptographic Audit Ledger (4:30 – 5:00)
- **Target Page**: **Audit Ledger** Tab
- **What to Click**: Click **Audit Ledger** tab, then click **Verify Ledger Integrity**.
- **What to Say**:  
  *"Finally, every state transition, operator approval, and settlement receipt is appended to an immutable SHA-256 hash chain from genesis. When you click Verify Ledger Integrity, our cryptographic engine recomputes every block hash in real time—proving zero records have been altered, reordered, or forged."*
- **Visible Expected Result**: Real-time green badge confirms `Cryptographic Verification Passed: All records hash-linked without tampering`.
