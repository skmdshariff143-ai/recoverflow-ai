import { describe, it, expect } from 'vitest';
import {
  evaluateTranscriptSentiment,
  generateHumanHandoffTwiml,
  handleLiveTranscriptEvent,
} from '@recoverflow/agents';
import { db } from '@recoverflow/core';

describe('Real-Time Sentiment Human Handoff (Track 3)', () => {
  it('detects extreme frustration from angry customer utterances and flags handoff', () => {
    const angryUtterances = [
      'Why did my card decline?',
      'This website is terrible and broken!',
      'This is ridiculous, you stole my money and charged me twice!',
    ];

    const result = evaluateTranscriptSentiment(angryUtterances);

    expect(result.sentimentScore).toBeLessThan(0.25);
    expect(result.requiresHandoff).toBe(true);
    expect(result.reason).toContain('Customer frustration detected');
    expect(result.detectedKeywords).toContain('ridiculous');
  });

  it('triggers immediate handoff when explicit escalation keywords are detected', () => {
    const calmEscalationUtterances = [
      'Hello',
      'I want to speak to a real person or manager please',
    ];

    const result = evaluateTranscriptSentiment(calmEscalationUtterances);

    expect(result.requiresHandoff).toBe(true);
    expect(result.reason).toContain('requested human escalation');
    expect(result.detectedKeywords).toContain('manager');
  });

  it('keeps conversation automated when customer is polite and engaged', () => {
    const happyUtterances = [
      'Hi there',
      'Can I pay using Apple Pay?',
      'Thank you so much for holding my cart',
    ];

    const result = evaluateTranscriptSentiment(happyUtterances);

    expect(result.sentimentScore).toBeGreaterThanOrEqual(0.7);
    expect(result.requiresHandoff).toBe(false);
  });

  it('generates valid TwiML <Dial> XML to bridge the call to merchant support phone', () => {
    const twiml = generateHumanHandoffTwiml({
      supportPhone: '+18005550199',
      storeName: 'Maison Luxe',
      callerId: '+15005550006',
    });

    expect(twiml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(twiml).toContain('<Response>');
    expect(twiml).toContain('<Say voice="Polly.Joanna-Neural" language="en-US">');
    expect(twiml).toContain('Connecting you directly with a senior support concierge from Maison Luxe');
    expect(twiml).toContain('<Dial timeout="25" callerId="+15005550006">+18005550199</Dial>');
    expect(twiml).toContain('</Response>');
  });

  it('executes handleLiveTranscriptEvent, locks cart under admin takeover, and logs message', async () => {
    const cartId = `cart_escalate_${Date.now()}`;
    const merchantId = 'merch_escalate_test';

    const liveResult = await handleLiveTranscriptEvent({
      sessionId: 'sess_tw_001',
      cartId,
      merchantId,
      utterance: 'Let me talk to a human operator right now, this is awful',
      supportPhone: '+18889990000',
      storeName: 'Nordic Luxury',
    });

    expect(liveResult.handoffTriggered).toBe(true);
    expect(liveResult.twiml).toBeDefined();
    expect(liveResult.twiml).toContain('+18889990000');

    // Verify admin takeover lock
    expect(db.isAdminTakenOver(cartId)).toBe(true);

    // Verify logged escalation
    const logs = await db.listMessageLogs(merchantId);
    expect(logs.some((l) => l.content.includes('[URGENT HUMAN HANDOFF]'))).toBe(true);
  });
});
