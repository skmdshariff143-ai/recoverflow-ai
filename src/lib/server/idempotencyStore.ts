/**
 * RecoverFlow AI — Server-Side Idempotency Store (Prototype Scope).
 *
 * SCOPE & ARCHITECTURAL LIMITATION NOTICE:
 * This module provides "Best-effort single-instance prototype idempotency"
 * using an in-memory Map with TTL-bounded cleanup.
 *
 * CRITICAL VERCEL SERVERLESS BEHAVIOR:
 * In a multi-instance serverless deployment (such as Vercel / AWS Lambda):
 * 1. Multiple parallel container instances may execute concurrently.
 * 2. Instances may be spun up or recycled at any time.
 * 3. Module memory is not shared across distinct serverless instances.
 * 4. A client retry may be routed to a fresh container without prior cache state.
 *
 * PRODUCTION REQUIREMENT:
 * True distributed exactly-once recovery execution requires a durable atomic store:
 * - Redis / Upstash with atomic SETNX + TTL
 * - PostgreSQL unique constraint transaction table (e.g. INSERT ... ON CONFLICT DO NOTHING)
 */

import { createHash } from 'crypto';
import type { RecoveryExecutionResult } from '@/lib/adapters/recoveryAdapter';

export interface IdempotencyEntry {
  key: string;
  requestHash: string;
  receipt: RecoveryExecutionResult;
  createdAt: number;
  expiresAt: number;
}

// 1 hour TTL for in-memory prototype cache
const DEFAULT_TTL_MS = 60 * 60 * 1000;
// Max entries to prevent unbounded memory growth in a single container
const MAX_CACHE_ENTRIES = 1000;

class InMemoryIdempotencyStore {
  private cache = new Map<string, IdempotencyEntry>();

  /**
   * Compute deterministic SHA-256 hash of a request payload.
   */
  hashPayload(payload: unknown): string {
    return createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  /**
   * Check if an idempotency key already exists in local container memory.
   * Returns:
   * - { status: 'new' } if never seen
   * - { status: 'replay', receipt } if identical payload replayed
   * - { status: 'conflict' } if same key used with different payload
   */
  check(
    key: string,
    currentPayload: unknown,
  ): { status: 'new' } | { status: 'replay'; receipt: RecoveryExecutionResult } | { status: 'conflict' } {
    this.pruneExpired();

    const existing = this.cache.get(key);
    if (!existing) {
      return { status: 'new' };
    }

    const currentHash = this.hashPayload(currentPayload);
    if (existing.requestHash === currentHash) {
      return { status: 'replay', receipt: existing.receipt };
    }

    return { status: 'conflict' };
  }

  /**
   * Store a completed execution receipt with its idempotency key.
   */
  save(
    key: string,
    payload: unknown,
    receipt: RecoveryExecutionResult,
    ttlMs: number = DEFAULT_TTL_MS,
  ): void {
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    const now = Date.now();
    this.cache.set(key, {
      key,
      requestHash: this.hashPayload(payload),
      receipt,
      createdAt: now,
      expiresAt: now + ttlMs,
    });
  }

  /**
   * Prune expired entries.
   */
  private pruneExpired(): void {
    const now = Date.now();
    for (const [k, v] of this.cache.entries()) {
      if (v.expiresAt <= now) {
        this.cache.delete(k);
      }
    }
  }

  /**
   * Reset store (used in unit tests).
   */
  clear(): void {
    this.cache.clear();
  }
}

export const idempotencyStore = new InMemoryIdempotencyStore();
