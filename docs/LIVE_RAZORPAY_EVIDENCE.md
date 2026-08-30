# RecoverFlow AI — Genuine Live Recovery Execution Evidence

> **Evidence Source**: Programmatically captured by `scripts/capture-live-evidence.ts`  
> **Target Host**: `https://recoverflow-ai-kohl.vercel.app`  
> **Capture Timestamp**: `2026-08-30T11:29:42.752Z`  
> **Evidence JSON**: [`docs/evidence/live-razorpay.json`](./evidence/live-razorpay.json)

---

## 1. Truth & Disclosure Summary

- **Simulator Execution**: Verified live on deployed serverless host with status `test_link_created`.
- **Razorpay Sandbox Status**: Razorpay adapter implemented and unit-tested; live test-mode execution remains unverified.
- **Recovery Accounting Guarantee**: ₹0.00 recovered money recorded upon payment link creation.
- **Polling & Observation Notice**: Workflow tracks payment settlement via proactive status polling and internal actor telemetry (`gateway_webhook`, `outcome_observer`).
- **Idempotency Scope**: Best-effort single-instance memory store; production multi-instance requires distributed Redis/PostgreSQL.

---

## 2. Programmatically Captured HTTP Transcripts

### Test 1: Simulator Execution Dispatch (`POST /api/recovery/execute`)

```json
{
  "endpoint": "/api/recovery/execute",
  "method": "POST",
  "requestHeaders": {
    "x-recovery-adapter": "simulator"
  },
  "requestBody": {
    "paymentId": "pay_live_test_001",
    "customerId": "cust_live_001",
    "customerName": "Live Capture Customer",
    "customerEmail": "finance@live-test.com",
    "amountPaise": 450000,
    "currency": "INR",
    "intervention": "reminder",
    "attemptCycle": 1,
    "idempotencyKey": "idemp_live_1788089381498"
  },
  "httpStatus": 200,
  "responseBody": {
    "success": false,
    "receipt": {
      "success": false,
      "transactionReference": "sim_txn_pay_live_test_001_c1",
      "adapterUsed": "deterministic_simulator",
      "settledAmountPaise": 0,
      "status": "test_link_created",
      "latencyMs": 15,
      "timestamp": "2026-08-30T11:29:43.061Z",
      "rawResponseSummary": "Deterministic simulated execution for reminder (cycle 1). Settlement: PENDING."
    },
    "serverTimestamp": "2026-08-30T11:29:43.061Z",
    "idempotencyStatus": "new_execution_recorded",
    "securityDisclaimer": "Executed in Test Mode. Zero real financial debit triggered."
  },
  "timestamp": "2026-08-30T11:29:41.498Z",
  "latencyMs": 492
}
```

---

### Test 2: Transaction Status Query (`GET /api/recovery/status/:reference`)

```json
{
  "endpoint": "/api/recovery/status/sim_txn_pay_live_test_001_c1",
  "method": "GET",
  "requestHeaders": {},
  "httpStatus": 200,
  "responseBody": {
    "reference": "sim_txn_pay_live_test_001_c1",
    "status": "test_link_created",
    "settledAmountPaise": 0,
    "source": "simulator_memory",
    "adapter": "deterministic_simulator",
    "timestamp": "2026-08-30T11:29:43.341Z"
  },
  "timestamp": "2026-08-30T11:29:41.990Z",
  "latencyMs": 280
}
```

---

### Test 3: Razorpay Test-Mode Adapter Execution (`POST /api/recovery/execute`)

```json
{
  "endpoint": "/api/recovery/execute",
  "method": "POST",
  "requestHeaders": {
    "x-recovery-adapter": "razorpay_test_mode"
  },
  "requestBody": {
    "paymentId": "pay_rzp_check_001",
    "customerId": "cust_rzp_001",
    "customerName": "Razorpay Sandbox Test",
    "customerEmail": "sandbox@merchant.com",
    "amountPaise": 250000,
    "currency": "INR",
    "intervention": "retry",
    "attemptCycle": 1,
    "idempotencyKey": "idemp_rzp_1788089382270"
  },
  "httpStatus": 200,
  "responseBody": {
    "success": false,
    "receipt": {
      "success": false,
      "transactionReference": "rzp_unconfigured_pay_rzp_check_001",
      "adapterUsed": "razorpay_test_mode",
      "settledAmountPaise": 0,
      "status": "failed",
      "latencyMs": 5,
      "timestamp": "2026-08-30T11:29:43.823Z",
      "rawResponseSummary": "Razorpay Test-Mode credentials not configured in environment (RAZORPAY_KEY_ID must start with rzp_test_).",
      "errorMessage": "RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET missing"
    },
    "serverTimestamp": "2026-08-30T11:29:43.824Z",
    "idempotencyStatus": "new_execution_recorded",
    "securityDisclaimer": "Executed in Test Mode. Zero real financial debit triggered."
  },
  "timestamp": "2026-08-30T11:29:42.270Z",
  "latencyMs": 482
}
```
