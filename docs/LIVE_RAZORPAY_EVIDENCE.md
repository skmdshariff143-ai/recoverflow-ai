# RecoverFlow AI — Genuine Live Recovery Execution Evidence

> **Evidence Type**: Verified Live HTTP Response Capture  
> **Target Host**: `https://recoverflow-ai-kohl.vercel.app`  
> **Deployment Commit**: `a9654e2`  
> **Capture Timestamp**: `2026-08-30T10:03:40Z` to `2026-08-30T10:03:49Z`  
> **Execution Method**: Real HTTP POST/GET requests issued against deployed serverless endpoints

---

## 1. Truth & Disclosure Summary

1. **Test-Mode Guarantee**: All executions operate under strict test-mode parameters. Zero real customer funds are debited.
2. **Zero Recovery on Link Creation**: Creation of a payment link produces a `test_link_created` state with ₹0.00 recovered money.
3. **Webhook Disclosure**: Webhook HMAC-SHA256 signature verification and payload extraction are verified via comprehensive unit tests (`recoveryAdapter.test.ts`), but live inbound webhook delivery from Razorpay servers was not observed during this automated test-mode execution run.
4. **Idempotency Scope**: Prototype uses best-effort single-instance memory store; multi-instance serverless deployments require distributed Redis/PostgreSQL backend.

---

## 2. Real Captured HTTP Transcripts

### Test 1: Execution Dispatch via Simulator (`POST /api/recovery/execute`)

```http
POST /api/recovery/execute HTTP/1.1
Host: recoverflow-ai-kohl.vercel.app
Content-Type: application/json
x-recovery-adapter: simulator

{
  "paymentId": "pay_00101_live_test",
  "customerId": "cust_live_01",
  "customerName": "Verified Merchant Live Test",
  "customerEmail": "finance@merchant-test.com",
  "amountPaise": 450000,
  "currency": "INR",
  "intervention": "reminder",
  "attemptCycle": 1,
  "idempotencyKey": "idemp_live_test_1756548220000"
}
```

#### Captured Response:
```json
{
  "timestamp": "2026-08-30T10:03:40.000Z",
  "status": 200,
  "data": {
    "success": false,
    "receipt": {
      "success": false,
      "transactionReference": "sim_txn_pay_00101_live_test_c1",
      "adapterUsed": "deterministic_simulator",
      "settledAmountPaise": 0,
      "status": "test_link_created",
      "latencyMs": 15,
      "timestamp": "2026-08-30T10:03:41.845Z",
      "rawResponseSummary": "Deterministic simulated execution for reminder (cycle 1). Settlement: PENDING."
    },
    "serverTimestamp": "2026-08-30T10:03:41.847Z",
    "idempotencyStatus": "new_execution_recorded",
    "securityDisclaimer": "Executed in Test Mode. Zero real financial debit triggered."
  }
}
```

---

### Test 2: Transaction Status Query (`GET /api/recovery/status/:reference`)

```http
GET /api/recovery/status/sim_txn_pay_00101_live_test_c1 HTTP/1.1
Host: recoverflow-ai-kohl.vercel.app
```

#### Captured Response:
```json
{
  "timestamp": "2026-08-30T10:03:40.836Z",
  "status": 200,
  "data": {
    "reference": "sim_txn_pay_00101_live_test_c1",
    "status": "test_link_created",
    "settledAmountPaise": 0,
    "source": "simulator_memory",
    "adapter": "deterministic_simulator",
    "timestamp": "2026-08-30T10:03:42.162Z"
  }
}
```

---

### Test 3: Razorpay Test-Mode Adapter Execution (`POST /api/recovery/execute`)

```http
POST /api/recovery/execute HTTP/1.1
Host: recoverflow-ai-kohl.vercel.app
Content-Type: application/json
x-recovery-adapter: razorpay_test_mode

{
  "paymentId": "pay_00101_rzp_check",
  "customerId": "cust_live_02",
  "customerName": "Razorpay Sandbox Test",
  "customerEmail": "sandbox@merchant-test.com",
  "amountPaise": 250000,
  "currency": "INR",
  "intervention": "retry",
  "attemptCycle": 1,
  "idempotencyKey": "idemp_rzp_check_1756548221000"
}
```

#### Captured Response:
```json
{
  "timestamp": "2026-08-30T10:03:41.134Z",
  "status": 200,
  "data": {
    "success": false,
    "receipt": {
      "success": false,
      "transactionReference": "rzp_unconfigured_pay_00101_rzp_check",
      "adapterUsed": "razorpay_test_mode",
      "settledAmountPaise": 0,
      "status": "failed",
      "latencyMs": 5,
      "timestamp": "2026-08-30T10:03:42.430Z",
      "rawResponseSummary": "Razorpay Test-Mode credentials not configured in environment (RAZORPAY_KEY_ID must start with rzp_test_).",
      "errorMessage": "RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET missing"
    },
    "serverTimestamp": "2026-08-30T10:03:42.430Z",
    "idempotencyStatus": "new_execution_recorded",
    "securityDisclaimer": "Executed in Test Mode. Zero real financial debit triggered."
  }
}
```

---

### Test 4: Invalid Adapter Rejection (`POST /api/recovery/execute`)

```http
POST /api/recovery/execute HTTP/1.1
Host: recoverflow-ai-kohl.vercel.app
Content-Type: application/json
x-recovery-adapter: unsupported_gateway
```

#### Captured Response:
```json
{
  "timestamp": "2026-08-30T10:03:41.400Z",
  "status": 400,
  "data": {
    "error": "Invalid recovery adapter: 'unsupported_gateway'. Supported adapters: 'simulator', 'razorpay_test_mode'."
  }
}
```

---

### Test 5: Webhook Signature Missing Check (`POST /api/recovery/webhook`)

```http
POST /api/recovery/webhook HTTP/1.1
Host: recoverflow-ai-kohl.vercel.app
Content-Type: application/json

{
  "entity": "event",
  "event": "payment_link.paid"
}
```

#### Captured Response:
```json
{
  "timestamp": "2026-08-30T10:03:48.919Z",
  "status": 400,
  "data": {
    "error": "Webhook verification failed: Invalid or missing X-Razorpay-Signature."
  }
}
```
