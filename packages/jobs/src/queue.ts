import { Queue, type ConnectionOptions } from 'bullmq';
import { 
  db, 
  getRuntimeMode, 
  StartupConfigurationError, 
  globalSuppressionService, 
  checkShopifyInventoryAvailability,
  createShopifySingleUseDiscount,
  routeCartByLtv,
  type AbandonmentType,
} from '@recoverflow/core';
import { runRecoveryAgent, isVipVoiceEligible, dispatchVipVoiceRescue } from '@recoverflow/agents';
import { sendWhatsAppMessage } from './channels/whatsapp';
import { sendCartRecoveryEmail } from './channels/resend';

export const QUEUE_NAMES = {
  IMMEDIATE: 'immediate-queue', // Payment failures (3m delay)
  STANDARD: 'standard-queue', // Abandoned checkout (30m delay)
  FALLBACK_EMAIL: 'fallback-email-queue', // 3h unread check
  DEAD_LETTER: 'recoverflow-dlq', // DLQ for exhausted retries
};

export const CADENCES = {
  PAYMENT_FAILED_MS: 3 * 60 * 1000, // 3 minutes
  CHECKOUT_ABANDONED_MS: 30 * 60 * 1000, // 30 minutes
  FALLBACK_EMAIL_MS: 3 * 60 * 60 * 1000, // 3 hours
  FINAL_REMINDER_MS: 24 * 60 * 60 * 1000, // 24 hours
};

let simulatedMemoryPressure: number | null = null;

export function setSimulatedMemoryPressure(ratio: number | null): void {
  simulatedMemoryPressure = ratio;
}

export function getSystemMemoryPressure(): number {
  if (simulatedMemoryPressure !== null) return simulatedMemoryPressure;
  try {
    const mem = process.memoryUsage();
    return mem.heapUsed / (mem.heapTotal || 1);
  } catch {
    return 0.1;
  }
}

export function calculateJitteredBackoffMs(attempt: number, baseMs = 1000, maxMs = 86400000): number {
  const exp = Math.min(maxMs, baseMs * Math.pow(2, Math.min(attempt, 20)));
  const jitter = Math.floor(Math.random() * (exp * 0.2));
  return Math.min(maxMs, exp + jitter);
}

export interface CartJobData {
  cartEventId: string;
  abandonmentType: AbandonmentType;
}

export interface FallbackJobData {
  cartEventId: string;
}

interface ScheduledMemoryJob {
  id: string;
  type: 'PRIMARY' | 'FALLBACK';
  cartEventId: string;
  runAt: number;
  timer: NodeJS.Timeout | null;
}

export class RecoveryQueueService {
  private redisAvailable = false;
  private immediateQueue: Queue | null = null;
  private standardQueue: Queue | null = null;
  private fallbackQueue: Queue | null = null;
  private dlqQueue: Queue | null = null;
  private memoryJobs = new Map<string, ScheduledMemoryJob>();

  constructor() {
    this.initQueues();
  }

