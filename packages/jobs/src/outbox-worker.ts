import crypto from 'crypto';
import { db } from '@recoverflow/core';
import { globalRecoveryQueue } from './queue';

export interface OutboxWorkerConfig {
  workerId?: string;
  pollIntervalMs?: number;
  batchSize?: number;
  lockTtlMs?: number;
}

export class TransactionalOutboxWorker {
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private config: Required<OutboxWorkerConfig>;
  public readonly workerId: string;

  constructor(config?: OutboxWorkerConfig) {
    this.workerId = config?.workerId || `worker_outbox_${crypto.randomBytes(6).toString('hex')}`;
    this.config = {
      workerId: this.workerId,
      pollIntervalMs: config?.pollIntervalMs || 1000,
      batchSize: config?.batchSize || 20,
      lockTtlMs: config?.lockTtlMs || 30000,
    };
  }

  public async processBatch(): Promise<number> {
    // Durable database claiming across multiple worker processes
    const claimedEvents = await db.claimOutboxEvents(
      this.workerId,
      this.config.batchSize,
      this.config.lockTtlMs
    );

    if (claimedEvents.length === 0) return 0;

    let processedCount = 0;

    for (const event of claimedEvents) {
      try {
        const abandonmentType = event.eventType === 'PAYMENT_FAILED' ? 'PAYMENT_FAILED' : 'CHECKOUT_STEP';
        await globalRecoveryQueue.scheduleRecovery(event.aggregateId, abandonmentType);

        await db.markOutboxEventPublished(event.id);
        processedCount++;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[OutboxWorker ${this.workerId}] Failed to process event ${event.id}:`, errMsg);
        await db.markOutboxEventFailed(event.id, errMsg, 5000);
      }
    }

    return processedCount;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const loop = async () => {
      if (!this.isRunning) return;
      try {
        await this.processBatch();
      } catch (e) {
        console.error(`[OutboxWorker ${this.workerId}] Loop error:`, e);
      }
      if (this.isRunning) {
        this.timer = setTimeout(loop, this.config.pollIntervalMs);
      }
    };

    this.timer = setTimeout(loop, 100);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

export const globalOutboxWorker = new TransactionalOutboxWorker();
