export type IntentEventType = 
  | 'EXIT_VELOCITY_TRIGGER' 
  | 'TAB_BLUR_TRIGGER' 
  | 'DISCOUNT_FAILURE_TRIGGER' 
  | 'FIELD_BLUR_IDENTITY'
  | 'MICRO_INTENT_BATCH';

export interface IntentTelemetrySnapshot {
  cartToken: string;
  shopDomain: string;
  eventType: IntentEventType;
  velocityVector?: { vy: number; y: number };
  customerEmail?: string;
  customerPhone?: string;
  failedDiscountCodesCount?: number;
  timestamp: number;
}

export interface PixelTrackerConfig {
  cartToken: string;
  shopDomain: string;
  endpointUrl?: string;
  velocityThresholdPxPerMs?: number; // e.g. -1.0 px/ms (moving up fast)
  flushIntervalMs?: number; // default 2000ms
  onIntentCaptured?: (snapshot: IntentTelemetrySnapshot) => void;
}

export class RecoverFlowPixelTracker {
  private config: Required<PixelTrackerConfig>;
  private prevY: number | null = null;
  private prevTime: number | null = null;
  private failedDiscounts = 0;
  private capturedIdentities = { email: '', phone: '' };
  private eventBuffer: IntentTelemetrySnapshot[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;

  constructor(config: PixelTrackerConfig) {
    this.config = {
      velocityThresholdPxPerMs: -1.0,
      flushIntervalMs: 2000,
      endpointUrl: '/api/v1/telemetry/intent',
      onIntentCaptured: () => {},
      ...config,
    };
    this.initListeners();
    this.startBatchTimer();
  }

  private startBatchTimer() {
    if (typeof window === 'undefined') return;
    this.flushTimer = setInterval(() => {
      this.flushBuffer();
    }, this.config.flushIntervalMs);
  }

  public flushBuffer(): void {
    if (this.eventBuffer.length === 0) return;
    const batch = [...this.eventBuffer];
    this.eventBuffer = [];

    // Send latest aggregated snapshot or first high-risk event
    const primaryEvent = batch.find((e) => e.eventType === 'EXIT_VELOCITY_TRIGGER') || batch[batch.length - 1];
    this.sendBeacon(primaryEvent);
  }

  private dispatchIntent(eventType: IntentEventType, extra?: Partial<IntentTelemetrySnapshot>, immediate = false) {
    if (this.destroyed) return;

    const snapshot: IntentTelemetrySnapshot = {
      cartToken: this.config.cartToken,
      shopDomain: this.config.shopDomain,
      eventType,
      customerEmail: this.capturedIdentities.email || undefined,
      customerPhone: this.capturedIdentities.phone || undefined,
      failedDiscountCodesCount: this.failedDiscounts,
      timestamp: Date.now(),
      ...extra,
    };

    if (this.config.onIntentCaptured) {
      this.config.onIntentCaptured(snapshot);
    }

    if (immediate || eventType === 'EXIT_VELOCITY_TRIGGER') {
      this.sendBeacon(snapshot);
    } else {
      this.eventBuffer.push(snapshot);
      if (this.eventBuffer.length >= 10) {
        this.flushBuffer();
      }
    }
  }

  private sendBeacon(snapshot: IntentTelemetrySnapshot) {
    if (typeof window === 'undefined') return;
    const url = this.config.endpointUrl;
    const payload = JSON.stringify(snapshot);

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
    } else if (typeof fetch !== 'undefined') {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  }

  private handleMouseMove = (e: MouseEvent) => {
    const now = Date.now();
    if (this.prevY !== null && this.prevTime !== null) {
      const dt = now - this.prevTime;
      if (dt > 10 && dt < 250) {
        const dy = e.clientY - this.prevY;
        const vy = dy / dt; // Negative means moving upward toward tab bar

        // If cursor is within top 40px and moving upward faster than threshold
        if (e.clientY <= 40 && vy < this.config.velocityThresholdPxPerMs) {
          this.dispatchIntent('EXIT_VELOCITY_TRIGGER', {
            velocityVector: { vy, y: e.clientY },
          }, true); // Urgent flush
        }
      }
    }
    this.prevY = e.clientY;
    this.prevTime = now;
  };

  private handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      this.dispatchIntent('TAB_BLUR_TRIGGER', undefined, true);
    }
  };

  private handleBlur = () => {
    this.dispatchIntent('TAB_BLUR_TRIGGER', undefined, false);
  };

  private handlePageUnload = () => {
    this.flushBuffer();
  };

  private handleFieldBlur = (e: FocusEvent) => {
    const target = e.target as HTMLInputElement;
    if (!target || !target.value) return;

    const name = (target.name || target.id || target.type || '').toLowerCase();
    const val = target.value.trim();

    if (name.includes('email') || val.includes('@')) {
      this.capturedIdentities.email = val;
      this.dispatchIntent('FIELD_BLUR_IDENTITY', { customerEmail: val }, false);
    } else if (name.includes('phone') || name.includes('tel') || /^\+?[0-9]{7,15}$/.test(val.replace(/[\s()-]/g, ''))) {
      this.capturedIdentities.phone = val;
      this.dispatchIntent('FIELD_BLUR_IDENTITY', { customerPhone: val }, false);
    }
  };

  /**
   * Helper to manually record a discount rejection error.
   */
  public recordDiscountFailure(_code?: string) {
    void _code;
    this.failedDiscounts++;
    this.dispatchIntent('DISCOUNT_FAILURE_TRIGGER', {
      failedDiscountCodesCount: this.failedDiscounts,
    }, true);
  }

  private initListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('mousemove', this.handleMouseMove, { passive: true });
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('beforeunload', this.handlePageUnload);
    window.addEventListener('pagehide', this.handlePageUnload);
    document.addEventListener('focusout', this.handleFieldBlur, true);
  }

  public destroy() {
    this.destroyed = true;
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (typeof window === 'undefined') return;

    window.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('beforeunload', this.handlePageUnload);
    window.removeEventListener('pagehide', this.handlePageUnload);
    document.removeEventListener('focusout', this.handleFieldBlur, true);
  }
}
