# RecoverFlow AI — Event-Driven Architecture & Transactional Outbox

## 1. Outbox Pipeline Design
```
External Webhook 
  │
  ▼
[POST /api/webhooks/*]
  │ (Timing-Safe HMAC Verification)
  ▼
BEGIN TRANSACTION
  INSERT INTO WebhookEvent (idempotencyKey, payload, status = 'RECEIVED')
  INSERT INTO DomainEntity (...)
  INSERT INTO OutboxEvent (aggregateId, eventType, payload, status = 'PENDING')
COMMIT TRANSACTION
  │
  ▼ (Outbox Poller / Redis Trigger)
BullMQ Worker Pool
  │ (Idempotent Execution)
  ▼
External Rails / Notifications
```

## 2. Guarantees & Invariants
- **At-Least-Once Delivery**: Outbox records are marked `PROCESSED` only after successful downstream acknowledgment.
- **Durable Deduplication**: Duplicate provider webhook delivery within 30 days is detected via unique `idempotencyKey` index.
- **Dead-Letter Handling**: Jobs exceeding 5 retry attempts are routed to the Dead Letter Queue for operator triage.
