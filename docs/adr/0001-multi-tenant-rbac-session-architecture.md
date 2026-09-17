# ADR 0001: Multi-Tenant RBAC and Session Architecture

## Status
Accepted

## Context
RecoverFlow AI operates as a multi-tenant commerce revenue recovery platform serving multiple organizations and individual merchant stores. The system requires secure session authentication, strict tenant isolation to prevent Insecure Direct Object References (IDOR), and granular role-based authorization across 7 operational personas.

## Decision
1. **Cryptographic HMAC-SHA256 Session Tokens**: Implement stateless, tamper-proof session tokens signed with server-side secrets.
2. **7-Role SaaS Hierarchy**:
   - `OWNER` (50): Full administrative and financial control.
   - `ADMIN` (40): Organization management and integration settings.
   - `RECOVERY_MANAGER` (30): Operational dispatch and high-value dual-custody approvals.
   - `SUPPORT_AGENT` (25): Customer communication intervention and order review.
   - `DEVELOPER` (20): API key management, webhook configuration, and event debugging.
   - `ANALYST` (15): Read-only analytics, model evaluation, and benchmark simulation.
   - `VIEWER` (10): Read-only dashboard inspection.
3. **Strict Tenant Scoping (`assertTenantScoping`)**: Enforce server-side checks verifying that every request's active `organizationId` and `merchantId` match the target entity before executing database operations.

## Consequences
- Eliminates IDOR and cross-tenant data leakage.
- Enables zero-dependency demo exploration via pre-authenticated demo persona sessions.
- Provides fine-grained audit logging attributing every action to specific user identities and roles.
