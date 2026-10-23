# Distributed Rate Limiter: Upstash / Vercel KV Setup Guide

## Overview

RecoverFlow AI (PayBack AI) implements a pluggable `RateLimitStore` interface defined in [`apps/web/src/lib/apiGuards.ts`](../apps/web/src/lib/apiGuards.ts).

By default, RecoverFlow ships with an in-memory `MemoryRateLimitStore` that requires **zero paid services** and executes locally across Node.js runtimes. For multi-region serverless deployments on Vercel or Cloudflare where state must be shared across edge instances, follow this guide to plug in Upstash Redis or Vercel KV.

---

## Architecture: The `RateLimitStore` Interface

```typescript
export interface RateLimitRecord {
  count: number;
  resetAt: number; // UNIX timestamp in milliseconds
}

export interface RateLimitStore {
  get(key: string): Promise<RateLimitRecord | undefined> | RateLimitRecord | undefined;
  set(key: string, record: RateLimitRecord): Promise<void> | void;
  delete(key: string): Promise<void> | void;
  clear?(): Promise<void> | void;
}
```

---

## Option 1: Integrating Upstash Redis

Upstash provides serverless Redis via REST API, perfect for Next.js API routes without TCP socket connection overhead.

### Step 1: Install Upstash Redis SDK

```bash
npm install @upstash/redis
```

### Step 2: Configure Environment Variables

Add to `.env` or Vercel Environment Variables:

```env
UPSTASH_REDIS_REST_URL="https://<your-db>.upstash.io"
UPSTASH_REDIS_REST_TOKEN="<your-upstash-rest-token>"
```

### Step 3: Implement `UpstashRateLimitStore`

Create `apps/web/src/lib/stores/UpstashRateLimitStore.ts`:

```typescript
import { Redis } from '@upstash/redis';
import type { RateLimitStore, RateLimitRecord } from '../apiGuards';

export class UpstashRateLimitStore implements RateLimitStore {
  private redis: Redis;
  private prefix: string;

  constructor(prefix = 'rf:ratelimit:') {
    this.redis = Redis.fromEnv();
    this.prefix = prefix;
  }

  async get(key: string): Promise<RateLimitRecord | undefined> {
    const raw = await this.redis.get<string>(`${this.prefix}${key}`);
    if (!raw) return undefined;
    return typeof raw === 'string' ? JSON.parse(raw) : (raw as RateLimitRecord);
  }

  async set(key: string, record: RateLimitRecord): Promise<void> {
    const ttlSeconds = Math.max(1, Math.ceil((record.resetAt - Date.now()) / 1000));
    await this.redis.set(
      `${this.prefix}${key}`,
      JSON.stringify(record),
      { ex: ttlSeconds }
    );
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(`${this.prefix}${key}`);
  }
}
```

### Step 4: Register Store in Next.js Server Initialization

In `apps/web/src/instrumentation.ts` (or app bootstrap):

```typescript
import { setRateLimitStore } from '@/lib/apiGuards';
import { UpstashRateLimitStore } from '@/lib/stores/UpstashRateLimitStore';

export function register() {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    setRateLimitStore(new UpstashRateLimitStore());
    console.info('[RateLimiter] Registered distributed Upstash Redis store.');
  }
}
```

---

## Option 2: Integrating Vercel KV

Vercel KV is built on Upstash and integrates natively with Vercel deployments.

### Step 1: Add KV Storage in Vercel Dashboard

1. Navigate to your project on [vercel.com](https://vercel.com).
2. Go to the **Storage** tab and click **Create Database** &rarr; **KV**.
3. Link the KV database to your project environment.

### Step 2: Install Vercel KV SDK

```bash
npm install @vercel/kv
```

### Step 3: Implement `VercelKvRateLimitStore`

Create `apps/web/src/lib/stores/VercelKvRateLimitStore.ts`:

```typescript
import { kv } from '@vercel/kv';
import type { RateLimitStore, RateLimitRecord } from '../apiGuards';

export class VercelKvRateLimitStore implements RateLimitStore {
  private prefix: string;

  constructor(prefix = 'rf:rl:') {
    this.prefix = prefix;
  }

  async get(key: string): Promise<RateLimitRecord | undefined> {
    const data = await kv.get<RateLimitRecord>(`${this.prefix}${key}`);
    return data ?? undefined;
  }

  async set(key: string, record: RateLimitRecord): Promise<void> {
    const ttlMs = Math.max(1000, record.resetAt - Date.now());
    await kv.set(`${this.prefix}${key}`, record, { px: ttlMs });
  }

  async delete(key: string): Promise<void> {
    await kv.del(`${this.prefix}${key}`);
  }
}
```

---

## Protected Endpoints & Default Limits

| Endpoint | Method | Default Limit | Purpose |
| :--- | :--- | :--- | :--- |
| `/api/live-trigger` | POST | 15 req / min | Audience live simulated payment injection |
| `/api/ai/diagnose` | POST | 20 req / min | Gemini gateway diagnostic parsing |
| `/api/ai/draft-message` | POST | 20 req / min | AI customer outreach drafting |
| `/api/razorpay/subscriptions` | POST | 10 req / min | Subscription plan/mandate generation |
| `/api/razorpay/subscriptions/halt` | POST | 15 req / min | Subscription suspension & event webhook |
| `/api/merchant/voice-clone` | POST | 5 req / min | Custom audio voice cloning & synthesis |

All limits return standard RFC 6585 headers:
- `Retry-After: <seconds>`
- `X-RateLimit-Limit: <number>`
- `X-RateLimit-Remaining: 0`
- `X-RateLimit-Reset: <epoch-seconds>`
