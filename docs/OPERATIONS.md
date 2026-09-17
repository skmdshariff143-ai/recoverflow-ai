# RecoverFlow AI — SRE Operations Runbook & Incident Response

## 1. Subsystem Health Checks
- **Health Endpoint**: `GET /api/health` &rarr; System uptime, memory, queue depth, and invariant validation.
- **Readiness Endpoint**: `GET /api/ready` &rarr; Database connectivity, Redis availability, and AI provider status.

## 2. DEFCON-1 Load Shedding Protocol
When system memory exceeds 80% or database latency spikes above 500ms:
1. Low-LTV abandoned carts (< ₹1,000) are automatically shedded.
2. AI advisory generation degrades to deterministic rule heuristics.
3. Outbox batch dispatch size scales down from 100 to 20 events.
