// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RecoverFlowPixelTracker, IntentTelemetrySnapshot } from '@recoverflow/pixel';
import { POST as intentRouteHandler } from '../../apps/web/src/app/api/v1/telemetry/intent/route';
import { NextRequest } from 'next/server';

describe('@recoverflow/pixel Edge Intent Telemetry & Ingestion', () => {
  let capturedSnapshots: IntentTelemetrySnapshot[] = [];
  let tracker: RecoverFlowPixelTracker;

  beforeEach(() => {
    capturedSnapshots = [];
  });

  afterEach(() => {
    if (tracker) {
      tracker.destroy();
    }
  });

  it('triggers EXIT_VELOCITY_TRIGGER when cursor departs rapidly toward tab bar', () => {
    tracker = new RecoverFlowPixelTracker({
      cartToken: 'tok_pixel_test_01',
      shopDomain: 'aurora-apparel.myshopify.com',
      velocityThresholdPxPerMs: -0.8,
      onIntentCaptured: (snapshot) => {
        capturedSnapshots.push(snapshot);
      },
    });

    // Mock initial mouse position
    const t0 = 1000;
    vi.spyOn(Date, 'now').mockReturnValue(t0);
    window.dispatchEvent(new MouseEvent('mousemove', { clientY: 200 }));

    // Rapid upward jerk toward tab bar within 50ms: (20 - 200) / 50 = -3.6 px/ms
    vi.spyOn(Date, 'now').mockReturnValue(t0 + 50);
    window.dispatchEvent(new MouseEvent('mousemove', { clientY: 20 }));

    expect(capturedSnapshots.length).toBe(1);
    expect(capturedSnapshots[0].eventType).toBe('EXIT_VELOCITY_TRIGGER');
    expect(capturedSnapshots[0].cartToken).toBe('tok_pixel_test_01');
    expect(capturedSnapshots[0].velocityVector).toBeDefined();
    expect(capturedSnapshots[0].velocityVector!.vy).toBeLessThan(-0.8);
    expect(capturedSnapshots[0].velocityVector!.y).toBe(20);
  });

  it('does not trigger exit intent for normal downward browsing movement', () => {
    tracker = new RecoverFlowPixelTracker({
      cartToken: 'tok_pixel_test_02',
      shopDomain: 'aurora-apparel.myshopify.com',
      velocityThresholdPxPerMs: -0.8,
      onIntentCaptured: (snapshot) => {
        capturedSnapshots.push(snapshot);
      },
    });

    const t0 = 2000;
    vi.spyOn(Date, 'now').mockReturnValue(t0);
    window.dispatchEvent(new MouseEvent('mousemove', { clientY: 100 }));

    // Moving downward
    vi.spyOn(Date, 'now').mockReturnValue(t0 + 40);
    window.dispatchEvent(new MouseEvent('mousemove', { clientY: 350 }));

    expect(capturedSnapshots.length).toBe(0);
  });

  it('triggers TAB_BLUR_TRIGGER on document visibility loss or window blur', () => {
    tracker = new RecoverFlowPixelTracker({
      cartToken: 'tok_pixel_test_03',
      shopDomain: 'aurora-apparel.myshopify.com',
      onIntentCaptured: (snapshot) => {
        capturedSnapshots.push(snapshot);
      },
    });

    window.dispatchEvent(new Event('blur'));

    expect(capturedSnapshots.length).toBe(1);
    expect(capturedSnapshots[0].eventType).toBe('TAB_BLUR_TRIGGER');
  });

  it('captures customer email on checkout form field blur', () => {
    tracker = new RecoverFlowPixelTracker({
      cartToken: 'tok_pixel_test_04',
      shopDomain: 'aurora-apparel.myshopify.com',
      onIntentCaptured: (snapshot) => {
        capturedSnapshots.push(snapshot);
      },
    });

    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.name = 'checkout[email]';
    emailInput.value = 'shopper.exit@example.com';
    document.body.appendChild(emailInput);

    const focusOutEvent = new FocusEvent('focusout', { bubbles: true });
    Object.defineProperty(focusOutEvent, 'target', { value: emailInput, enumerable: true });
    document.dispatchEvent(focusOutEvent);

    expect(capturedSnapshots.length).toBe(1);
    expect(capturedSnapshots[0].eventType).toBe('FIELD_BLUR_IDENTITY');
    expect(capturedSnapshots[0].customerEmail).toBe('shopper.exit@example.com');

    document.body.removeChild(emailInput);
  });

  it('increments failure counter on repeated invalid discount attempts', () => {
    tracker = new RecoverFlowPixelTracker({
      cartToken: 'tok_pixel_test_05',
      shopDomain: 'aurora-apparel.myshopify.com',
      onIntentCaptured: (snapshot) => {
        capturedSnapshots.push(snapshot);
      },
    });

    tracker.recordDiscountFailure('EXPIRED20');
    tracker.recordDiscountFailure('TIKTOK50');

    expect(capturedSnapshots.length).toBe(2);
    expect(capturedSnapshots[1].eventType).toBe('DISCOUNT_FAILURE_TRIGGER');
    expect(capturedSnapshots[1].failedDiscountCodesCount).toBe(2);
  });

  it('successfully ingests intent snapshot at edge route /api/v1/telemetry/intent', async () => {
    const payload = {
      cartToken: 'tok_edge_ingest_8841',
      shopDomain: 'aurora-apparel.myshopify.com',
      eventType: 'EXIT_VELOCITY_TRIGGER',
      customerEmail: 'clara@luxurybrand.com',
      customerPhone: '+14155552671',
      velocityVector: { vy: -1.85, y: 15 },
      timestamp: Date.now(),
    };

    const req = new NextRequest('http://localhost:3000/api/v1/telemetry/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await intentRouteHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe('ingested');
    expect(json.sessionLinked).toBe(true);
    expect(json.preDropRisk).toBe('HIGH');
    expect(json.eventsCount).toBeGreaterThan(0);
  });

  it('rejects malformed intent payload with 400 Bad Request', async () => {
    const malformed = {
      // Missing cartToken and eventType
      shopDomain: 'aurora-apparel.myshopify.com',
    };

    const req = new NextRequest('http://localhost:3000/api/v1/telemetry/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(malformed),
    });

    const res = await intentRouteHandler(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/cartToken is required/i);
  });
});
