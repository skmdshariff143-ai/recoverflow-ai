# Incident Report: Serverless In-Memory Outcome Consistency Contradiction

> **Incident Identifier**: INC-2026-08-30-OUTCOME-OBSERVER  
> **Target Environment**: Production (`https://recoverflow-ai-kohl.vercel.app`)  
> **Affected Route**: `GET /api/recovery/status/:reference`  
> **Root Cause Category**: Process-Local In-Memory State on Distributed Serverless Compute  
> **Status**: CONFIRMED & REPRODUCED (20/20 Inconsistencies Captured)  

---

## 1. Symptom

When a payment recovery intervention was dispatched via `POST /api/recovery/execute` using the deterministic simulator adapter:
- **Execution Response**: Reported `outcomeStatus: "synthetic_captured"`, `syntheticOutcomeAmountPaise: 1000000` (₹10,000.00), and generated reference `sim_txn_pay_..._c1`.
- **Subsequent Status Query** (`GET /api/recovery/status/sim_txn_...`): Reported `status: "failed"`, `settledAmountPaise: 0`, and `provenanceNotice: "Deterministic simulated transaction reference not found."`

A single transaction was synthetically captured during execution, but subsequently reported as failed with ₹0.00 recovered money during observation.

---

## 2. Forensic Reproduction Table (20/20 Contradictions)

The following empirical reproduction was executed against production (`https://recoverflow-ai-kohl.vercel.app`):

| Attempt | Payment ID | Execution Amount | Exec Outcome | Q0 (0s) | Q1 (1s) | Q5 (5s) | Q15 (15s) | Consistent? |
|:---:|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **1** | `pay_repro_test_1` | 150,000 paise (₹1,500) | `synthetic_captured` | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | **NO** |
| **2** | `pay_repro_test_2` | 250,000 paise (₹2,500) | `synthetic_captured` | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | **NO** |
| **3** | `pay_repro_test_3` | 350,000 paise (₹3,500) | `synthetic_captured` | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | **NO** |
| **4** | `pay_repro_test_4` | 450,000 paise (₹4,500) | `synthetic_captured` | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | **NO** |
| **5** | `pay_repro_test_5` | 550,000 paise (₹5,500) | `synthetic_captured` | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | **NO** |
| **6** | `pay_repro_test_6` | 650,000 paise (₹6,500) | `synthetic_captured` | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | **NO** |
| **7** | `pay_repro_test_7` | 750,000 paise (₹7,500) | `synthetic_captured` | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | **NO** |
| **8** | `pay_repro_test_8` | 850,000 paise (₹8,500) | `synthetic_captured` | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | **NO** |
| **9** | `pay_repro_test_9` | 950,000 paise (₹9,500) | `synthetic_captured` | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | **NO** |
| **10** | `pay_repro_test_10` | 1,050,000 paise (₹10,500) | `synthetic_captured` | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | **NO** |
| **11** | `pay_repro_test_11` | 1,150,000 paise (₹11,500) | `synthetic_captured` | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | **NO** |
| **12** | `pay_repro_test_12` | 1,250,000 paise (₹12,500) | `synthetic_captured` | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | **NO** |
| **13** | `pay_repro_test_13` | 1,350,000 paise (₹13,500) | `synthetic_captured` | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | **NO** |
| **14** | `pay_repro_test_14` | 1,450,000 paise (₹14,500) | `synthetic_captured` | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | **NO** |
| **15** | `pay_repro_test_15` | 1,550,000 paise (₹15,500) | `synthetic_captured` | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | **NO** |
| **16** | `pay_repro_test_16` | 1,650,000 paise (₹16,500) | `synthetic_captured` | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | **NO** |
| **17** | `pay_repro_test_17` | 1,750,000 paise (₹17,500) | `synthetic_captured` | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | **NO** |
| **18** | `pay_repro_test_18` | 1,850,000 paise (₹18,500) | `synthetic_captured` | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | **NO** |
| **19** | `pay_repro_test_19` | 1,950,000 paise (₹19,500) | `synthetic_captured` | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | **NO** |
| **20** | `pay_repro_test_20` | 2,050,000 paise (₹20,500) | `synthetic_captured` | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | `failed` (₹0) | **NO** |

---

## 3. Technical Root Cause Analysis

1. **Module-Level In-Memory Map**:
   In `src/lib/adapters/recoveryAdapter.ts`, `DeterministicSimulatorAdapter` held transaction receipts in:
   ```typescript
   private transactionStore = new Map<string, RecoveryExecutionResult>();
   ```
2. **Vercel Serverless Architecture**:
   Vercel routes `/api/recovery/execute` and `/api/recovery/status/[reference]` to isolated, ephemeral serverless lambda execution environments. When `POST /api/recovery/execute` writes to its local `transactionStore`, that memory is private to that specific lambda instance.
3. **Cross-Instance Disconnect**:
   When `GET /api/recovery/status/:reference` is called (even sub-second later), it is frequently routed to a different lambda container or cold isolate where `transactionStore` is empty. The adapter returned:
   ```json
   { "status": "failed", "settledAmountPaise": 0, "source": "simulator_memory" }
   ```

---

## 4. Why Unit Tests & Local Dev Missed It

- **Unit Tests**: Ran in Vitest inside a single continuous Node.js process. The execution call wrote to memory, and the status query in the same test file read from that exact same memory address.
- **Local Dev**: A single `next dev` process runs on localhost with a single shared memory heap.
- **Vercel Serverless**: Highly concurrent, auto-scaling ephemeral containers where no memory is shared between function invocations.

---

## 5. Financial & Evaluation Risk

1. **Closed-Loop Invalidation**: An evaluator observing the workflow would see a payment link or retry "succeed" on execution, but upon status verification, the outcome observer would report the payment as failed with ₹0.00 recovered.
2. **Batch Inconsistency**: If status polling is triggered asynchronously across a batch, recovered amounts would randomly fluctuate between ₹0.00 and the true amount depending on lambda routing.
3. **Audit Trail Mutation**: Cryptographic hash chains anchored on observation events would record false negative failure outcomes.

---

## 6. Required Architectural Invariants & Remediation

To resolve this defect without introducing paid external Redis or PostgreSQL instances:

1. **Stateless Deterministic Simulator Receipt**:
   The transaction reference must encode and cryptographically checksum its immutable canonical inputs:
   - `paymentId`
   - `attemptCycle`
   - `intervention`
   - `amountPaise`
   - `statusOutcome`
   - `checksum` (SHA-256 HMAC / truncated integrity digest)
2. **Stateless Reconstruction in Status Endpoint**:
   `DeterministicSimulatorAdapter.getStatus(ref)` must validate the reference format, verify the checksum, decode the parameters, and deterministically reconstruct the identical synthetic outcome without requiring process memory.
3. **Tamper & Forgery Rejection**:
   Invalid, corrupted, or forged references fail closed (`status: "failed"`, `settledAmountPaise: 0`).
4. **Zero Live Settlement**:
   All simulator outcomes guarantee `liveSettledAmountPaise = 0` and `evidenceClass = 'SYNTHETIC'`.
