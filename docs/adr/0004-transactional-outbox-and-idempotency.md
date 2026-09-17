# ADR 0004: Transactional Outbox and Idempotent Ingestion Pipeline

## Status
Accepted

## Context
High-volume commerce platforms receive webhook events (Razorpay, Shopify, WhatsApp) that may be duplicated, delayed, or delivered out of order. Network failures between webhooks and workers can result in lost events or duplicate payment charges.

## Decision
1. **Transactional Outbox Pattern**: Ingestion routes write incoming events and outbox dispatch records within a single atomic database transaction.
2. **Timing-Safe Cryptographic Signature Verification**: Razorpay and Shopify webhooks are verified using timing-safe HMAC-SHA256 signature comparison.
3. **Durable Idempotency**: Each webhook event generates an `idempotencyKey` stored in PostgreSQL/Redis. Duplicate keys within the retention window are acknowledged and skipped.
4. **At-Least-Once Delivery with Idempotent Workers**: BullMQ worker queues process background jobs with exponential backoff and dead-letter handling.

## Consequences
- Guarantees zero duplicate recovery dispatches on webhook replay.
- Enables safe asynchronous background processing without blocking synchronous webhook endpoints.