  private initQueues() {
    if (process.env.REDIS_URL) {
      try {
        const connection: ConnectionOptions = { url: process.env.REDIS_URL };
        const defaultJobOptions = {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000, // 1s, 5s, 15s
          },
          removeOnComplete: true,
        };

        this.immediateQueue = new Queue(QUEUE_NAMES.IMMEDIATE, { connection, defaultJobOptions });
        this.standardQueue = new Queue(QUEUE_NAMES.STANDARD, { connection, defaultJobOptions });
        this.fallbackQueue = new Queue(QUEUE_NAMES.FALLBACK_EMAIL, { connection, defaultJobOptions });
        this.dlqQueue = new Queue(QUEUE_NAMES.DEAD_LETTER, { connection });
        this.redisAvailable = true;
      } catch {
        this.redisAvailable = false;
      }
    }
  }

  getInitialDelayMs(type: AbandonmentType): number {
    if (type === 'PAYMENT_FAILED') {
      return CADENCES.PAYMENT_FAILED_MS; // 3m
    }
    return CADENCES.CHECKOUT_ABANDONED_MS; // 30m
  }

  /**
   * Schedules a primary recovery job in either immediate-queue or standard-queue.
   */
  async scheduleRecovery(
    cartEventId: string,
    abandonmentType: AbandonmentType,
    delayMsOverride?: number
  ): Promise<{ jobId: string; delayMs: number; shed?: boolean }> {
    // DEFCON-1 LOAD SHEDDING: Check system memory pressure (>80%)
    const memoryPressure = getSystemMemoryPressure();
    if (memoryPressure > 0.8) {
      const cart = await db.getCartById(cartEventId);
      if (cart) {
        const ltv = routeCartByLtv(cart);
        if (ltv.predictiveLtvScore < 0.2) {
          console.warn(`[DEFCON-1 Load Shedding] High memory pressure (${(memoryPressure * 100).toFixed(1)}%). Dropping low-LTV cart ${cartEventId} (score: ${ltv.predictiveLtvScore})`);
          return { jobId: `shed_${cartEventId}`, delayMs: -1, shed: true };
        }
      }
    }

    const delayMs = delayMsOverride !== undefined ? delayMsOverride : this.getInitialDelayMs(abandonmentType);

    if (this.redisAvailable) {
      const targetQueue = abandonmentType === 'PAYMENT_FAILED' ? this.immediateQueue : this.standardQueue;
      if (targetQueue) {
        const job = await targetQueue.add(
          'execute-recovery',
          { cartEventId, abandonmentType },
          { delay: delayMs, jobId: `recov_${cartEventId}` }
        );
        return { jobId: job.id as string, delayMs };
      }
    }

    // In-memory scheduler
    const jobId = `mem_recov_${cartEventId}`;
    const timer = setTimeout(() => {
      this.executePrimaryRecovery(cartEventId).catch((err) => {
        console.error(`[RecoveryWorker] Error executing job for ${cartEventId}:`, err);
      });
    }, delayMs);

    this.memoryJobs.set(jobId, {
      id: jobId,
      type: 'PRIMARY',
      cartEventId,
      runAt: Date.now() + delayMs,
      timer,
    });

    return { jobId, delayMs };
  }

  /**
   * Schedules a 3-hour fallback check for WhatsApp unread/failed status.
   */
  async scheduleFallbackCheck(cartEventId: string, delayMsOverride?: number): Promise<{ jobId: string; delayMs: number }> {
    const delayMs = delayMsOverride !== undefined ? delayMsOverride : CADENCES.FALLBACK_EMAIL_MS;

    if (this.redisAvailable && this.fallbackQueue) {
      const job = await this.fallbackQueue.add(
        'execute-fallback',
        { cartEventId },
        { delay: delayMs, jobId: `fallback_${cartEventId}` }
      );
      return { jobId: job.id as string, delayMs };
    }

    const jobId = `mem_fallback_${cartEventId}`;
    const timer = setTimeout(() => {
      this.executeFallbackEmail(cartEventId).catch((err) => {
        console.error(`[FallbackWorker] Error executing fallback for ${cartEventId}:`, err);
      });
    }, delayMs);

    this.memoryJobs.set(jobId, {
      id: jobId,
      type: 'FALLBACK',
      cartEventId,
      runAt: Date.now() + delayMs,
      timer,
    });

    return { jobId, delayMs };
  }

  /**
   * Cancels any pending scheduled recovery jobs for a cart (e.g. customer completed order).
   */
  async cancelPendingRecovery(cartEventId: string): Promise<void> {
    // In-memory cancellation
    for (const [key, job] of this.memoryJobs.entries()) {
      if (job.cartEventId === cartEventId) {
        if (job.timer) clearTimeout(job.timer);
        this.memoryJobs.delete(key);
      }
    }

    // Redis queue cancellation
    if (this.redisAvailable) {
      const jobId = `recov_${cartEventId}`;
      try {
        const immJob = await this.immediateQueue?.getJob(jobId);
        if (immJob) await immJob.remove();
        const stdJob = await this.standardQueue?.getJob(jobId);
        if (stdJob) await stdJob.remove();
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Core worker logic: Executes primary recovery with inventory check & dynamic single-use coupons.
   */
  async executePrimaryRecovery(cartEventId: string): Promise<{
    aborted: boolean;
    reason?: string;
    channel?: string;
    messageId?: string;
    discountCode?: string | null;
  }> {
    const cart = await db.getCartById(cartEventId);
    if (!cart) {
      return { aborted: true, reason: 'Cart event not found' };
    }

    // Guard: Abort if customer already completed purchase
    if (cart.status === 'RECOVERED') {
      return { aborted: true, reason: 'Customer already completed purchase' };
    }

    // Guard: Abort if expired or already aborted
    if (cart.status === 'EXPIRED' || cart.status === 'OUT_OF_STOCK_ABORTED') {
      return { aborted: true, reason: `Cart ${cart.status.toLowerCase()}` };
    }

    const merchant = await db.getMerchant(cart.merchantId);
    if (!merchant) {
      return { aborted: true, reason: 'Merchant not found' };
    }

    // INVENTORY AVAILABILITY CHECK: Prior to sending recovery, check stock
    const inventoryResult = await checkShopifyInventoryAvailability(merchant, cart.items);
    if (!inventoryResult.allAvailable) {
      await db.updateCartStatus(cart.id, 'OUT_OF_STOCK_ABORTED', 'OUT_OF_STOCK_ABORTED');
      console.log(`[Inventory Check] Aborting recovery for cart ${cart.id}: Items out of stock: ${inventoryResult.unavailableItems.join(', ')}`);
      return {
        aborted: true,
        reason: `Inventory out of stock: ${inventoryResult.unavailableItems.join(', ')}`,
      };
    }

    // Check suppression list for phone
    if (cart.customerPhone) {
      const isSuppressed = await globalSuppressionService.isSuppressed(merchant.id, cart.customerPhone, 'PHONE');
      if (isSuppressed) {
        return { aborted: true, reason: 'Customer phone is suppressed/opted-out' };
      }
    }

    // Generate dynamic single-use coupon if merchant allows discounts
    let singleUseCoupon: string | null = null;
    if (merchant.discountCeilingPercentage >= 5) {
      const discountPercentage = Math.min(merchant.discountCeilingPercentage, 15);
      const couponResult = await createShopifySingleUseDiscount(merchant, {
        merchantId: merchant.id,
        cartToken: cart.cartToken,
        discountPercentage,
        minSubtotalAmount: Math.max(50, cart.totalPrice * 0.8),
        currency: cart.currency,
        durationHours: 2,
      });
      singleUseCoupon = couponResult.code;
    }

    // Run RecoveryAgent
    const startTime = Date.now();
    const agentOutput = await runRecoveryAgent({
      customerName: cart.customerName,
      items: cart.items,
      totalValue: cart.totalPrice,
      currency: cart.currency,
      dropOffReason: cart.abandonmentType,
      checkoutUrl: cart.checkoutUrl,
      merchantTone: {
        brandName: merchant.storeName,
        guidelines: merchant.brandToneGuidelines,
        casualVsFormal: merchant.brandVoiceCasualVsFormal,
        urgencyVsGentle: merchant.brandVoiceUrgencyVsGentle,
        discountCeilingPercentage: merchant.discountCeilingPercentage,
      },
    });
    const latencyMs = Date.now() - startTime;

    const finalDiscountCode = singleUseCoupon || agentOutput.suggestedDiscountCode;

    // Predictive LTV Scoring & Tier Evaluation
    const ltvDecision = routeCartByLtv(cart);
    const isVipEligible = ltvDecision.tier === 'VIP_IMMEDIATE' || isVipVoiceEligible(cart.totalPrice, cart.abandonmentType);

    // Check VIP White-Glove Voice Eligibility (Predictive LTV > 0.8 or $1,000+ payment failure)
    if (isVipEligible && cart.customerPhone) {
      const voiceResult = await dispatchVipVoiceRescue({
        context: {
          cartId: cart.id,
          cartToken: cart.cartToken,
          customerName: cart.customerName,
          customerPhone: cart.customerPhone,
          customerEmail: cart.customerEmail,
          totalPrice: cart.totalPrice,
          currency: cart.currency,
          items: cart.items,
          storeName: merchant.storeName,
          checkoutUrl: cart.checkoutUrl,
          discountCeilingPercentage: merchant.discountCeilingPercentage,
        },
      });

      await db.logMessage({
        id: `msg_voice_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        cartEventId: cart.id,
        merchantId: merchant.id,
        channel: 'VOICE',
        direction: 'OUTBOUND',
        content: `VIP Voice Concierge Call Dispatched (CallSid: ${voiceResult.callSid || 'simulated'})`,
        latencyMs,
        deliveryStatus: voiceResult.success ? 'DELIVERED' : 'FAILED',
        externalMessageId: voiceResult.callSid,
        createdAt: new Date(),
      });
    }

    // Dispatch WhatsApp with Latency Fallback Circuit Breaker (>2000ms)
    if (cart.customerPhone) {
      const waStartTime = Date.now();
      const sendResult = await sendWhatsAppMessage({
        to: cart.customerPhone,
        templateName: merchant.whatsappTemplateName,
        bodyText: agentOutput.messageBody,
        ctaUrl: agentOutput.callToActionUrl,
        discountCode: finalDiscountCode,
        token: merchant.whatsappToken,
        phoneNumberId: merchant.whatsappPhoneId,
      });
      const waLatencyMs = Date.now() - waStartTime;

      // Update cart status & message log
      await db.updateCartStatus(cart.id, 'CONTACTED', 'WHATSAPP_SENT', finalDiscountCode);
      await db.logMessage({
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        cartEventId: cart.id,
        merchantId: merchant.id,
        channel: 'WHATSAPP',
        direction: 'OUTBOUND',
        content: agentOutput.messageBody,
        tokensUsed: Math.ceil(agentOutput.messageBody.length / 4),
        latencyMs: waLatencyMs,
        deliveryStatus: sendResult.success ? 'DELIVERED' : 'FAILED',
        externalMessageId: sendResult.messageId,
        createdAt: new Date(),
      });

      // LATENCY CIRCUIT BREAKER: If WhatsApp API latency > 2000ms or failed, immediately fallback to email
      if ((waLatencyMs > 2000 || !sendResult.success) && cart.customerEmail) {
        console.warn(`[Latency Fallback Triggered] WhatsApp latency (${waLatencyMs}ms) exceeded 2000ms threshold or failed. Rerouting to Email Fallback.`);
        const emailFallback = await this.executeFallbackEmail(cart.id, agentOutput.messageBody, finalDiscountCode);
        return {
          aborted: emailFallback.aborted,
          reason: emailFallback.reason || `WhatsApp latency ${waLatencyMs}ms > 2000ms`,
          channel: 'EMAIL',
          messageId: emailFallback.emailId,
          discountCode: finalDiscountCode,
        };
      }

      // Automatically queue 3-hour fallback check
      await this.scheduleFallbackCheck(cart.id);

      return {
        aborted: false,
        channel: 'WHATSAPP',
        messageId: sendResult.messageId,
        discountCode: finalDiscountCode,
      };
    } else if (cart.customerEmail) {
      const emailFallback = await this.executeFallbackEmail(cart.id, agentOutput.messageBody, finalDiscountCode);
      return {
        aborted: emailFallback.aborted,
        reason: emailFallback.reason,
        channel: 'EMAIL',
        messageId: emailFallback.emailId,
        discountCode: finalDiscountCode,
      };
    }

    return { aborted: true, reason: 'No customer contact found' };
  }

  /**
   * Fallback email execution if WhatsApp unread/failed after 3 hours.
   */
  async executeFallbackEmail(
    cartEventId: string,
    customMessage?: string,
    customDiscount?: string | null
  ): Promise<{ aborted: boolean; reason?: string; emailId?: string }> {
    const cart = await db.getCartById(cartEventId);
    if (!cart) return { aborted: true, reason: 'Cart not found' };

    if (cart.status === 'RECOVERED' || cart.status === 'OUT_OF_STOCK_ABORTED') {
      return { aborted: true, reason: `Cart ${cart.status.toLowerCase()}` };
    }

    if (!cart.customerEmail) {
      return { aborted: true, reason: 'No customer email available' };
    }

    const merchant = await db.getMerchant(cart.merchantId);
    if (!merchant) return { aborted: true, reason: 'Merchant not found' };

    const isSuppressed = await globalSuppressionService.isSuppressed(merchant.id, cart.customerEmail, 'EMAIL');
    if (isSuppressed) {
      return { aborted: true, reason: 'Customer email is suppressed' };
    }

    const emailResult = await sendCartRecoveryEmail({
      to: cart.customerEmail,
      customerName: cart.customerName,
      storeName: merchant.storeName,
      fromEmail: merchant.fromEmail,
      items: cart.items,
      totalPrice: cart.totalPrice,
      currency: cart.currency,
      checkoutUrl: cart.checkoutUrl,
      discountCode: customDiscount || cart.suggestedDiscountCode || 'SAVE10',
      messageBody: customMessage,
      apiKey: merchant.resendApiKey,
    });

    await db.updateCartStatus(cart.id, 'CONTACTED', 'EMAIL_FALLBACK');
    await db.logMessage({
      id: `msg_em_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      cartEventId: cart.id,
      merchantId: merchant.id,
      channel: 'EMAIL',
      direction: 'OUTBOUND',
      content: `Email fallback dispatched: Cart recovery for ${cart.customerName || 'customer'}`,
      latencyMs: 250,
      deliveryStatus: emailResult.success ? 'SENT' : 'FAILED',
      externalMessageId: emailResult.emailId,
      createdAt: new Date(),
    });

    return {
      aborted: false,
      emailId: emailResult.emailId,
    };
  }

  async routeToDeadLetterQueue(cartEventId: string, error: string): Promise<void> {
    if (this.redisAvailable && this.dlqQueue) {
      await this.dlqQueue.add('dead-letter-job', { cartEventId, error, failedAt: new Date().toISOString() });
    }
    await db.logMessage({
      id: `msg_dlq_${Date.now()}`,
      cartEventId,
      merchantId: 'merchant_default_01',
      channel: 'WHATSAPP',
      direction: 'OUTBOUND',
      content: `[DLQ Entry] Execution aborted after max retries: ${error}`,
      deliveryStatus: 'FAILED',
      createdAt: new Date(),
    });
  }

  async close(): Promise<void> {
    // Clear all in-memory timers
    for (const job of this.memoryJobs.values()) {
      if (job.timer) clearTimeout(job.timer);
    }
    this.memoryJobs.clear();

    // Close BullMQ queues
    const queues = [this.immediateQueue, this.standardQueue, this.fallbackQueue, this.dlqQueue];
    for (const q of queues) {
      if (q) {
        try {
          await q.close();
        } catch {}
      }
    }
    this.immediateQueue = null;
    this.standardQueue = null;
    this.fallbackQueue = null;
    this.dlqQueue = null;
    this.redisAvailable = false;
  }
}

export const globalRecoveryQueue = new RecoveryQueueService();

