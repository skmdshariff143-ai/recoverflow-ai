/**
 * PayBack AI — Durable Idempotency Abstraction & Atomic Storage Interface.
 *
 * Implements atomic execution intent reservation to guarantee exactly-once processing
 * in distributed and multi-threaded execution environments.
 */

import { createHash } from 'crypto';

export type IdempotencyExecutionState = 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED';

export interface IdempotencyRecord<TResult = unknown> {
  key: string;
  requestHash: string;
  state: IdempotencyExecutionState;
  result?: TResult;
  errorMessage?: string;
  createdAtMs: number;
  updatedAtMs: number;
  expiresAtMs: number;
  version: number;
}

export type ReservationResult<TResult = unknown> =
  | { status: 'ACQUIRED'; version: number }
  | { status: 'REPLAY'; result: TResult }
  | { status: 'IN_PROGRESS'; retryAfterMs: number }
  | { status: 'CONFLICT'; message: string };

export interface TransactionalIdempotencyStore<TResult = unknown> {
  /**
   * Atomically reserve execution intent for the given key and payload.
   * If the key is new: creates a PENDING reservation and returns 'ACQUIRED'.
   * If the key exists with identical hash and state COMPLETED: returns 'REPLAY'.
   * If the key exists with identical hash and state PENDING/EXECUTING: returns 'IN_PROGRESS'.
   * If the key exists with a DIFFERENT hash: returns 'CONFLICT'.
   */
  reserve(
    key: string,
    payload: unknown,
    ttlMs?: number,
  ): Promise<ReservationResult<TResult>>;

  /**
   * Commit final result for an acquired reservation.
   */
  commit(
    key: string,
    payload: unknown,
    result: TResult,
    version: number,
  ): Promise<void>;

  /**
   * Mark a reservation as failed to permit safe retry after failure.
   */
  fail(
    key: string,
    payload: unknown,
    errorMessage: string,
    version: number,
  ): Promise<void>;

  /**
   * Deterministic hash computation.
   */
  hashPayload(payload: unknown): string;
}

export function computeDeterministicPayloadHash(payload: unknown): string {
  // Canonical JSON stringification with sorted object keys
  const canonicalString = JSON.stringify(payload, Object.keys(payload as object || {}).sort());
  return createHash('sha256').update(canonicalString).digest('hex');
}
