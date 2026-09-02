/**
 * PayBack AI — In-Memory Live Webhook Event Store.
 *
 * Retains incoming real Razorpay test-mode webhook events for the current runtime session.
 * Supports thread-safe push, retrieval, and clear operations.
 */

import type { FailedPayment } from '@/types/payment';

class LiveWebhookStore {
  private events: FailedPayment[] = [];
  private readonly maxCapacity = 500;

  addEvent(payment: FailedPayment): void {
    // Avoid duplicate payment_id entries
    const existingIndex = this.events.findIndex((p) => p.payment_id === payment.payment_id);
    if (existingIndex >= 0) {
      this.events[existingIndex] = payment;
    } else {
      this.events.unshift(payment);
      if (this.events.length > this.maxCapacity) {
        this.events.pop();
      }
    }
  }

  getEvents(): FailedPayment[] {
    return [...this.events];
  }

  clear(): void {
    this.events = [];
  }

  getCount(): number {
    return this.events.length;
  }
}

// Global singleton instance for serverless runtime instance memory
const globalForWebhook = globalThis as unknown as { liveWebhookStore?: LiveWebhookStore };

export const liveWebhookStore = globalForWebhook.liveWebhookStore ?? new LiveWebhookStore();
globalForWebhook.liveWebhookStore = liveWebhookStore;
