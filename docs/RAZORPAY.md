# RecoverFlow AI — Razorpay Payment Integration Architecture

## 1. Supported Capabilities
- **Orders & Payments**: Payment failure ingestion, order linking, and status tracking.
- **Subscriptions**: Invoices, automated retry halt on failure, and subscription status synchronization.
- **Payment Links**: Dynamic UPI and Netbanking rescue link generation.
- **Webhook Ingestion**: Authoritative `payment.failed`, `payment.captured`, `subscription.halted` events.

## 2. Timing-Safe Webhook HMAC Verification
```typescript
const expectedSignature = crypto
  .createHmac('sha256', webhookSecret)
  .update(rawBody)
  .digest('hex');

const isValid = crypto.timingSafeEqual(
  Buffer.from(expectedSignature, 'utf-8'),
  Buffer.from(signatureHeader, 'utf-8')
);
```
