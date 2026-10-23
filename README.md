# RecoverFlow AI

A merchant operations console for reviewing revenue recovery cases, controlling communication policy, and inspecting attributable decisions. Built with Next.js 16, React 19, TypeScript, Prisma/PostgreSQL, and Redis.

**Release status:** working local demo and authenticated console foundation. Live payment recovery and provider onboarding are not enabled. See [release readiness](docs/RELEASE_READINESS.md) for exact boundaries and verification evidence. Older milestone documents describe historical targets and benchmark results, not deployment guarantees.

## Start the demo

Use Node.js 22 and npm. From the repository root:

```sh
npm ci
npm run db:generate
npm run dev
```

Open [localhost:3000](http://localhost:3000), choose **Explore the workspace**, then **Open demo workspace**. No provider keys, PostgreSQL, or Redis are required. `RECOVERFLOW_RUNTIME_MODE=DEMO` is the default. All demo operators share the in-process sample workspace; changes reset on a server restart. Run a single web process for this mode.

The console includes:

- Responsive navigation, keyboard command palette, accessible forms, and explicit loading/error/empty states.
- Signed, HttpOnly sessions, logout revocation, role enforcement, and tenant-scoped console APIs.
- Currency-separated recovery summaries, server-side case search and pagination, exact case deep links, and CSV exports.
- Two independent reviewer approvals, duplicate-review protection, recorded reasons, and hash-chain inspection. Approval never creates a payment success.
- Saved communication policy, masked customer references, cart browsing, message history, experiment observations, and infrastructure readiness.
- A read-only, deterministic copilot that answers from workspace records and identifies its sources.

The original synthetic evaluation dashboard is retained at **[/demo](http://localhost:3000/demo)**. Its frozen cohorts, scoring comparisons, promises, subscriptions, and scenario controls are separate from merchant-console observations.

## Demo and durable modes

| Mode | Storage | Sign-in | Provider activity |
| --- | --- | --- | --- |
| DEMO | In-process sample data | Named demo roles | External provider actions disabled; simulation only |
| TEST | In-process by default | Test/demo identities | Intended for automated tests with mocked dependencies |
| SANDBOX | PostgreSQL + Redis | Provisioned email/password/workspace | Legacy ingestion and execution routes held closed |
| LIVE | PostgreSQL + Redis | Provisioned email/password/workspace | Same activation gate; setting LIVE does not enable providers |

Runtime mode is a deployment setting, never a browser toggle. Demo sessions cannot authenticate into a durable installation. Invalid modes and missing durable database configuration fail closed.

## Configure a durable console

See [deployment instructions](docs/DEPLOYMENT.md) for local PostgreSQL/Redis, migrations, operator provisioning, Docker, secret handling, and readiness checks. The root [.env.example](.env.example) documents configuration. For `npm run dev`, copy the relevant settings to **apps/web/.env.local** or export them in the shell; Prisma and provisioning scripts require their variables in the shell or a root `.env` where supported.

```sh
npm run db:migrate:deploy
npm run operator:provision
npm run build
npm start
```

Provisioning requires `DATABASE_URL`, `OPERATOR_EMAIL`, `OPERATOR_PASSWORD` (12–256 characters), `WORKSPACE_SLUG`, and an HTTPS `MERCHANT_URL`. It creates an owner and merchant atomically, never overwrites an existing account, and never logs the password. Live sign-in additionally requires a strong `AUTH_SECRET`, Redis, and an exact `APP_URL`.

## Verify

```sh
npm run verify:core       # lint, types, unit tests, offline eval, artifact integrity, build
npm run test:console      # focused authentication, financial data, and review contracts
npm run test:e2e:console  # console journeys, accessibility, and mobile navigation
npm run test:e2e          # console + historical benchmark UI regression suite
```

Infrastructure suites require disposable PostgreSQL/Redis databases. **Never point test harnesses at real merchant data:** they clean their test schema.

```sh
npm run test:integration:postgres
npm run test:integration:redis
npm run test:durability
```

CI runs quality checks, PostgreSQL/Redis contracts, production build, and Chromium journeys. Screenshot tests write to `test-results/benchmark-screenshots`, preserving checked-in documentation images.

## Structure

```text
apps/web/src/app/(public)  Landing page, login, benchmark lab
apps/web/src/app/(app)     Authenticated merchant console
apps/web/src/app/api/console  Authorized tenant-scoped handlers
apps/web/src/lib/server    Session and origin checks, console serialization
packages/core             Domain logic, auth, database ports, Prisma schema
packages/agents           Advisory and communication agents
packages/jobs             Recovery jobs, outbox, channel adapters
packages/pixel            Storefront intent SDK
scripts                   Provisioning, evaluation, workers
```

Console handlers authorize on the server. Database adapters preserve integer minor amounts; API financial values are decimal strings. PostgreSQL reviews serialize access and commit the review, case state, and audit event together. The legacy evaluation routes remain isolated behind runtime gating until their provider contracts are ready for tenant-scoped activation.

[Deployment](docs/DEPLOYMENT.md) · [Release readiness](docs/RELEASE_READINESS.md) · [Security design](docs/SECURITY.md) · [Model methodology](MODEL.md) · [License](LICENSE)
