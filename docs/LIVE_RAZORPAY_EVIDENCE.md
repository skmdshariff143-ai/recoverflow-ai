# RecoverFlow AI — Genuine Live Recovery Execution Evidence

> **Evidence Source**: Programmatically captured by `scripts/capture-live-evidence.ts`  
> **Target Host**: `https://recoverflow-ai-kohl.vercel.app`  
> **Capture Timestamp**: `2026-08-30T10:11:25.461Z`  
> **Evidence JSON**: [`docs/evidence/live-razorpay.json`](./evidence/live-razorpay.json)

---

## 1. Truth & Disclosure Summary

- **Simulator Execution**: Verified live on deployed serverless host with status `test_link_created`.
- **Razorpay Sandbox Status**: `Razorpay Test-Mode credentials not configured in environment (RAZORPAY_KEY_ID must start with rzp_test_).`
- **Recovery Accounting Guarantee**: ₹0.00 recovered money recorded upon payment link creation.
- **Webhook Delivery Notice**: Webhook implementation is verified through signed integration tests (`recoveryAdapter.test.ts`); live inbound Razorpay delivery was not observed during this automated test-mode execution run.
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
    "idempotencyKey": "idemp_live_1788084683938"
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
      "timestamp": "2026-08-30T10:11:25.474Z",
      "rawResponseSummary": "Deterministic simulated execution for reminder (cycle 1). Settlement: PENDING."
    },
    "serverTimestamp": "2026-08-30T10:11:25.474Z",
    "idempotencyStatus": "new_execution_recorded",
    "securityDisclaimer": "Executed in Test Mode. Zero real financial debit triggered."
  },
  "timestamp": "2026-08-30T10:11:23.938Z",
  "latencyMs": 496
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
    "timestamp": "2026-08-30T10:11:25.749Z"
  },
  "timestamp": "2026-08-30T10:11:24.434Z",
  "latencyMs": 274
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
    "idempotencyKey": "idemp_rzp_1788084684708"
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
      "timestamp": "2026-08-30T10:11:26.233Z",
      "rawResponseSummary": "Razorpay Test-Mode credentials not configured in environment (RAZORPAY_KEY_ID must start with rzp_test_).",
      "errorMessage": "RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET missing"
    },
    "serverTimestamp": "2026-08-30T10:11:26.233Z",
    "idempotencyStatus": "new_execution_recorded",
    "securityDisclaimer": "Executed in Test Mode. Zero real financial debit triggered."
  },
  "timestamp": "2026-08-30T10:11:24.708Z",
  "latencyMs": 485
}
```

---

### Test 4: Webhook Missing Signature Check (`POST /api/recovery/webhook`)

```json
{
  "endpoint": "/api/recovery/webhook",
  "method": "POST",
  "requestHeaders": {},
  "requestBody": {
    "entity": "event",
    "event": "payment_link.paid"
  },
  "httpStatus": 500,
  "responseBody": {
    "error": "Server Configuration Error: RAZORPAY_WEBHOOK_SECRET is not configured. Webhook verification failed closed."
  },
  "timestamp": "2026-08-30T10:11:25.193Z",
  "latencyMs": 268
}
```
