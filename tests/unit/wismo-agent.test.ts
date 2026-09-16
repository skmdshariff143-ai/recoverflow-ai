import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractOrderOrTrackingToken,
  formatFriendlyDeliveryDate,
  generateDeterministicWismoReply,
  runWismoAgent,
} from '../../packages/agents/src/wismo-agent';
import { db, type Merchant, type OrderRecord, type FulfillmentRecord } from '@recoverflow/core';

describe('Autonomous WISMO (Where Is My Order) Resolver Agent (Track 3)', () => {
  const mockMerchant: Merchant = {
    id: 'merchant_wismo_test_01',
    storeUrl: 'https://aurora-luxury.myshopify.com',
    storeName: 'Aurora Luxury Apparel',
    webhookSecret: 'sec_test_wismo',
    brandToneGuidelines: 'Warm, precise, luxury concierge tone.',
    brandVoiceCasualVsFormal: 0.7,
    brandVoiceUrgencyVsGentle: 0.3,
    discountCeilingPercentage: 15.0,
    minMarginPercentage: 20.0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleOrder: OrderRecord = {
    id: 'ord_sample_1042',
    merchantId: mockMerchant.id,
    shopifyOrderId: 'shpfy_ord_990142',
    orderNumber: '#1042',
    customerPhone: '+14155552671',
    customerEmail: 'clara@luxurybrand.com',
    customerName: 'Clara Oswald',
    currency: 'USD',
    totalPrice: 350.0,
    financialStatus: 'PAID',
    fulfillmentStatus: 'FULFILLED',
    items: [
      {
        id: 'item_w1',
        title: 'Italian Cashmere Wrap',
        price: 350.0,
        quantity: 1,
      },
    ],
    createdAt: new Date('2026-09-10T10:00:00Z'),
    updatedAt: new Date('2026-09-11T12:00:00Z'),
  };

  const sampleFulfillment: FulfillmentRecord = {
    id: 'ful_sample_881',
    orderId: sampleOrder.id,
    merchantId: mockMerchant.id,
    shopifyFulfillmentId: 'shpfy_ful_7721',
    trackingCompany: 'FedEx Express',
    trackingNumber: 'TRK9988112233',
    trackingUrl: 'https://track.recoverflow.ai/fedex?trk=TRK9988112233',
    status: 'IN_TRANSIT',
    estimatedDeliveryAt: new Date('2026-09-18T18:00:00Z'),
    shippedAt: new Date('2026-09-11T12:00:00Z'),
    deliveredAt: null,
    latestLocation: 'Memphis Logistics Hub, TN',
    createdAt: new Date('2026-09-11T12:00:00Z'),
    updatedAt: new Date('2026-09-11T12:00:00Z'),
  };

  beforeEach(async () => {
    await db.createOrUpdateOrder(sampleOrder);
    await db.createOrUpdateFulfillment(sampleFulfillment);
  });

  describe('extractOrderOrTrackingToken', () => {
    it('extracts order numbers with hashtag (#1042)', () => {
      const result = extractOrderOrTrackingToken('Hi, where is my order #1042?');
      expect(result.orderNumber).toBe('#1042');
    });

    it('extracts order numbers with words (order number 9841)', () => {
      const result = extractOrderOrTrackingToken('Can you check order number 9841 status?');
      expect(result.orderNumber).toBe('#9841');
    });

    it('extracts tracking codes (TRK9988112233)', () => {
      const result = extractOrderOrTrackingToken('Tracking update for TRK9988112233 please');
      expect(result.trackingNumber).toBe('TRK9988112233');
    });
  });

  describe('formatFriendlyDeliveryDate', () => {
    it('formats date into readable weekday and month string', () => {
      const formatted = formatFriendlyDeliveryDate(new Date('2026-09-18T12:00:00Z'));
      expect(formatted).toContain('Sep 18');
    });

    it('returns default fallback for invalid or null dates', () => {
      expect(formatFriendlyDeliveryDate(null)).toBe('within 2-3 business days');
      expect(formatFriendlyDeliveryDate('invalid-date')).toBe('within 2-3 business days');
    });
  });

  describe('generateDeterministicWismoReply', () => {
    it('returns polite request for order number when order is not found', () => {
      const result = generateDeterministicWismoReply(null, null, mockMerchant);
      expect(result.foundOrder).toBe(false);
      expect(result.reply).toContain('Order Number (e.g. #1042)');
    });

    it('returns transit status and tracking link for IN_TRANSIT shipments', () => {
      const result = generateDeterministicWismoReply(sampleOrder, sampleFulfillment, mockMerchant);
      expect(result.foundOrder).toBe(true);
      expect(result.orderNumber).toBe('#1042');
      expect(result.trackingCompany).toBe('FedEx Express');
      expect(result.reply).toContain('IN TRANSIT');
      expect(result.reply).toContain('FedEx Express');
      expect(result.reply).toContain(sampleFulfillment.trackingUrl!);
    });

    it('returns delivered confirmation for DELIVERED status', () => {
      const deliveredFulfillment: FulfillmentRecord = {
        ...sampleFulfillment,
        status: 'DELIVERED',
        deliveredAt: new Date(),
      };
      const result = generateDeterministicWismoReply(sampleOrder, deliveredFulfillment, mockMerchant);
      expect(result.reply).toContain('marked as DELIVERED');
    });

    it('returns out for delivery notice for OUT_FOR_DELIVERY status', () => {
      const outFulfillment: FulfillmentRecord = {
        ...sampleFulfillment,
        status: 'OUT_FOR_DELIVERY',
      };
      const result = generateDeterministicWismoReply(sampleOrder, outFulfillment, mockMerchant);
      expect(result.reply).toContain('OUT FOR DELIVERY today');
    });
  });

  describe('runWismoAgent full pipeline', () => {
    it('looks up order by explicit order number in incoming message', async () => {
      const result = await runWismoAgent({
        incomingMessage: 'Where is my order #1042?',
        merchant: mockMerchant,
      });

      expect(result.foundOrder).toBe(true);
      expect(result.orderNumber).toBe('#1042');
      expect(result.trackingNumber).toBe('TRK9988112233');
      expect(result.reply).toContain('FedEx Express');
    });

    it('looks up order by customer phone identifier when message has no order number', async () => {
      const result = await runWismoAgent({
        customerIdentifier: '+14155552671',
        incomingMessage: 'When will my package arrive?',
        merchant: mockMerchant,
      });

      expect(result.foundOrder).toBe(true);
      expect(result.orderNumber).toBe('#1042');
    });

    it('returns order prompt when customer identifier is unknown', async () => {
      const result = await runWismoAgent({
        customerIdentifier: '+19999999999',
        incomingMessage: 'Can you check my shipping?',
        merchant: mockMerchant,
      });

      expect(result.foundOrder).toBe(false);
      expect(result.reply).toContain('Order Number');
    });
  });
});
