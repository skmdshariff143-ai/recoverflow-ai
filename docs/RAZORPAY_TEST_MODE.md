# PayBack AI — Razorpay Official Test-Mode Integration Guide

> **Submission Document**: Razorpay AI Buildathon · Track 3: AI Revenue Recovery

---

## 1. Overview

PayBack AI integrates with Razorpay via official Test-Mode APIs:
- **Payment Link Creation**: `POST https://api.razorpay.com/v1/payment_links`
- **Proactive Status Polling**: `GET https://api.razorpay.com/v1/payment_links/:id`
- **Execution Endpoint**: `POST /api/recovery/execute` (with `x-recovery-adapter: razorpay_test_mode`)
- **Status Query**: `GET /api/recovery/status/:reference`

### Configuration Requirements:
- `RAZORPAY_KEY_ID`: Must start with `rzp_test_`. Any `rzp_live_` key triggers an immediate fatal security exception.
- `RAZORPAY_KEY_SECRET`: Razorpay Test-Mode Secret.
- **Accounting Guarantee**: Payment link creation records ₹0.00 recovered revenue until actual `paid` or `captured` status is returned from the gateway.
