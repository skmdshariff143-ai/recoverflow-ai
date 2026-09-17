# RecoverFlow AI — Authoritative Razorpay Integration Architecture

> **Protocol**: HMAC SHA-256 Webhook Gateway + Proactive Reconciliation Polling  
> **Security**: Timing-Safe Buffer Comparison · Integer-Paise Minor Units · Sandbox Isolation  

---

## 1. Webhook Lifecycle Pipeline

```mermaid
sequenceDiagram
    autonumber
    participant Razorpay as Razorpay Gateway
    participant WebhookGateway as /api/webhooks/razorpay
    participant Idempotency as Idempotency Store
    participant CoreEngine as Deterministic Engine
    participant AuditLedger as SHA-256 Audit Trail

    Razorpay->>WebhookGateway: POST payment.failed (x-razorpay-signature)
    WebhookGateway->>WebhookGateway: Verify HMAC SHA-256 Signature
    alt Invalid Signature
        WebhookGateway-->>Razorpay: 400 Bad Request
    end
    WebhookGateway->>Idempotency: Check & Reserve Key
    alt Duplicate Event
        WebhookGateway-->>Razorpay: 200 OK (Cached Execution Receipt)
    end
    WebhookGateway->>CoreEngine: Ingest Normalized FailedPayment (Integer Paise)
    CoreEngine->>AuditLedger: Append Tamper-Evident SHA-256 Block
    WebhookGateway-->>Razorpay: 200 OK (Event Registered in Recovery Queue)
```

---

## 2. Sandbox Mode vs Live Mode Visual Protection

- **Visual Badge**: Clear top-bar indicator displaying **SANDBOX** or **LIVE** mode.
- **Test Key Assertion**: In sandbox mode, adapters reject `rzp_live_*` keys with a fatal security exception.
