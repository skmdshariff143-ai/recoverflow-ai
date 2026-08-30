# RecoverFlow AI — "What Broke & How It Was Fixed"

> **Submission Document**: Razorpay AI Buildathon · Track 3: AI Revenue Recovery  
> **Repository**: [https://github.com/skmdshariff143-ai/recoverflow-ai](https://github.com/skmdshariff143-ai/recoverflow-ai)  
> **Live Production URL**: [https://recoverflow-ai-kohl.vercel.app](https://recoverflow-ai-kohl.vercel.app)

This document provides transparent, specific accounts of real technical obstacles encountered during the architecture, implementation, and deployment of **RecoverFlow AI**, detailing root causes, diagnoses, fixes, and regression prevention.

---

### Incident 1: Payment-Link Creation Accounting Invariant & Outbound Polling Shift

- **What Broke**:  
  In early prototype iterations, creating a test-mode payment link immediately marked the transaction as "recovered", registering gross recovered revenue in top KPI metrics before customer settlement had occurred. Additionally, hosting a public inbound webhook endpoint introduced unverified exposure in serverless environments where webhook secret credentials might be unconfigured.
- **Incorrect Assumption**:  
  Conflating *successful API dispatch* (e.g. creating a Razorpay test link) with *verified fund settlement*.
- **Root Cause**:  
  Overloaded status semantics in the adapter layer. Creating a payment link is merely an intervention dispatch, not an observed settlement.
- **Financial Risk Introduced**:  
  Gross overstatement of recovered revenue on reminder links that customers never actually paid.
- **How It Was Fixed**:  
  1. **Strict Accounting Separation**: Enforced in `recoveryAdapter.ts` that creating a payment link records `settledAmountPaise: 0` and `status: 'test_link_created'`.
  2. **Proactive Outcome Observation**: Revenue is credited *only* after `outcomeObserverManager` verifies an explicit `captured` or `paid` status from the gateway.
  3. **Removed Public Webhook Endpoint**: Completely deleted the public `POST /api/recovery/webhook` route (returns HTTP 404), replacing inbound push with deterministic outbound API status polling (`GET /api/recovery/status/:id`) and internal telemetry actors (`outcome_observer`, `gateway_webhook`).
- **Test Preventing Regression**:  
  `src/lib/engine/__tests__/closedLoopProductFlow.test.ts` asserts that payment link creation returns `settledAmountPaise: 0`, and `src/lib/engine/__tests__/outcomeObserver.test.ts` validates that only verified captured outcomes update recovered balances.

---

### Incident 2: Next.js 16 Turbopack Relative Import Path Resolution in Client Hook

- **What Broke**:  
  During build verification (`next build`), Turbopack threw a production compilation error:  
  `Error: Module not found: Can't resolve '../../../data/synthetic-payments.json' in './src/hooks/useRecoveryBatch.ts'`.
- **How It Was Diagnosed**:  
  The Vitest unit test suite executed cleanly in Node.js because Node's module resolution traversed the relative file path. However, Next.js 16's Turbopack bundler strictly isolates client-side bundle trees and disallows static JSON imports referencing paths outside the root `src/` boundary during static site generation.
- **How It Was Fixed**:  
  Instead of importing a static JSON file, `useRecoveryBatch.ts` was refactored to call the pure, deterministic synthetic data generator function directly:  
  `options.initialPayments ?? generateSyntheticPayments({ seed: 42, totalRecords: 100 })`.  
  This eliminated external static file dependencies while preserving exact reproducibility via seeded PRNG.
- **Test Preventing Regression**:  
  `npm run build` (Next.js Turbopack production compilation) runs on every commit and pull request before E2E tests execute.

---

### Incident 3: TypeScript Strict Exhaustiveness Error on `StopReason` Union Extension

- **What Broke**:  
  During engine wiring, `tsc --noEmit` failed with:  
  `error TS2741: Property 'dispute_or_cancellation_signaled' is missing in type '{ customer_opted_out: number; non_recoverable_category: number; max_attempts_exceeded: number; }' but required in type 'Record<StopReason, number>'`.
- **How It Was Diagnosed**:  
  To support the safety rule requirement for immediate halts on customer disputes/cancellations mid-process, `StopReason` was extended from 3 variants to 4: `'customer_opted_out' | 'non_recoverable_category' | 'max_attempts_exceeded' | 'dispute_or_cancellation_signaled'`. Because `stoppedByReason` was strictly typed as `Record<StopReason, number>` in `rankAndAllocate.ts`, TypeScript enforced dictionary exhaustiveness.
- **How It Was Fixed**:  
  Explicitly initialized `dispute_or_cancellation_signaled: 0` in the accumulator dictionary and updated all downstream stop reason mappings in the UI and engine summary objects.
- **Test Preventing Regression**:  
  `npm run type-check` (`tsc --noEmit`) is configured as a mandatory quality gate before unit tests run.

---

### Incident 4: Playwright Strict-Mode Multi-Element Locator Collision in E2E Suite

- **What Broke**:  
  During E2E test validation, Playwright failed with:  
  `Error: strict mode violation: getByText(/₹[0-9,]+/) resolved to 54 elements` and `getByText(/Brier Score/i) resolved to 2 elements`.
- **How It Was Diagnosed**:  
  The dashboard renders multiple currency values across KPI cards, the priority queue table, and the calibration summary. Playwright's locator engine enforces strict mode by default, preventing actions or visibility assertions on queries that match multiple DOM elements.
- **How It Was Fixed**:  
  1. Updated currency regex assertions to use `.first()`: `await expect(page.getByText(/₹[0-9,]+/).first()).toBeVisible()`.  
  2. Replaced substring queries with exact label lookups: `await expect(page.getByText('Brier Score', { exact: true })).toBeVisible()`.
- **Test Preventing Regression**:  
  `tests/e2e/dashboard.spec.ts` (6 full Playwright scenarios testing KPIs, sorting, filtering, drawer opening, and tab navigation).

---

### Incident 5: Feature Extraction Timestamp NaN Guard

- **What Broke**:  
  When testing synthetic mock payments with partial schemas (e.g. having `created_at` but not `failure_timestamp`), `Date.parse(payment.failure_timestamp)` evaluated to `NaN`, which propagated through exponential recency decay calculations and caused `probabilityToBps` to throw a `FinancialValidationError: Invalid probability value: NaN`.
- **How It Was Diagnosed**:  
  `extractFeatureVector` relied solely on `payment.failure_timestamp`. If an upstream caller passed a record with `created_at` or omitted timestamps, arithmetic difference operations produced `NaN`.
- **How It Was Fixed**:  
  Added defensive timestamp extraction in `trainModel.ts`:
  ```typescript
  const tsStr = payment.failure_timestamp ?? payment.created_at;
  const failureTime = tsStr ? new Date(tsStr).getTime() : refDate.getTime();
  const diffDays = isNaN(failureTime) ? 0 : Math.max(0, (refDate.getTime() - failureTime) / (1000 * 60 * 60 * 24));
  const recencyDecay = Math.exp(-diffDays / 14);
  ```
- **Test Preventing Regression**:  
  `src/lib/engine/__tests__/closedLoopProductFlow.test.ts` tests end-to-end scoring, approval gating, and execution on partial/enterprise records without NaN exceptions.

---

### Incident 6: Hash Chain Tampering at Specific Index Detection

- **What Broke**:  
  Initial hash-chain verification only checked `latestHash === expected`. If a record in the middle was mutated, the verification reported a generic failure without identifying the compromised block index.
- **How It Was Diagnosed**:  
  Auditing requirements for enterprise banking ledgers require pin-pointing the exact record index where a hash break or payload mutation occurred.
- **How It Was Fixed**:  
  Implemented `verifyLedgerIntegrity()` in `hashChainLedger.ts` which iterates through the entire chain, recomputing SHA-256 digests over canonical JSON payloads and reporting `tamperedIndex` alongside detailed error descriptions.
- **Test Preventing Regression**:  
  `src/lib/engine/__tests__/hashChainLedger.test.ts` explicitly asserts `tamperedIndex: 1` when mutating, deleting, reordering, or inserting blocks.

---

### Incident 7: Serverless Process-Local Memory Disconnect in Deterministic Simulator Observation

- **What Broke**:  
  When testing against the deployed Vercel production environment, executing a recovery intervention via `POST /api/recovery/execute` returned `outcomeStatus: "synthetic_captured"` with ₹10,000.00 recovered, but querying `GET /api/recovery/status/:reference` immediately returned `status: "failed"` with ₹0.00 recovered and `"transaction reference not found"`.
- **How It Was Diagnosed**:  
  `DeterministicSimulatorAdapter` stored simulated receipts in an in-memory JavaScript `Map` (`this.transactionStore`). On Vercel serverless infrastructure, the execute endpoint and the status endpoint execute in isolated, ephemeral Lambda / V8 isolate environments. When the status request was routed to a different serverless instance, its process-local `transactionStore` was empty.
- **Financial & Evaluation Risk**:  
  A single payment was reported as synthetically captured during execution but observed as failed with ₹0.00 during status polling, undermining closed-loop recovery claims, batch accounting consistency, and audit ledger integrity.
- **How It Was Fixed**:  
  1. **Stateless Checksummed Receipt Architecture**: Redesigned simulator transaction references to be completely self-authenticating:  
     `sim_txn_<paymentId>_c<attemptCycle>_<intervention>_<amountPaise>_<outcomeCode>_<checksum12>`.  
  2. **Stateless Outcome Reconstruction**: `DeterministicSimulatorAdapter.getStatus()` extracts the immutable inputs, validates the SHA-256 checksum, and deterministically reconstructs the identical outcome across any serverless instance without requiring shared memory or external databases.  
  3. **Tamper Rejection (Fail Closed)**: Forged or modified references fail checksum verification and return `status: "failed"`, `liveSettledAmountPaise: 0`, and `syntheticOutcomeAmountPaise: 0`.  
  4. **Conflict Detection**: `OutcomeObservationManager` detects contradictory provider signals for the same intervention and routes them to `OUTCOME_CONFLICT` without double-crediting revenue.
- **Test Preventing Regression**:  
  `src/lib/adapters/__tests__/recoveryAdapter.test.ts` asserts stateless reconstruction across fresh unshared instances, tamper rejection, and 25 parallel concurrent requests; `scripts/verify-outcome-consistency.ts` audits live deployed hosts.
