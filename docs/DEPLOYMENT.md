# RecoverFlow AI — Production Deployment Architecture

## 1. Infrastructure Topology
- **Frontend / Edge**: Next.js 16.3.2 deployed on Vercel Serverless / Edge Network.
- **Database**: PostgreSQL 16 (AWS RDS / Neon) with connection pooling.
- **Queue / Cache**: Redis 7.2 (Upstash / Redis Cloud) for BullMQ background workers.
- **Containerization**: `docker-compose.yml` defining full local/production stack (Postgres, Redis, Web App, Worker Daemon).
