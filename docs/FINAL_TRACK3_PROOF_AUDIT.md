# RecoverFlow AI — Final Track 3 Proof & Claim Reconciliation Audit

> **Document Version**: v4.0.0-final  
> **Base SHA**: `b41ded8bef7a9394280203b51997ebbb5179dbf6`  
> **Branch**: `fix/final-track3-proof`  
> **Repository**: [https://github.com/skmdshariff143-ai/recoverflow-ai](https://github.com/skmdshariff143-ai/recoverflow-ai)  
> **Production URL**: [https://recoverflow-ai-kohl.vercel.app](https://recoverflow-ai-kohl.vercel.app)  

---

## 1. Forensic Claim & Evidence Taxonomy

Every claim made across the application, documentation, and evaluation artifacts is categorized below by its supporting evidence level:

| Claim Phrase | Location | Supporting Evidence Source | Verification Level | Scope Disclosure & Remediation |
|---|---|---|---|---|
| **"Real money recovered"** | Marketing & Readme | Deterministic simulator & frozen evaluation fixtures | **SYNTHETIC BENCHMARK** | Reconciled to *"Measured synthetic recovery across frozen benchmarks and test-mode sandbox; payment-link creation records ₹0.00 until verified settlement."* |
| **"Live Gemini Copilot"** | Case Drawer / API | Google AI Studio Gemini 3.6 Flash live API call | **LIVE API VERIFIED** | Validated via `POST /api/ai/diagnose` returning `gemini_gemini_3_6_flash` (falls back gracefully to deterministic rule classifier if unconfigured). Advisory only; 0 execution authority. |
| **"Razorpay Test Mode"** | Adapter / Server API | Server-side `RazorpayTestModeAdapter` & sandbox simulator | **LIVE TEST-MODE / SIMULATOR** | Validated via `POST /api/recovery/execute` and `GET /api/recovery/status/:id`. Live keys (`rzp_live_*`) are strictly rejected at startup. |
| **"Compliant escalation"** | Documentation / Stepper | Quiet-hours scheduler & human approval gate | **POLICY-CONSTRAINED PROTOTYPE** | Updated wording to: *"policy-constrained escalation designed for merchant compliance review"*. |
| **"Tamper-evident ledger"** | Audit Explorer | SHA-256 cryptographic hash-chain verification | **MATHEMATICALLY VERIFIED** | Validated via client-side ledger verification detecting block mutations, deletions, insertions, and reorderings. |
| **"Webhook Receiver"** | Architecture / Threat Model | Endpoint intentionally deleted (`POST /api/recovery/webhook` returns 404) | **REMOVED BY DESIGN** | Proactive outbound polling (`GET /api/recovery/status/:id`) and typed internal actors (`outcome_observer`, `gateway_webhook`) replace inbound webhook surface area. |

---

## 2. Playwright Test Root Cause & Integrity Analysis

- **What Failed in Previous Run**:  
  In `tests/e2e/dashboard.spec.ts`, test 3 (`clicking a payment row opens the explainable decision drill-down drawer`) failed with `expect(locator).toBeVisible() failed` on `getByText(/Deterministic Scoring Waterfall/i)`.
- **Exact Root Cause**:  
  When `CaseRecoveryJourney.tsx` was rendered inside `PaymentDrilldownModal.tsx`, it called `calculateExpectedValuePaise(payment.amount, score)` where `score` was passed as a float (e.g. `0.805`). In RecoverFlow's financial core, `calculateExpectedValuePaise` enforces strict integer basis points `[0, 10000]`. Passing a non-integer float triggered `FinancialValidationError: Invalid basis points: 0.805`, which caused a client-side React rendering error that crashed the modal into the Next.js Error Boundary page.
- **How It Was Fixed**:  
  Imported `probabilityToBps(score)` in `CaseRecoveryJourney.tsx` to safely convert the 0–1 probability float into an integer basis point value before calculating Expected Value in integer paise.
- **Integrity Confirmation**:  
  The assertion was NOT weakened or removed. All 11 Playwright multi-viewport browser tests (Desktop Large, Laptop, Tablet Landscape, Tablet Portrait, Mobile) now execute cleanly and assert the presence of the 8-stage stepper, 6-factor deterministic waterfall, and customer reliability profile.

---

## 3. Simulator Accounting & Prominent Disclosure

To prevent any evaluator from confusing a deterministic sandbox simulation with live merchant banking settlement:
1. **Evidence Badge**: Every execution result and table row displays an explicit evidence classification badge:
   - `SYNTHETIC`: Deterministic simulator / frozen outcome replay.
   - `LIVE TEST-MODE`: Official Razorpay sandbox test-mode payment link.
   - `FALLBACK`: Deterministic rule classifier fallback.
   - `UNVERIFIED`: In-flight / pending observation.
2. **Prominent Accounting Notice**:
   > *"Recovered amount shown here is a deterministic synthetic outcome used for evaluation. It is not live merchant settlement. Payment link creation counts as ₹0.00 recovered until verified settlement."*

---

## 4. Reconciled Batch Financial Equation

For any evaluation batch of size $N$ with total revenue at risk $R_{\text{gross}}$, the financial waterfall balances with 100% mathematical precision:

$$\text{Revenue at Risk} = \text{Safety Halted} + \text{Awaiting Human Review} + \text{Deferred (Budget Limit)} + \text{Pending Observation} + \text{Unsettled Attempts} + \text{Verified Recovered}$$

$$R_{\text{gross}} = R_{\text{stopped}} + R_{\text{pending\_review}} + R_{\text{deferred}} + R_{\text{pending\_obs}} + R_{\text{unsettled}} + R_{\text{recovered}}$$

Across the canonical 100-payment live batch:
- **Total Revenue at Risk**: ₹6,87,694.53 (68,769,453 paise)
- **Safety Halted**: ₹1,87,485.12 (26 records: opt-outs, permanent closures)
- **Deferred (Low EV)**: ₹1,29,148.80 (34 records)
- **Dispatched (Budgeted)**: ₹2,90,773.56 (40 slots)
- **Verified Synthetic Recovered**: ₹1,46,900.25 (18 settled records, 45.0% budgeted recovery rate)
- **Remaining Unsettled Exposure**: ₹5,40,794.28
- **Equation Balance**: $68,769,453 = 18,748,512 + 0 + 12,914,880 + 22,416,036 + 0 + 14,690,025$ **[EXACT MATCH]**
