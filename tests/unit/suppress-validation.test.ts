import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as suppressPOST } from '../../apps/web/src/app/api/recovery/suppress/route';

describe('suppress-validation: Payload Validation & Boundary Enforcement', () => {
  const origMode = process.env.RECOVERFLOW_RUNTIME_MODE;
  const origAnon = process.env.RECOVERFLOW_ALLOW_ANON_DEMO;

  beforeEach(() => {
    process.env.RECOVERFLOW_RUNTIME_MODE = 'DEMO';
    process.env.RECOVERFLOW_ALLOW_ANON_DEMO = 'true';
  });

  afterEach(() => {
    process.env.RECOVERFLOW_RUNTIME_MODE = origMode;
    process.env.RECOVERFLOW_ALLOW_ANON_DEMO = origAnon;
  });

  it('rejects empty payload or missing identifier with 400 Bad Request', async () => {
    const req = new NextRequest('http://localhost:3000/api/recovery/suppress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await suppressPOST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Invalid suppression request payload');
  });

  it('rejects too short identifier (< 3 chars) with 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/recovery/suppress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'ab' }),
    });

    const res = await suppressPOST(req);
    expect(res.status).toBe(400);
  });

  it('rejects invalid suppression type enum with 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/recovery/suppress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'user@example.com', type: 'INVALID_TYPE' }),
    });

    const res = await suppressPOST(req);
    expect(res.status).toBe(400);
  });

  it('accepts valid email suppression payload', async () => {
    const req = new NextRequest('http://localhost:3000/api/recovery/suppress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'optout.user@domain.com',
        type: 'EMAIL',
        reason: 'USER_UNSUBSCRIBE',
      }),
    });

    const res = await suppressPOST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.entry).toBeDefined();
    expect(data.entry.identifier).toBe('optout.user@domain.com');
  });
});
