/**
 * Razorpay Webhook Replay Protection & Deduplication Tests
 *
 * Assertions:
 *  1. First delivery processes normally.
 *  2. Identical second delivery returns 200 { received: true, duplicate: true } and performs no new state write.
 *  3. Second delivery with a DIFFERENT event id (or body) processes normally.
 *  4. An invalid HMAC signature is rejected BEFORE the deduplication lookup runs.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { globalIdempotency, liveWebhookStore } from '@recoverflow/core';
import * as RazorpayWebhook from '../../apps/web/src/app/api/webhooks/razorpay/route';

const TEST_SECRET = 'whsec_test_secret_for_razorpay_replay_32bytes';

function generateHmacSignature(body: string, secret: string = TEST_SECRET): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

function createSamplePayload(paymentId = 'pay_test_replay_001') {
  return {
    entity: 'event',
    account_id: 'acc_test_123',
    event: 'payment.failed',
    contains: ['payment'],
    payload: {
      payment: {
        entity: {
          id: paymentId,
          amount: 250000,
          currency: 'INR',
          status: 'failed',
          order_id: 'order_test_123',
          invoice_id: null,
          international: false,
          method: 'upi',
          amount_refunded: 0,
          refund_status: null,
          captured: false,
          description: 'Test payment failed',
          card_id: null,
          bank: null,
          wallet: null,
          vpa: 'customer@okhdfcbank',
          email: 'customer@example.com',
          contact: '+919876543210',
          notes: {},
          fee: null,
          tax: null,
          error_code: 'BAD_REQUEST_ERROR',
          error_description: 'Payment failed due to insufficient funds',
          error_source: 'bank',
          error_step: 'payment_authorization',
          error_reason: 'payment_failed',
          created_at: 1724918400,
        },
      },
    },
    created_at: 1724918400,
  };
}

describe('Razorpay Webhook Replay Protection & Deduplication', () => {
  beforeEach(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = TEST_SECRET;
    delete process.env.RECOVERFLOW_ALLOW_ANON_DEMO;
    process.env.RECOVERFLOW_RUNTIME_MODE = 'TEST';
    globalIdempotency.clear();
    liveWebhookStore.clear();
  });

  it('first delivery processes normally', async () => {
    const payload = createSamplePayload('pay_delivery_01');
    const rawBody = JSON.stringify(payload);
    const signature = generateHmacSignature(rawBody);

    const req = new NextRequest('http://localhost:3000/api/webhooks/razorpay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': signature,
        'x-razorpay-event-id': 'evt_delivery_001',
      },
      body: rawBody,
    });

    const countBefore = liveWebhookStore.getCount();
    const res = await RazorpayWebhook.POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.event).toBe('payment.failed');
    expect(data.paymentId).toBe('pay_delivery_01');

    const countAfter = liveWebhookStore.getCount();
    expect(countAfter).toBe(countBefore + 1);
  });

  it('identical second delivery returns 200 duplicate:true and performs no new state write', async () => {
    const payload = createSamplePayload('pay_delivery_02');
    const rawBody = JSON.stringify(payload);
    const signature = generateHmacSignature(rawBody);

    const makeRequest = () =>
      new NextRequest('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': signature,
          'x-razorpay-event-id': 'evt_delivery_002',
        },
        body: rawBody,
      });

    // 1. First delivery
    const res1 = await RazorpayWebhook.POST(makeRequest());
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.success).toBe(true);
    const storeCountAfterFirst = liveWebhookStore.getCount();

    // 2. Replayed second delivery with identical event-id header
    const res2 = await RazorpayWebhook.POST(makeRequest());
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.received).toBe(true);
    expect(data2.duplicate).toBe(true);

    // Invariant: No state write occurred on duplicate replay
    const storeCountAfterSecond = liveWebhookStore.getCount();
    expect(storeCountAfterSecond).toBe(storeCountAfterFirst);
  });

  it('second delivery with a DIFFERENT event id processes normally', async () => {
    const payload1 = createSamplePayload('pay_diff_01');
    const rawBody1 = JSON.stringify(payload1);
    const signature1 = generateHmacSignature(rawBody1);

    const req1 = new NextRequest('http://localhost:3000/api/webhooks/razorpay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': signature1,
        'x-razorpay-event-id': 'evt_diff_001',
      },
      body: rawBody1,
    });

    const res1 = await RazorpayWebhook.POST(req1);
    expect(res1.status).toBe(200);
    const countAfterFirst = liveWebhookStore.getCount();

    // Second delivery with distinct event ID and payment ID
    const payload2 = createSamplePayload('pay_diff_02');
    const rawBody2 = JSON.stringify(payload2);
    const signature2 = generateHmacSignature(rawBody2);

    const req2 = new NextRequest('http://localhost:3000/api/webhooks/razorpay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': signature2,
        'x-razorpay-event-id': 'evt_diff_002',
      },
      body: rawBody2,
    });

    const res2 = await RazorpayWebhook.POST(req2);
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.success).toBe(true);
    expect(data2.paymentId).toBe('pay_diff_02');

    const countAfterSecond = liveWebhookStore.getCount();
    expect(countAfterSecond).toBe(countAfterFirst + 1);
  });

  it('an invalid HMAC signature is rejected BEFORE the deduplication lookup runs', async () => {
    const payload = createSamplePayload('pay_invalid_hmac');
    const rawBody = JSON.stringify(payload);
    const badSignature = 'invalid_hmac_signature_0000000000000000000000000000000000000000';

    const req1 = new NextRequest('http://localhost:3000/api/webhooks/razorpay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': badSignature,
        'x-razorpay-event-id': 'evt_rejected_hmac_001',
      },
      body: rawBody,
    });

    const res1 = await RazorpayWebhook.POST(req1);
    expect(res1.status).toBe(401);

    // Because HMAC validation failed before idempotency check, the event id was NOT acquired
    // Re-sending with valid HMAC under the same event id must succeed as the first valid delivery
    const validSignature = generateHmacSignature(rawBody);
    const req2 = new NextRequest('http://localhost:3000/api/webhooks/razorpay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': validSignature,
        'x-razorpay-event-id': 'evt_rejected_hmac_001',
      },
      body: rawBody,
    });

    const res2 = await RazorpayWebhook.POST(req2);
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.success).toBe(true);
    expect(data2.duplicate).toBeUndefined();
  });
});
