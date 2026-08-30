# RecoverFlow AI — 5-Minute Evaluator Demonstration Script

> **Submission Document**: Razorpay AI Buildathon · Track 3: AI Revenue Recovery  
> **Repository**: [https://github.com/skmdshariff143-ai/recoverflow-ai](https://github.com/skmdshariff143-ai/recoverflow-ai)  
> **Live Production URL**: [https://recoverflow-ai-kohl.vercel.app](https://recoverflow-ai-kohl.vercel.app)

---

## ⏱️ Exact 300-Second Demonstration Walkthrough

### Segment 1: The Merchant Problem & Control Center (0:00 – 1:00)
- **Target Page**: Dashboard Workspace (`https://recoverflow-ai-kohl.vercel.app`)
- **What to Click**: Focus on Top KPI Cards (`Total Revenue at Risk`, `Simulated Recovered`, `Safety Halted`).
- **What to Say**:  
  *"Traditional recovery bots execute blind cascades—retrying hopeless failures like closed accounts while harassing customers during temporary bank downtime. RecoverFlow AI ingests failed payment records, enforces hard safety stopping invariants, and dynamically ranks interventions by Expected Value in integer paise."*
- **Visible Expected Result**: Top KPI panel displays ₹6,87,695 at risk, ₹1,46,900 recovered across 18 settled invoices, and 26 safety stops.
- **Backup Fallback**: If network is slow, local development server (`npm run dev`) mirrors identical deterministic values.

---

### Segment 2: Ranked Queue & Explainable Decision Drawer (1:00 – 2:30)
- **Target Page**: Dashboard Priority Queue
- **What to Click**: Click on row `pay_00001` to open the **Explainable Decision Drilldown Drawer**.
- **What to Say**:  
  *"Every decision is fully explainable. Here you see the 8-stage Recovery Journey from detection to audit. The 6-factor deterministic waterfall shows exact score contributions (base failure rate, on-time history, tenure, broken promises). For unstructured bank error codes, our bounded Gemini 3.6 Flash copilot normalizes gateway logs and drafts empathetic recovery notifications with zero execution privileges."*
- **Visible Expected Result**: 8-stage stepper renders stage statuses, 6-factor waterfall shows feature contributions, and Gemini Copilot card renders diagnosis and drafted notification.

---

### Segment 3: Live Execution Dispatch & Proactive Outcome Observation (2:30 – 3:30)
- **Target Page**: Inside the Decision Drawer
- **What to Click**: Click **Dispatch Live Execution** and **Run Outcome Check**.
- **What to Say**:  
  *"We enforce a strict accounting invariant: creating a test payment link records ₹0.00 recovered money until valid settlement is verified. Our proactive Outcome Observer polls the gateway API to verify settlement without requiring public webhook receivers."*
- **Visible Expected Result**: Execution receipt shows `sim_txn_pay_00001_c1`, status `test_link_created` with ₹0 recovered, followed by verified settlement observation.

---

### Segment 4: Counterfactual Policy Simulator & Financial Waterfall (3:30 – 4:30)
- **Target Page**: **Evaluation Lab** Tab
- **What to Click**: Click **Evaluation Lab** tab; view the 7-Policy comparison table and the Reconciled Financial Waterfall.
- **What to Say**:  
  *"To eliminate circular evaluation bias, we test 7 policies against identical frozen potential outcomes. RecoverFlow AI achieves +₹3,93,159 (+470%) net recovery lift over a Fixed Retry baseline under an identical 40-slot budget. The financial waterfall reconciles 100% of revenue at risk to settled, stopped, and remaining exposure."*
- **Visible Expected Result**: 7-policy comparison matrix displays side-by-side yields, Brier scores, and error inspector breakdown.

---

### Segment 5: SHA-256 Cryptographic Audit Ledger (4:30 – 5:00)
- **Target Page**: **Audit Ledger** Tab
- **What to Click**: Click **Audit Ledger** tab, then click **Verify Ledger Integrity**.
- **What to Say**:  
  *"Every state transition, operator approval, and settlement is appended to an immutable SHA-256 hash chain. When verified, our client-side cryptographic engine recomputes all block hashes in real time to detect any tampering, reordering, or counterfeit blocks."*
- **Visible Expected Result**: Real-time green badge confirms `100% Cryptographically Valid (All Block Hashes Verified)`.
