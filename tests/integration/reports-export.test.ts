import { describe, it, expect } from 'vitest';
import { GET as exportRouteHandler } from '../../apps/web/src/app/api/recovery/reports/export/route';
import { NextRequest } from 'next/server';

describe('Causal Lift & Executive Report Export (Daniel Kahneman & George Pólya)', () => {
  it('generates downloadable RFC-4180 CSV export with causal lift attribution columns', async () => {
    const req = new NextRequest('http://localhost:3000/api/recovery/reports/export?format=csv');
    const res = await exportRouteHandler(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain('attachment; filename="recoverflow-causal-roas-report.csv"');

    const csvText = await res.text();
    expect(csvText).toContain('RecoverFlow AI — CFO Executive Causal Attribution & ROAS Report');
    expect(csvText).toContain('10% Randomized Uncontacted Holdout Group');
    expect(csvText).toContain('True Incremental ROAS Multiplier');
    expect(csvText).toContain('Attributable Gross Margin Saved ($)');
  });

  it('generates structured JSON summary for dashboard metric verification', async () => {
    const req = new NextRequest('http://localhost:3000/api/recovery/reports/export?format=json');
    const res = await exportRouteHandler(req);

    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.merchantName).toBeDefined();
    expect(data.metrics).toBeDefined();
    expect(data.metrics.holdoutControlConversionRatePercent).toBe(11.2);
    expect(data.metrics.causalIncrementalLiftPercent).toBeGreaterThan(0);
    expect(data.metrics.trueIncrementalRoas).toBeGreaterThan(0);
  });
});
