# RecoverFlow AI — Security Architecture & Threat Model

## 1. 16-Threat STRIDE Mitigation Matrix
1. **Broken Authentication**: HMAC-SHA256 session tokens with timing-safe comparison and expiration timestamps.
2. **Broken Authorization / IDOR**: Universal `assertTenantScoping` enforcing organization and merchant isolation.
3. **Webhook Spoofing**: Cryptographic HMAC signature verification with raw body buffering.
4. **Webhook Replay**: Unique `idempotencyKey` database constraints with 30-day retention.
5. **Prompt Injection**: Layered input sanitization and strict Zod runtime schema boundaries.
6. **PII Data Leakage**: Selective field masking and cryptographic hashing for customer identifiers.
7. **Accidental Live Charges**: Sandbox/Demo isolation mode active by default with explicit live gates.
8. **Audit Log Tampering**: Append-only SHA-256 Merkle hash chain ledger.
