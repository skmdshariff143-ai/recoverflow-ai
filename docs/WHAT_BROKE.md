# PayBack AI — "What Broke & How It Was Fixed"

> **Submission Document**: Razorpay AI Buildathon · Track 3: AI Revenue Recovery  
> **Repository**: [https://github.com/skmdshariff143-ai/recoverflow-ai](https://github.com/skmdshariff143-ai/recoverflow-ai)  
> **Live URL**: [https://recoverflow-ai-kohl.vercel.app](https://recoverflow-ai-kohl.vercel.app)

This document provides transparent, specific accounts of real technical obstacles encountered during the architecture, implementation, and deployment of **PayBack AI** across Milestones 1 through 5, detailing root causes, diagnoses, fixes, and regression prevention.

---

### Incident 1: Next.js 16 Turbopack Relative Import Path Resolution in Client Hook

- **What Broke**:  
  During Milestone 5 (`next build`), Turbopack threw a production compilation error:  
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

### Incident 2: TypeScript Strict Exhaustiveness Error on `StopReason` Union Extension

- **What Broke**:  
  During Milestone 4 (`runBatch.ts` wiring), `tsc --noEmit` failed with:  
  `error TS2741: Property 'dispute_or_cancellation_signaled' is missing in type '{ customer_opted_out: number; non_recoverable_category: number; max_attempts_exceeded: number; }' but required in type 'Record<StopReason, number>'`.
- **How It Was Diagnosed**:  
  To support the safety rule requirement for immediate halts on customer disputes/cancellations mid-process, `StopReason` was extended from 3 variants to 4: `'customer_opted_out' | 'non_recoverable_category' | 'max_attempts_exceeded' | 'dispute_or_cancellation_signaled'`. Because `stoppedByReason` was strictly typed as `Record<StopReason, number>` in `rankAndAllocate.ts`, TypeScript enforced dictionary exhaustiveness.
- **How It Was Fixed**:  
  Explicitly initialized `dispute_or_cancellation_signaled: 0` in the accumulator dictionary and updated all downstream stop reason mappings in the UI and engine summary objects.
- **Test Preventing Regression**:  
  `npm run type-check` (`tsc --noEmit`) is configured as a mandatory quality gate before unit tests run.

---

### Incident 3: Playwright Strict-Mode Multi-Element Locator Collision in E2E Suite

- **What Broke**:  
  During Milestone 5 E2E test validation, Playwright failed with:  
  `Error: strict mode violation: getByText(/₹[0-9,]+/) resolved to 54 elements` and `getByText(/Brier Score/i) resolved to 2 elements`.
- **How It Was Diagnosed**:  
  The dashboard renders multiple currency values across KPI cards, the priority queue table, and the calibration summary. Playwright's locator engine enforces strict mode by default, preventing actions or visibility assertions on queries that match multiple DOM elements.
- **How It Was Fixed**:  
  1. Updated currency regex assertions to use `.first()`: `await expect(page.getByText(/₹[0-9,]+/).first()).toBeVisible()`.  
  2. Replaced substring queries with exact label lookups: `await expect(page.getByText('Brier Score', { exact: true })).toBeVisible()`.
- **Test Preventing Regression**:  
  `tests/e2e/dashboard.spec.ts` (6 full Playwright scenarios testing KPIs, sorting, filtering, drawer opening, and tab navigation).

---

### Incident 4: Mock Object Variance in Intervention Executor Unit Tests

- **What Broke**:  
  In `src/lib/engine/__tests__/executeIntervention.test.ts`, passing `Partial<FailedPayment>` and `Partial<PaymentScore>` to the mock item creator triggered `error TS2322: Type 'Partial<FailedPayment>' is not assignable to type 'FailedPayment'`.
- **How It Was Diagnosed**:  
  Spreading partial interfaces directly into a typed `PipelineItem` resulted in optional fields overriding non-nullable mandatory properties (`payment_id: string`).
- **How It Was Fixed**:  
  Created an explicit `MockItemOverrides` interface that accepts nested partials and safely merges them over valid default mock payment and score instances:
  ```typescript
  interface MockItemOverrides {
    payment?: Partial<FailedPayment>;
    score?: Partial<PaymentScore>;
    status?: PipelineItem['status'];
    // ...
  }
  ```
- **Test Preventing Regression**:  
  `src/lib/engine/__tests__/executeIntervention.test.ts` (6 unit tests verifying deterministic execution and safety halts).
