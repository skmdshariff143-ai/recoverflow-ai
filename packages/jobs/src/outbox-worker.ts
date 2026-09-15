import { db } from '@recoverflow/core';
import { globalRecoveryQueue } from './queue';

export interface OutboxWorkerConfig {
  pollIntervalMs?: number;
  batchSize?: number;
}

export class TransactionalOutboxWorker {
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private config: Required<OutboxWorkerConfig>;
  private processedIds = new Set<string>();

  constructor(config?: OutboxWorkerConfig) {
    this.config = {
      pollIntervalMs: config?.pollIntervalMs || 1000,
      batchSize: config?.batchSize || 20,
    };
  }

  public async processBatch(): Promise<number> {
    const pendingEvents = await db.getPendingOutboxEvents(this.config.batchSize);
    if (pendingEvents.length === 0) return 0;

    let processedCount = 0;

    for (const event of pendingEvents) {
      // Idempotency check on in-flight events
      if (this.processedIds.has(event.idempotencyKey)) {
        await db.markOutboxEventPublished(event.id);
        continue;
      }

      await db.markOutboxEventProcessing(event.id);

      try {
        const abandonmentType = event.eventType === 'PAYMENT_FAILED' ? 'PAYMENT_FAILED' : 'CHECKOUT_STEP';
        await globalRecoveryQueue.scheduleRecovery(event.aggregateId, abandonmentType);

        this.processedIds.add(event.idempotencyKey);
        await db.markOutboxEventPublished(event.id);
        processedCount++;
      } catch (err: unknown) {
        console.error(`[OutboxWorker] Failed to process event ${event.id}:`, err);
        await db.markOutboxEventFailed(event.id, err instanceof Error ? err.message : 'Processing error');
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
        console.error('[OutboxWorker] Loop error:', e);
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
