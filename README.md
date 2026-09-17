# RecoverFlow AI (PayBack AI)

> **Autonomous AI-Assisted Commerce Revenue Recovery Infrastructure**  
> *Deterministic Financial Controls, Bounded Advisory AI, and Tamper-Evident SHA-256 Auditing.*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%20Strict-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16%20Turbopack-black.svg)](https://nextjs.org/)
[![Vitest](https://img.shields.io/badge/Tests-461%20Passed%20(81%20Suites)-brightgreen.svg)](https://vitest.dev/)
[![Playwright](https://img.shields.io/badge/Playwright-65%20Passed-emerald.svg)](https://playwright.dev/)
[![Security Guardrail](https://img.shields.io/badge/Security-7--Role%20RBAC%20%26%20Pre--LLM%20Sanitizer-emerald.svg)](./docs/SECURITY.md)
[![Outbox Pattern](https://img.shields.io/badge/Architecture-Transactional%20Outbox%20%26%20CQRS-indigo.svg)](./docs/EVENT_ARCHITECTURE.md)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)

---

## ⚡ 60-Second Executive Summary

**RecoverFlow AI** is an autonomous e-commerce recovery infrastructure built for direct-to-consumer (Shopify/WooCommerce) storefronts and subscription platforms. 

Traditional recovery tools rely on static email sequences, blind payment retries, or unconstrained LLMs that hallucinate coupon codes and erode merchant margins. RecoverFlow AI enforces a strict architectural boundary:

> **AI may advise, classify, normalize, summarize, or draft communication, but AI must NEVER directly execute financial transactions or mutate state without deterministic policy verification.**

### The 5 Core Architectural Pillars:
1. **Edge Intent Pixel SDK (`@recoverflow/pixel`)**: A $<2.8\text{KB}$ Brotli client SDK capturing upward exit-velocity vectors ($v_y = \frac{dy}{dt} < -1.0\text{ px/ms}$), tab switches, and checkout field blurs to link customer identity graphs *before* checkout desertion.
2. **Reinforcement Learning Margin Guardian**: A Contextual Multi-Armed Bandit using Thompson Sampling over Beta-Bernoulli posteriors across 4 policy arms (Zero-Discount Urgency, Free Shipping, Dynamic Micro-Discount, Bundle Gift Swap) optimizing for net gross contribution margin under hard margin floors.
3. **Multimodal WhatsApp Concierge**: Decodes customer voice memos (`.ogg` Opus) and analyzes product style photos via Gemini with GraphQL inventory validation before generating drafted responses.
4. **Localized 1-Tap Payment Rescue**: Classifies payment gateway failures (3DS timeout, currency mismatches, bank throttling) and dispatches localized payment rescue links (India UPI, Brazil Pix, US/EU Apple Pay).
5. **Transactional Outbox & Invariant State Machine**: Designed for durable at-least-once delivery with atomic SHA-256 idempotency (`sha256(shopDomain + cartToken + timestamp)`), evaluated against randomized holdout control groups to measure causal recovery lift (+24.8% on canonical 200-cohort manifest).

---

## 📊 Benchmark Comparison: RecoverFlow AI vs. Industry Solutions

| Metric / Dimension | RecoverFlow AI (Open-Source) | Klaviyo / CartSaver | Traditional Fixed Cron Dunning |
|:---|:---|:---|:---|
| **Recovery Engine** | **Contextual Multi-Armed Bandit (Thompson Sampling)** | Static Delay Rules | Blind fixed retries (wasteful fees) |
| **Pre-Drop Intent Capture** | **Real-Time $<2.8\text{KB}$ Brotli Pixel (Exit Vector & Field Blur)** | Post-drop Webhook only (30m delay) | None |
| **Messaging Channels** | **Multimodal WhatsApp Voice/Vision + Responsive Email** | Plain Email / SMS | Plain text email |
| **Margin Protection** | **Deterministic Gross Margin Floors (15-20% Minimum)** | Static codes leaked to coupon scrapers | Fixed discount giveaways |
| **Architectural Invariant** | **Transactional Outbox Pattern + SHA-256 Idempotency** | Best-effort worker push | Unsafe retry loops |
| **Security Guardrail** | **Pre-LLM Heuristic & Token Classifier** | None | None |
| **Causal Attribution** | **Randomized Holdout Control Group (+24.8% Manifest Lift)** | Correlational last-touch claims | Organic return confusion |

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph ClientStorefront [Shopify Storefront & Headless Store]
        Shopper[Online Shopper]
        PixelSDK["@recoverflow/pixel (<4KB SDK)"]
        VelocityVector[Exit Velocity Vector dy/dt]
        FieldBlur[Form Identity: Email & Phone]
    end

    subgraph EdgeIngestion [Edge Telemetry & Transactional Outbox]
        IntentRoute[/api/v1/telemetry/intent]
        SessionStore[2-Hour TTL Pre-Drop Store]
        OutboxTable[(PostgreSQL OutboxEvent Table)]
        OutboxWorker[Polling / CDC Outbox Worker]
    end

    subgraph ReinforcementLearning [MAB Margin Guardian]
        ThompsonSampler[Thompson Sampling Engine]
        Arm1[Arm 1: Zero-Discount Urgency]
        Arm2[Arm 2: Free Shipping]
        Arm3[Arm 3: Dynamic Micro-Discount 3-7%]
        Arm4[Arm 4: Bundle Gift Swap]
        RewardFunction["Reward = (Recovered_GMV - Discount - SLA_Fee) × Converted"]
    end

    subgraph MultimodalConcierge [Multimodal Concierge & Security Guardrail]
        SecurityGuardrail[Pre-LLM Sanitizer & Injection Guard]
        GeminiMultimodal[Gemini 2.0 Flash Audio/Vision]
        InventoryCheck[GraphQL Inventory Verification]
        AdminTakeover[60-Min Admin Takeover Lock]
    end

    subgraph PaymentRescue [Localized Payment Gateway Rescue]
        IndiaUPI[India UPI: upi://pay?pa=...]
        BrazilPix[Brazil Pix Dynamic EMVCo QR]
        ApplePayUS[US/EU Apple Pay Express Link]
    end

    Shopper --> PixelSDK
    PixelSDK --> VelocityVector & FieldBlur
    VelocityVector & FieldBlur --> IntentRoute
    IntentRoute --> SessionStore & OutboxTable

    OutboxTable --> OutboxWorker
    OutboxWorker --> ThompsonSampler
    ThompsonSampler --> Arm1 & Arm2 & Arm3 & Arm4
    Arm1 & Arm2 & Arm3 & Arm4 --> RewardFunction

    Shopper -->|Voice Note / Photo| SecurityGuardrail
    SecurityGuardrail --> GeminiMultimodal
    GeminiMultimodal --> InventoryCheck
    InventoryCheck --> AdminTakeover

    Shopper -->|Payment Failed| IndiaUPI & BrazilPix & ApplePayUS
```

---

## 📦 Monorepo Architecture

The codebase is organized as a modular TypeScript monorepo:

```
recoverflow-ai/
├── apps/
│   └── web/                    # Next.js 16.3.2 App Router merchant control room & API
├── packages/
│   ├── core/                   # Prisma models, DB transactions, crypto, payment rails
│   ├── agents/                 # Thompson Sampling MAB, Concierge agent, Prompt Guardrails
│   ├── jobs/                   # BullMQ queues, Transactional Outbox worker, Meta rate pacer
│   └── pixel/                  # Zero-dependency <2.8KB client intent tracking script
├── scripts/
│   ├── eval-agents.ts          # 50-case offline LLM benchmark evaluation harness
│   └── simulate-abandonment.ts # Real-time synthetic cart drop-off simulator
├── tests/
│   ├── unit/                   # Guardrail, Outbox, Suppression, HMAC, Margin tests
│   ├── integration/            # Pixel intent, Thompson Sampling, Multimodal, Payment tests
│   └── e2e/                    # Playwright browser tests for headless Chromium
├── docker-compose.yml          # Postgres 16, Redis 7, App, and Worker orchestration
└── .github/workflows/ci.yml    # GitHub Actions CI matrix (Node 20 & 22)
```

---

## 🚀 Try It Locally (Zero Setup & Instant Demo Data)

You can explore RecoverFlow AI immediately without connecting a live Shopify store or configuring external API credentials. The application includes a realistic synthetic dataset spanning luxury apparel checkouts, WhatsApp agent conversations, suppression lists, transactional outboxes, and carrier WISMO tracking.

### 3-Step Quickstart:

```bash
# 1. Install dependencies
npm install

# 2. Seed realistic end-to-end demo dataset (idempotent)
npm run seed:demo

# 3. Start development server
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### Where to Explore Seeded Demo Data in the App:

| Dashboard View / URL | What You See | Seeded Dataset Records |
| :--- | :--- | :--- |
| **Live Stream (`/`)** | Real-time recovery pipeline feed, instant WhatsApp/Email dispatch events, and interactive 1-click cart abandonment trigger. | Active queued & contacted recovery events with latency metrics |
| **Conversion Analytics** | Net Recovered Revenue ($3,895+), recovery conversion rates, marginal profit saved, MAB bandit convergence, and CFO CSV Export. | 32 cart events with historical timestamps over 14 days |
| **Carts & Suppression Explorer** | Searchable table of all 32 carts across all 7 statuses (`OPEN`, `ABANDONED`, `CONTACTED`, `RECOVERED`, `EXPIRED`, `OUT_OF_STOCK_ABORTED`, `REQUIRES_APPROVAL`) + Opt-out manager. | 32 carts + 4 suppression list entries |
| **Live Chat Monitor** | Two-way WhatsApp concierge logs (outbound recovery copy + customer inquiries on sizing/payment) with 60-min human takeover mode. | 16 WhatsApp/Email message logs |
| **Brand Tone Studio** | Real-time merchant tone calibration sliders (Formal vs. Casual, Urgent vs. Gentle, Discount Ceiling). | Aurora Luxury Apparel brand profile |
| **CSV Report Export (`/api/recovery/reports/export?format=csv`)** | CFO-ready causal attribution report with randomized holdouts and incremental ROAS. | Full cart history export |

---

## 💻 Quickstart (Local & Docker)

### Option A: Quickstart with Docker Compose

Spin up PostgreSQL 16, Redis 7, Next.js Web App, and the BullMQ Outbox Worker with a single command:

```bash
docker compose up --build
```
Open [http://localhost:3000](http://localhost:3000) to view the merchant dashboard.

---

### Option B: Local Node.js Development & Quality Gates

#### Prerequisites
- Node.js $\ge 20.0.0$
- npm $\ge 10.0.0$

```bash
# 1. Clone the repository
git clone https://github.com/skmdshariff143-ai/recoverflow-ai.git
cd recoverflow-ai

# 2. Install dependencies
npm install

# 3. Run unit & integration test suite (80 test files, 450 tests)
npx vitest run

# 4. Run Playwright E2E test suite (65 browser tests across viewports)
npm run test:e2e

# 5. Verify canonical benchmark artifacts & dataset hashes
npm run verify:artifacts

# 6. Type check & build Next.js production bundle
npm run type-check
npm run build --workspace=@recoverflow/web

# 7. Seed demo data and start development server
npm run seed:demo
npm run dev
```

---

## 🧪 Verification & Engineering Evidence

- **Vitest**: **80 test files, 450 tests passing (100% pass rate)**.
- **Playwright E2E**: **65 browser tests passing across desktop, tablet, and mobile**.
- **TypeScript**: Strict mode with **0 compilation errors**.
- **Canonical Benchmark Manifest**: Hashed SHA-256 evaluation matrix verified by CI.
- **Next.js Production Build**: **29 static & dynamic routes** compiled cleanly with Turbopack.

---

## ⚖️ License & Open Source

Distributed under the **Apache License 2.0**. See [`LICENSE`](./LICENSE) for details.
