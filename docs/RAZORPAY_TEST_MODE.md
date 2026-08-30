# RecoverFlow AI — Razorpay Official Test-Mode Integration Guide

> **Submission Document**: Razorpay AI Buildathon · Track 3: AI Revenue Recovery

---

## 1. Overview

RecoverFlow AI integrates with Razorpay via official Test-Mode APIs:
- **API Endpoint**: `POST https://api.razorpay.com/v1/payment_links`
- **Status Endpoint**: `GET https://api.razorpay.com/v1/payment_links/:id`
- **Webhook Endpoint**: `POST /api/recovery/webhook`

### Configuration Requirements:
- `RAZORPAY_KEY_ID`: Must start with `rzp_test_`. Any `rzp_live_` key triggers a security exception.
- `RAZORPAY_KEY_SECRET`: Test-mode secret.
- `RAZORPAY_WEBHOOK_SECRET`: Used for constant-time HMAC-SHA256 signature verification.
