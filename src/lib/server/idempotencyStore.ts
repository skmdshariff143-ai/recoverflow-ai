/**
 * RecoverFlow AI — Server-Side Idempotency Store.
 *
 * Provides in-memory, TTL-bounded idempotency management for recovery executions
 * and webhook event processing.
 *
 * NOTE FOR PRODUCTION:
 * This is an in-memory implementation suitable for demo, testing, and single-instance
 * deployments. Production environments require a distributed, durable store such as
 * Redis (Upstash) or a PostgreSQL unique constraint table.
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
// Max entries to prevent unbounded memory growth
const MAX_CACHE_ENTRIES = 1000;

class InMemoryIdempotencyStore {
  private cache = new Map<string, IdempotencyEntry>();
  private processedWebhookEvents = new Set<string>();

  /**
   * Compute deterministic SHA-256 hash of a request payload.
   */
  hashPayload(payload: unknown): string {
    return createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  /**
   * Check if an idempotency key already exists.
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
      // Remove oldest entry
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
   * Webhook deduplication check.
   * Returns true if event is NEW; returns false if duplicate.
   */
  recordWebhookEvent(eventId: string): boolean {
    if (this.processedWebhookEvents.has(eventId)) {
      return false; // Duplicate
    }
    if (this.processedWebhookEvents.size >= MAX_CACHE_ENTRIES) {
      const oldest = this.processedWebhookEvents.values().next().value;
      if (oldest) this.processedWebhookEvents.delete(oldest);
    }
    this.processedWebhookEvents.add(eventId);
    return true;
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
   * Reset store (used in tests).
   */
  clear(): void {
    this.cache.clear();
    this.processedWebhookEvents.clear();
  }
}

export const idempotencyStore = new InMemoryIdempotencyStore();
