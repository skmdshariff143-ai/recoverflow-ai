# Deploying the authenticated console

This guide covers the merchant console. Provider recovery execution remains gated in SANDBOX and LIVE; a healthy console is not evidence that payment or messaging delivery works.

## Local demo

Node.js 22 is recommended. Run `npm ci`, `npm run db:generate`, and `npm run dev`. Open http://localhost:3000. No `.env` file is required. Keep the demo on one Node process because sample records and sessions are in memory.

## Local durable sandbox

1. Run `docker compose up -d postgres redis`. Ports bind to loopback. The Compose password is for local development only.
2. Export `RECOVERFLOW_RUNTIME_MODE=SANDBOX`, `DATABASE_URL`, `REDIS_URL`, `AUTH_SECRET`, and `APP_URL` from `.env.example` into the terminal running the app. Use a cryptographically random secret of at least 32 characters. `APP_URL` must match the browser origin exactly, including scheme and port.
3. Run `npm run db:generate` and `npm run db:migrate:deploy`. Migrations include the nullable password hash; existing accounts remain unable to use password sign-in until explicitly provisioned through an appropriate account-management process.
4. Export `OPERATOR_EMAIL`, `OPERATOR_PASSWORD`, `WORKSPACE_SLUG`, `MERCHANT_URL` and optional display names. Run `npm run operator:provision`. Unset `OPERATOR_PASSWORD` immediately afterward. Do not paste passwords into command arguments, source files, or build logs.
5. Run `npm run build` and `npm start`, then sign in at `/login`. No default live account or password exists. Provision a second operator with a distinct email to test independent approval.
6. Verify `/api/ready` reports database, authentication, and Redis as READY. Disconnect a dependency and verify it returns HTTP 503.

Next.js resolves `.env.local` from `apps/web`; CLI scripts do not automatically inherit that file. Prefer deployment environment variables. On Node.js 22, a deliberately prepared root environment file can be passed to TSX using `node --env-file=.env --import tsx scripts/provision-operator.ts`.

## Docker

## Vercel hosted demo

The Vercel project is `recoverflow-ai` under `shaik-mahammad-shariff-s-projects`. Its root is the repository root; `vercel.json` runs `npm ci`, generates Prisma, builds the web workspace, and publishes `apps/web/.next` in DEMO mode.

Vercel functions do not share process memory. The hosted console therefore uses a separate Supabase Free Plan resource named `recoverflow-demo`, connected only to the production deployment environment with the `RECOVERFLOW_DEMO_` prefix. The console derives its connection from `RECOVERFLOW_DEMO_POSTGRES_PRISMA_URL` and always pins the schema to `recoverflow_demo`. It never falls back to the live `DATABASE_URL`. The historical benchmark lab retains its isolated in-memory simulation.

To initialize a new hosted demo resource from the repository root:

```sh
vercel env pull .vercel/production.env --environment production
node --env-file=.vercel/production.env --import tsx scripts/setup-hosted-demo.ts
```

The setup script uses the dedicated non-pooling demo connection, deploys migrations, and inserts synthetic operators, carts, messages and recovery cases without overwriting existing demo changes. No workers or real provider credentials are seeded. All demo visitors share this sample workspace; never enter real customer information into it.

Set a generated `AUTH_SECRET` in Vercel's production environment. For a release, create a staged production deployment with `vercel deploy --prod --skip-domain`, verify it with `vercel curl` and browser tests, then use `vercel promote <deployment-url>`. Keep deployment protection enabled. For authenticated Playwright checks, an ignored storage-state file can be supplied through `PLAYWRIGHT_STORAGE_STATE`.

The hosted demo release overrides payment and model keys with empty values. It does not activate live recovery. Switching to SANDBOX or LIVE requires the separate infrastructure and provider work described below.

## Docker

`docker build -t recoverflow-console .` builds a non-root web image. Secrets and local evidence are excluded by `.dockerignore`. The default image runs in DEMO mode.

For the durable local console, export a strong `AUTH_SECRET` and run `docker compose --profile console up --build`. The web command deploys migrations before starting. Provision the operator against the same PostgreSQL instance as described above. The optional console profile deliberately does not start recovery workers.

Docker builds and live service integration must be verified in an environment with Docker installed. The runtime image retains the workspace and dependencies for migration/provisioning tools; it is not a minimized standalone image.

## Hosted deployment

- Use separate deployments, databases, Redis namespaces, and credentials for demo, sandbox, and live.
- Terminate HTTPS at a trusted ingress, pin `APP_URL`, preserve the external Host header, and supply `AUTH_SECRET` through secret storage. HTTPS sessions receive the Secure cookie flag.
- Apply migrations as a release job before starting new instances. Back up the database and exercise restore before accepting merchant records.
- Require readiness success before routing traffic. Monitor API errors, Redis availability, audit integrity, and database latency. `/api/health` reports process liveness; `/api/ready` performs infrastructure checks.
- Configure Redis for durable sign-in rate limiting. Login fails closed when Redis is unavailable. Rotate `AUTH_SECRET` to invalidate all signed tokens; account sessions can also be revoked through the database port.
- All console APIs derive the merchant from the authenticated session. They do not accept a client-selected tenant. Organization membership is checked on every durable request.

## Provider activation remains a release prerequisite

The inherited Shopify, Razorpay, messaging, and worker paths require a dedicated activation pass: tenant-scoped credential lookup and signature verification, provider-specific sandbox tests, replay/idempotency validation, consent and suppression enforcement, retry/dead-letter procedures, and verified outcome reconciliation. The proxy returns 503 for legacy integration routes in durable modes. Do not remove this gate merely to make readiness green.

The demo outbound channel adapters force simulation even if provider keys are present. Demo routes that directly operate providers are denied. Do not place production credentials in a demo deployment.

Other remaining product work includes self-service invites/SSO and credential recovery, durable subscriptions and promises in the new console, full ledger/export pagination, retention controls, operational alerting, and independent security/load review. See RELEASE_READINESS.md for current verification evidence.
